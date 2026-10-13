#!/usr/bin/env python3
"""Restore missing notification PM2 process. NO wallet/ledger/provider payment writes.

Launches ONLY the existing notification entrypoint with verified Resend+DB env.
An explicit PM2 heartbeat check still has to confirm delivery after startup.
Never prints keys, email addresses, voucher codes or message bodies.
"""
import json
import os
import pathlib
import re
import shutil
import subprocess
import sys
import time
import pwd

NAME = "betvima-notification-worker"
PM2_HOME = "/home/novaadmin/.pm2"
ROOT_PREFIX = "/opt/nova-releases/"
REQUIRED = ("RESEND_API_KEY", "RESEND_FROM_EMAIL")
DB_KEYS = ("SUPABASE_DB_URL", "DATABASE_URL")
TARGET = "src/workers/entrypoints/notification.worker.ts"

def stop(why):
    raise RuntimeError("SAFETY_STOP:" + why)

def command(*args, extra_env=None):
    env = dict(os.environ)
    env["PM2_HOME"] = PM2_HOME
    if extra_env is not None:
        env.update(extra_env)
    # runuser -p preserves the inherited environment WITHOUT putting any
    # provider/DB credentials into the command line or terminal history.
    # PM2 process environments can replace PATH, so pin trusted executables.
    runuser = "/usr/sbin/runuser"
    pm2 = "/usr/bin/pm2"
    if not (pathlib.Path(runuser).is_file() and pathlib.Path(pm2).is_file()):
        stop("PM2_EXECUTABLE_PATH_MISSING")
    env["PATH"] = "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
    cmd = [runuser, "-p", "-u", "novaadmin", "--", pm2, *args]
    r = subprocess.run(cmd, env=env, text=True, capture_output=True, timeout=90)
    if r.returncode:
        stop("PM2_COMMAND_FAILED")
    return r.stdout

def processes():
    return json.loads(command("jlist"))

def dotenv(root):
    result = {}
    # Files are read with root privileges, but their values are never printed.
    for name in (".env", ".env.production", ".env.local", ".env.production.local"):
        f = root / name
        if not f.is_file() or f.is_symlink():
            continue
        if f.stat().st_size > 1024 * 1024:
            stop("UNEXPECTED_ENV_FILE")
        for line in f.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if line.startswith("export "):
                line = line[7:]
            if "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", key):
                continue
            val = value.strip()
            if len(val) >= 2 and val[0] == val[-1] and val[0] in ('"', "'"):
                val = val[1:-1]
            result[key] = val
    return result

def sanitize_status(value):
    return value if value in ("online", "stopped", "errored", "launching", "stopping") else "unknown"

def sanitize_int(value):
    return value if isinstance(value, int) and 0 <= value < 10**8 else "unknown"

def read_last(path):
    try:
        with path.open("rb") as file:
            file.seek(max(0, path.stat().st_size - 100000))
            return file.read().decode("utf-8", "replace")
    except Exception:
        return ""

def classify_error(text):
    # NEVER output raw stack traces, emails, tokens, request bodies or secrets.
    markers = {
        "ERR_MODULE_NOT_FOUND": "MODULE_NOT_FOUND",
        "MODULE_NOT_FOUND": "MODULE_NOT_FOUND",
        "Cannot find module": "MODULE_NOT_FOUND",
        "Cannot find package": "MODULE_NOT_FOUND",
        "ERR_UNKNOWN_FILE_EXTENSION": "TYPESCRIPT_LOADER_FAILED",
        "ERR_PACKAGE_PATH_NOT_EXPORTED": "PACKAGE_EXPORT_FAILED",
        "ERR_REQUIRE_ESM": "ESM_LOADER_FAILED",
        "SyntaxError": "SYNTAX_ERROR",
        "TypeError": "RUNTIME_TYPE_ERROR",
        "ReferenceError": "RUNTIME_REFERENCE_ERROR",
        "INVALID_ENVIRONMENT": "MISSING_OR_BAD_ENV_CONFIG",
        "EACCES": "PERMISSION_DENIED",
        "ECONNREFUSED": "DATABASE_OR_NETWORK_REFUSED",
        "ENOTFOUND": "DNS_FAILED",
        "ERR_TLS": "TLS_FAILED",
        "ERR_INVALID_ARG": "NODE_ARGUMENT_REJECTED",
        "ERR_UNSUPPORTED_ESM_URL_SCHEME": "LOADER_INVALID_URL",
        "FATAL ERROR": "NODE_FATAL",
        "Error:": "UNCLASSIFIED_NODE_ERROR",
    }
    for token, label in markers.items():
        if token in text:
            print("BOOT_DIAGNOSIS", label, flush=True)
            return
    print("BOOT_DIAGNOSIS", "NO_LOG_ERROR_MATCH" if text else "LOG_EMPTY", flush=True)

