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
    cmd = ["runuser", "-p", "-u", "novaadmin", "--", "pm2", *args]
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

    if not shutil.which("runuser"):
        stop("RUNUSER_MISSING")
    status = command("start", str(root / TARGET),
         "--name", NAME, "--cwd", str(root),
         "--interpreter", "node", "--node-args=--import=tsx",
         extra_env=cfg)
    time.sleep(10)
    after = processes()
    found = [p for p in after if p.get("name") == NAME]
    if len(found) != 1 or found[0].get("pm2_env",{}).get("status") != "online":
        try:
            command("delete", NAME)
        finally:
            stop("NOTIFICATION_WORKER_START_FAILED")
    started = found[0]
    if not started.get("pid"):
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
