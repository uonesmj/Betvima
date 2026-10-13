#!/usr/bin/env python3
"""Read-only, redacted PM2/live-football odds diagnostic. No network or database access."""
import collections
import json
import os
import pathlib
import subprocess

ROOT = pathlib.Path("/home/novaadmin/.pm2")
NAME = "betvima-live-odds-worker"
MARKERS = (
    "FIVEDOLLAR_AUTHENTICATED_PRICE_POLL",
    "FIVEDOLLAR_AUTHENTICATED_PRICE_UNAVAILABLE",
    "ODDS_LIVE_WORKER_FETCH_START",
    "ODDS_LIVE_WORKER_PROVIDER_RESULT",
    "ODDS_LIVE_WORKER_SYNC_DONE",
    "ODDS_LIVE_WORKER_SYNC_FAILED",
    "ODDS_LIVE_WORKER_PROVIDER_FAILED",
    "ODDS_LIVE_DISCOVERY_PROVIDER_RESULT",
    "tick failed",
    "loop error",
    "NOVA_ODDS_WORKER_RUNTIME_MARKER",
)
SAFE_FIELDS = (
    "provider", "requestedMatches", "attempted", "verified", "failed",
    "bundles", "updated", "rejected", "ok", "errorCode", "matches", "intervalMs",
)
def row(line):
    if "\x1b" in line:
        import re
        line = re.sub(r"\x1b\[[0-9;]*m", "", line)
    for marker in MARKERS:
        if marker not in line:
            continue
        suffix = line.split(marker, 1)[1]
        obj = {}
        idx = suffix.find("{")
        if idx != -1:
            try:
                parsed, _ = json.JSONDecoder().raw_decode(suffix[idx:])
                if isinstance(parsed, dict):
                    obj = {k: parsed[k] for k in SAFE_FIELDS if k in parsed
                           and isinstance(parsed[k], (str, int, float, bool, type(None)))}
            except Exception:
                pass
        return marker, obj
    return None

def main():
    p = subprocess.run(
        ["runuser", "-u", "novaadmin", "--", "env",
         "PM2_HOME=/home/novaadmin/.pm2", "pm2", "jlist"],
        text=True, capture_output=True, timeout=45,
    )
    if p.returncode:
        print("PM2_STATUS=UNAVAILABLE")
        return
    apps = json.loads(p.stdout)
    app = next((a for a in apps if a.get("name") == NAME), None)
    if not app:
        print("PM2_STATUS=WORKER_MISSING")
        return
    env = app.get("pm2_env") or {}
    pid = app.get("pid")
    print("LIVE_PID", pid)
    print("LIVE_STATUS", env.get("status", "unknown"))
    print("LIVE_MODE", env.get("ODDS_WORKER_MODE", "unset"))
    print("ODDS_FLAG", env.get("FIVEDOLLAR_BETTING_ODDS_ENABLED", "unset"))
    if isinstance(pid, int) and pid > 0:
        proc = pathlib.Path("/proc") / str(pid) / "environ"
        try:
            keys = {item.split(b"=", 1)[0].decode("ascii", errors="ignore")
                    for item in proc.read_bytes().split(b"\x00") if b"=" in item}
            for key in ("FIVEDOLLAR_API_KEY", "SPORTS_PROVIDER_API_KEY",
                        "ODDS_WORKER_MODE", "FIVEDOLLAR_BETTING_ODDS_ENABLED"):
                print("PROC_ENV_HAS_"+key, key in keys)
        except Exception:
            print("PROC_ENV_CHECK=UNAVAILABLE")
    paths = []
    for k in ("pm_out_log_path", "pm_err_log_path"):
        v = env.get(k) or app.get(k)
        if isinstance(v, str) and v.startswith("/"):
            paths.append(pathlib.Path(v))
    paths += sorted((ROOT / "logs").glob("*live*odds*.log"))
    counts = collections.Counter()
    entries = collections.deque(maxlen=25)
    seen = set()
    for path in paths:
        if str(path) in seen:
            continue
        seen.add(str(path))
        try:
            if not path.is_file():
                print("LOG_FILE", path.name, "MISSING")
                continue
            size = path.stat().st_size
            print("LOG_FILE", path.name, "BYTES", size)
            with path.open("rb") as f:
                f.seek(max(0, size - 8 * 1024 * 1024))
                data = f.read().decode("utf-8", errors="replace")
            for line in data.splitlines():
                parsed = row(line)
                if parsed:
                    event, fields = parsed
                    counts[event] += 1
                    entries.append((event, fields))
        except Exception:
            print("LOG_FILE", path.name, "UNREADABLE")
    for marker in MARKERS:
        print("COUNT", marker, counts[marker])
    print("LAST_RELEVANT_EVENTS")
    for event, fields in entries:
        print(event, json.dumps(fields, separators=(",", ":")))
    print("DIAGNOSTIC_COMPLETE")

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print("DIAGNOSTIC_STOP", type(e).__name__)