def main():
    if os.geteuid():
        stop("ROOT_REQUIRED")
    before = processes()
    matches = [p for p in before if p.get("name") == NAME]
    if matches:
        if len(matches) != 1:
            stop("DUPLICATE_NOTIFICATION_PROCESS")
        if matches[0].get("pm2_env", {}).get("status") == "online":
            print("NOTIFICATION_WORKER_ALREADY_ONLINE", flush=True)
            print("VERIFY_QUEUE_AND_HEARTBEAT", flush=True)
            return
        stop("NOTIFICATION_PROCESS_EXISTS_BUT_NOT_ONLINE")

    # PM2 source process is selected from the server's real current releases.
    # Never activate a payment-email worker from an unknown source tree.
    choices = []
    for p in before:
        e = p.get("pm2_env", {})
        cwd = e.get("pm_cwd")
        if e.get("status") != "online" or not isinstance(cwd, str):
            continue
        root = pathlib.Path(cwd)
        if not cwd.startswith(ROOT_PREFIX) or not root.is_dir():
            continue
        real = root.resolve()
        if not str(real).startswith(ROOT_PREFIX):
            continue
        if not (real / TARGET).is_file() or not (real / "node_modules" / "tsx").is_dir():
            continue
        fileenv = dotenv(real)
        combined = dict(fileenv)
        combined.update({k:v for k,v in e.items() if isinstance(v, str) and v})
        if any(not combined.get(k) for k in REQUIRED):
            continue
        if not any(combined.get(k) for k in DB_KEYS):
            continue
        # Do not use a mismatched empty public config or fallback DB driver.
        combined["PM2_HOME"] = PM2_HOME
        combined["NODE_ENV"] = "production"
        combined["APP_ENV"] = "production"
        choices.append((int(e.get("pm_uptime") or 0), real, combined))

    if not choices:
        stop("RESEND_OR_DATABASE_ENV_NOT_FOUND_IN_ACTIVE_RELEASE")
    _, root, cfg = max(choices, key=lambda item:item[0])
    if cfg.get("NOTIFY_EMAIL_PROVIDER","").lower() == "disabled":
        # Registry routes directly to Resend with credentials; do not let
        # the legacy toggle override the explicit registered provider.
        pass
    print("RESEND_AND_DB_CONFIG_VERIFIED", flush=True)

    # Read-only provider capability probe; NEVER activate or create a voucher.
    # Do not print auth tokens or response bodies even on HTTP failures.
    token = cfg.get("UWALLET_TOKEN", "")
    uv = cfg.get("UWALLET_UVOUCHER_COIN", "")
    hv = cfg.get("UWALLET_HOTVOUCHER_COIN", "")
    print("UWALLET_CONFIGURED", bool(token and uv and hv), flush=True)
    if token:
        import urllib.error
        import urllib.request
        base = cfg.get("UWALLET_BASE_URL", "https://api.uwallet.biz").rstrip("/")
        if base.startswith("https://"):
            try:
                req = urllib.request.Request(
                    base + "/v1/coin",
                    headers={"Authorization": token, "Accept": "application/json"},
                    method="GET",
                )
                with urllib.request.urlopen(req, timeout=15) as response:
                    payload = json.load(response)
                rows = payload.get("data", []) if isinstance(payload, dict) else payload
                if not isinstance(rows, list):
                    rows = []
                active = {}
                for coin in rows:
                    if not isinstance(coin, dict):
                        continue
                    name = str(coin.get("coin") or coin.get("symbol") or "").lower()
                    active[name] = coin
                for label, name in (("UVOUCHER", uv), ("HOTVOUCHER", hv)):
                    obj = active.get(name.lower(), {}) if name else {}
                    permissions = obj.get("voucher", {}) if isinstance(obj, dict) else {}
                    print(label + "_COIN_FOUND", bool(obj), flush=True)
                    print(label + "_USE_ENABLED", bool(permissions.get("use")) if isinstance(permissions, dict) else False, flush=True)
                    print(label + "_CREATE_ENABLED", bool(permissions.get("create")) if isinstance(permissions, dict) else False, flush=True)
                print("UWALLET_READONLY_PROBE_COMPLETE", flush=True)
            except urllib.error.HTTPError as e:
                print("UWALLET_READONLY_HTTP_STATUS", e.code, flush=True)
            except Exception:
                print("UWALLET_READONLY_UNAVAILABLE", flush=True)
        else:
            print("UWALLET_BASE_URL_REQUIRES_HTTPS", flush=True)

    # Never inherit one-shot mode from a different PM2 process.
    cfg["NOVA_WORKER_ONCE"] = "false"
    if not shutil.which("runuser"):
        stop("RUNUSER_MISSING")

    # A read-only runtime prerequisite: does not import the worker, open a
    # database connection, send an email, or mint/redeem any voucher.
    prereq = subprocess.run(
        ["/usr/sbin/runuser", "-p", "-u", "novaadmin", "--",
         "/usr/bin/node", "--import", "tsx", "-e", "process.exit(0)"],
        cwd=str(root), env=cfg, text=True, capture_output=True, timeout=30,
    )
    if prereq.returncode:
        classify_error(prereq.stderr)
        stop("TSX_RUNTIME_PRECHECK_FAILED")
    print("TSX_RUNTIME_PRECHECK_PASS", flush=True)

    # PM2 may unlink automatically-generated logs when deleting a failed app.
    # Supply private persistent files and inspect failures BEFORE deletion.
    logdir = pathlib.Path(PM2_HOME) / "logs"
    logdir.mkdir(parents=True, exist_ok=True)
    private = pwd.getpwnam("novaadmin")
    logfile_out = logdir / "voucher-notification-diagnostic.out.log"
    logfile_err = logdir / "voucher-notification-diagnostic.err.log"
    for f in (logfile_out, logfile_err):
        if f.is_symlink():
            stop("LOG_SYMLINK_NOT_ALLOWED")
        descriptor = os.open(str(f), os.O_CREAT | os.O_APPEND | os.O_WRONLY, 0o600)
        os.close(descriptor)
        os.chown(f, private.pw_uid, private.pw_gid)
        os.chmod(f, 0o600)
    command("start", str(root / TARGET),
        "--name", NAME, "--cwd", str(root),
        "--interpreter", "/usr/bin/node", "--node-args=--import=tsx",
        "--output", str(logfile_out), "--error", str(logfile_err),
        extra_env=cfg)
    time.sleep(12)
    after = processes()
    found = [p for p in after if p.get("name") == NAME]
    if len(found) != 1 or found[0].get("pm2_env",{}).get("status") != "online":
        if found:
            env = found[0].get("pm2_env") or {}
            print("PM2_BOOT_STATUS", sanitize_status(env.get("status")), flush=True)
            print("PM2_EXIT_CODE", sanitize_int(env.get("exit_code")), flush=True)
            print("PM2_RESTARTS", sanitize_int(env.get("restart_time")), flush=True)
        classify_error(read_last(logfile_err))
        classify_error(read_last(logfile_out))
        try:
            command("delete", NAME)
        except Exception:
            print("PM2_CLEANUP_REQUIRES_CHECK", flush=True)
        stop("NOTIFICATION_WORKER_START_FAILED")
    started = found[0]
    if not started.get("pid"):
        classify_error(read_last(logfile_err))
        stop("NOTIFICATION_WORKER_PID_MISSING")
    command("save")
    print("NOTIFICATION_WORKER_ONLINE", flush=True)
    print("EXISTING_VOUCHER_EMAIL_QUEUE_READY_FOR_DELIVERY", flush=True)
    print("NO_PAYMENT_OR_WALLET_OPERATION_PERFORMED", flush=True)

if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        message = str(exc)
        print(message if message.startswith("SAFETY_STOP:") else "SAFETY_STOP:"+type(exc).__name__, flush=True)
        sys.exit(1)
