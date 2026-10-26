#!/usr/bin/env python3
"""Restore ONLY the BetVima casino eligibility and cash-launch API upstream.

Intent: Main web UI may run on :3003, where casino cash is disabled, while the
previously authorized SINGLE-ACCOUNT cash pilot runs on dedicated :3098.
Route just two exact server-side URLs to existing :3098 without changing ANY
casino environment flags, account permissions, KYC/age/geo checks, wallet,
callbacks, database, provider signing, site frontend, PM2, or app packages.

Usage (operator root on existing VPS):
    python3 restore-casino-api-upstream.py apply
    python3 restore-casino-api-upstream.py revert

No provider requests or financial transfers are submitted.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
import stat
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path

SITE = Path("/etc/nginx/sites-enabled/betvima.com")
EXPECTED_RELEASE = Path("/opt/nova-releases/casino-debit-fast-20261026")
STATE_DIR = Path("/root/betvima-nginx-backups")
STATE_PATH = STATE_DIR / "casino-cash-api-3098-20261026.json"
MARKER = "BETVIMA_CASINO_CASH_API_ROUTING_V1"
CALLBACK_RE = re.compile(
    r"location\s+\^~\s+/api/webhooks/softaggregator\s*"
    r"\{[^{}]*?\bproxy_pass\s+http://127\.0\.0\.1:(\d+)\s*;",
    re.S,
)
CASH_LOCATION_RE = re.compile(
    r"\blocation\s+(?:(?:=|\^~|~\*?)\s+)?/api/v1/casino(?:/|\b)",
    re.I,
)
FLAG_NAMES = (
    "SOFTAGGREGATOR_ENABLED",
    "SOFTAGGREGATOR_REAL_MONEY_ENABLED",
    "SOFTAGGREGATOR_FINANCIAL_SCHEMA_READY",
    "SOFTAGGREGATOR_CALLBACK_EDGE_READY",
)
REQUIRED_SECRET_SIZES = {
    "SOFTAGGREGATOR_SALT_KEY": 12,
    "SOFTAGGREGATOR_EDGE_HMAC_SECRET": 32,
    "CASINO_GEO_HMAC_SECRET": 32,
}


def stop(reason: str) -> None:
    raise SystemExit("STOP_" + reason)


def sha(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def run(argv: list[str], *, check: bool = True) -> subprocess.CompletedProcess[str]:
    p = subprocess.run(argv, capture_output=True, text=True, timeout=20)
    if check and p.returncode != 0:
        stop("COMMAND_FAILED_" + Path(argv[0]).name.upper())
    return p


def listen_pid(port: int) -> int:
    result = run(["ss", "-H", "-lntp"])
    matches = [line for line in result.stdout.splitlines()
               if re.search(rf":{port}\s", line)]
    if len(matches) != 1:
        stop(f"PORT_{port}_LISTENER_NOT_UNIQUE")
    pid = re.search(r"\bpid=(\d+)", matches[0])
    if not pid:
        stop(f"PORT_{port}_PROCESS_UNKNOWN")
    return int(pid.group(1))


def read_env_bool_only(pid: int, cwd: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for file in (".env", ".env.production", ".env.local", ".env.production.local"):
        f = cwd / file
        if not f.is_file():
            continue
        for raw in f.read_text(errors="replace").splitlines():
            m = re.match(r"^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$", raw)
            if m:
                values[m.group(1)] = m.group(2).strip().strip("\"'")
    # The process environment wins over dotenv values.
    for entry in Path(f"/proc/{pid}/environ").read_bytes().split(b"\0"):
        if b"=" in entry:
            k, v = entry.split(b"=", 1)
            values[k.decode(errors="replace")] = v.decode(errors="replace")
    return values


def check_dedicated_cash_pilot() -> None:
    pid = listen_pid(3098)
    process_dir = Path(f"/proc/{pid}/cwd").resolve()
    if process_dir != EXPECTED_RELEASE.resolve():
        stop("CASH_SERVICE_RELEASE_CHANGED")
    sources = (
        "src/app/api/v1/casino/eligibility/route.ts",
        "src/app/api/v1/casino/launch/route.ts",
        "src/server/providers/softaggregator/client.ts",
        "src/server/providers/softaggregator/wallet.ts",
        "src/server/providers/softaggregator/edge-location.ts",
    )
    for name in sources:
        if not (process_dir / name).is_file():
            stop("CASH_HANDLER_SOURCE_MISSING")
    client = (process_dir / sources[2]).read_text(errors="replace")
    edge = (process_dir / sources[4]).read_text(errors="replace")
    if ("casinoRealMoneyUserAllowed" not in client or
            "SOFTAGGREGATOR_TEST_USER_ID" not in client or
            "verifiedCasinoLocation" not in edge or
            "timingSafeEqual" not in edge):
        stop("ORIGINAL_CASH_PROTECTION_NOT_FOUND")

    values = read_env_bool_only(pid, process_dir)
    if any(values.get(k) != "true" for k in FLAG_NAMES):
        stop("CASH_PILOT_RUNTIME_GATE_NOT_READY")
    if any(len(values.get(k, "").encode()) < n
           for k, n in REQUIRED_SECRET_SIZES.items()):
        stop("CASH_PILOT_SIGNING_NOT_READY")
    if not re.fullmatch(r"[0-9a-fA-F]{8}-(?:[0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}",
                        values.get("SOFTAGGREGATOR_TEST_USER_ID", "")):
        stop("CASH_PILOT_ACCOUNT_NOT_CONFIGURED")

    checks = (
        ("http://127.0.0.1:3098/api/v1/casino/eligibility", "401"),
        ("http://127.0.0.1:3098/api/v1/casino/games", "200"),
    )
    for url, expected in checks:
        p = run(["curl", "-sS", "--max-time", "8", "-o", "/dev/null",
                 "-w", "%{http_code}", url], check=False)
        if p.returncode != 0 or p.stdout.strip() != expected:
            stop("CASH_PILOT_API_NOT_HEALTHY")
    print("EXISTING_CASH_PILOT_3098_READY=true")


def enclosing_server(text: str, pos: int) -> tuple[int, int]:
    # Nginx-brace scanner; quoted strings and #comments are not structural.
    stack: list[tuple[str, int]] = []
    candidates: list[tuple[int, int]] = []
    i = 0
    in_quote = ""
    while i < len(text):
        c = text[i]
        if in_quote:
            if c == "\\":
                i += 2
                continue
            if c == in_quote:
                in_quote = ""
            i += 1
            continue
        if c in ("'", '"'):
            in_quote = c
            i += 1
            continue
        if c == "#":
            nl = text.find("\n", i)
            i = len(text) if nl < 0 else nl + 1
            continue
        if c == "{":
            m = re.search(r"([A-Za-z_][A-Za-z_0-9]*)\s*$", text[:i])
            stack.append((m.group(1) if m else "", i))
        elif c == "}":
            if not stack:
                stop("INVALID_NGINX_BRACE_LAYOUT")
            name, start = stack.pop()
            if name == "server" and start <= pos <= i:
                candidates.append((start, i))
        i += 1
    if stack or len(candidates) != 1:
        stop("CASINO_CALLBACK_SERVER_NOT_UNIQUE")
    return candidates[0]


def config_file() -> Path:
    if not SITE.is_file():
        stop("NGINX_SITE_FILE_MISSING")
    return SITE.resolve(strict=True)


def next_config(original: str) -> str:
    if MARKER in original:
        stop("CASINO_API_ALREADY_ROUTED")
    callback = list(CALLBACK_RE.finditer(original))
    if len(callback) != 1 or callback[0].group(1) != "3098":
        stop("LIVE_CALLBACK_NOT_UNIQUELY_ON_3098")
    start, end = enclosing_server(original, callback[0].start())
    block = original[start:end]
    if not re.search(r"\bserver_name\s+[^;]*\bbetvima\.com\b", block):
        stop("CASINO_CALLBACK_SERVER_NAME_UNEXPECTED")
    if not re.search(r"\blisten\s+[^;\n]*\b443\b", block):
        stop("CASINO_CALLBACK_NOT_IN_HTTPS_SERVER")
    if CASH_LOCATION_RE.search(block):
        stop("EXISTING_CASINO_API_NGINX_OVERRIDE")

    # The app performs user auth, country HMAC verification, 1-account pilot
    # allowlisting, age/KYC/geo/limits and financial ledger operations.
    # Do NOT create a generic /api/v1/casino route: games + demo stay where
    # they are and only eligibility and cash launches reach the cash pilot.
    m = callback[0]
    line_start = original.rfind("\n", 0, m.start()) + 1
    indentation = original[line_start:m.start()]
    if indentation.strip():
        stop("NGINX_LOCATION_LAYOUT_UNEXPECTED")
    route = (
        f"{indentation}# {MARKER}: only existing one-account cash pilot\n"
        + "\n".join(
            f"{indentation}location = {path} {{\n"
            f"{indentation}    proxy_pass http://127.0.0.1:3098;\n"
            f"{indentation}    proxy_http_version 1.1;\n"
            f"{indentation}    proxy_pass_request_headers on;\n"
            f"{indentation}    proxy_set_header Host $host;\n"
            f"{indentation}    proxy_set_header X-Real-IP $remote_addr;\n"
            f"{indentation}    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n"
            f"{indentation}    proxy_set_header X-Forwarded-Proto $scheme;\n"
            f"{indentation}    proxy_set_header X-Forwarded-Host $host;\n"
            f"{indentation}}}\n"
            for path in (
                "/api/v1/casino/eligibility",
                "/api/v1/casino/launch",
            )
        )
        + "\n"
    )
    return original[:line_start] + route + original[line_start:]


def atomic_write(path: Path, data: bytes) -> None:
    metadata = path.stat()
    fd, tmp = tempfile.mkstemp(prefix=".betvima-casino-api-", dir=str(path.parent))
    try:
        with os.fdopen(fd, "wb") as stream:
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())
        os.chmod(tmp, stat.S_IMODE(metadata.st_mode))
        os.chown(tmp, metadata.st_uid, metadata.st_gid)
        os.replace(tmp, path)
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)


def reload_checked() -> None:
    run(["nginx", "-t"])
    run(["systemctl", "reload", "nginx"])


def site_status(path: str) -> str:
    p = run(
        ["curl", "-ksS", "--connect-timeout", "3", "--max-time", "8",
         "--resolve", "betvima.com:443:127.0.0.1",
         "-o", "/dev/null", "-w", "%{http_code}",
         "https://betvima.com" + path], check=False
    )
    return p.stdout.strip() if p.returncode == 0 else "000"


def apply() -> None:
    if os.geteuid() != 0:
        stop("ROOT_REQUIRED")
    cfg = config_file()
    if STATE_PATH.exists():
        stop("EXISTING_ROUTING_STATE_PRESENT_USE_REVERT")
    check_dedicated_cash_pilot()
    original = cfg.read_bytes()
    updated = next_config(original.decode("utf-8")).encode("utf-8")
    if site_status("/api/v1/casino/eligibility") != "401":
        stop("ORIGINAL_SITE_AUTH_BEHAVIOR_CHANGED")
    if site_status("/api/v1/casino/games") != "200":
        stop("ORIGINAL_SITE_GAMES_UNHEALTHY")

    # Refuse conflicting routing directives elsewhere in loaded Nginx config.
    current = run(["nginx", "-T"]).stdout
    if CASH_LOCATION_RE.search(current):
        stop("EXISTING_CASINO_API_ROUTE_IN_NGINX_INCLUDES")

    STATE_DIR.mkdir(parents=True, mode=0o700, exist_ok=True)
    STATE_DIR.chmod(0o700)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    backup = STATE_DIR / ("casino-cash-api-before-" + stamp + ".conf")
    if backup.exists():
        stop("BACKUP_ALREADY_EXISTS")
    backup.write_bytes(original)
    backup.chmod(0o600)
    state = {
        "config": str(cfg),
        "backup": str(backup),
        "before_sha256": sha(original),
        "after_sha256": sha(updated),
        "operation": MARKER,
    }
    try:
        atomic_write(cfg, updated)
        reload_checked()
        if site_status("/api/v1/casino/eligibility") != "401" or \
                site_status("/api/v1/casino/games") != "200":
            raise RuntimeError("SITE_HEALTH_AFTER_ROUTE_UNEXPECTED")
        STATE_PATH.write_text(json.dumps(state, indent=2))
        STATE_PATH.chmod(0o600)
    except Exception:
        # Never leave Nginx on the new config after any failed safeguard.
        atomic_write(cfg, original)
        try:
            reload_checked()
        except Exception:
            print("CRITICAL_NGINX_ROLLBACK_RELOAD_FAILED", flush=True)
        raise
    print("CASINO_CASH_API_ROUTED_TO_EXISTING_3098=true")
    print("CASINO_REAL_MONEY_USER_PERMISSIONS_UNCHANGED=true")
    print("CASINO_CALLBACK_DATABASE_WALLET_UNCHANGED=true")
    print("SITE_OTHER_ENDPOINTS_UNCHANGED=true")
    print("RESTORE_STATE_STORED_ROOT_ONLY=true")
    print("CASH_API_ROUTING_UPDATE_COMPLETE")


def revert() -> None:
    if os.geteuid() != 0:
        stop("ROOT_REQUIRED")
    if not STATE_PATH.is_file():
        stop("NO_ROUTING_STATE")
    state = json.loads(STATE_PATH.read_text())
    cfg = config_file()
    if str(cfg) != state.get("config"):
        stop("NGINX_CONFIG_TARGET_CHANGED")
    current = cfg.read_bytes()
    if sha(current) != state.get("after_sha256"):
        stop("NGINX_CONFIG_MODIFIED_AFTER_INSTALL_REFUSE_OVERWRITE")
    backup = Path(state["backup"])
    if not backup.is_file():
        stop("ORIGINAL_BACKUP_MISSING")
    original = backup.read_bytes()
    if sha(original) != state["before_sha256"]:
        stop("BACKUP_CHECKSUM_MISMATCH")
    atomic_write(cfg, original)
    try:
        reload_checked()
    except Exception:
        atomic_write(cfg, current)
        reload_checked()
        raise
    STATE_PATH.unlink()
    print("CASINO_CASH_API_ROUTING_REVERTED=true")
    print("CASINO_CALLBACK_WALLET_DB_UNCHANGED=true")


if __name__ == "__main__":
    if len(sys.argv) != 2 or sys.argv[1] not in ("apply", "revert"):
        stop("USAGE_APPLY_OR_REVERT")
    try:
        (apply if sys.argv[1] == "apply" else revert)()
    except SystemExit:
        raise
    except Exception as exc:
        # Do not print traceback: environment/config may contain sensitive data.
        stop("OPERATION_FAILED_" + type(exc).__name__)
