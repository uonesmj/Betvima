#!/usr/bin/env python3
"""Enable a separate, bookmaker-freshness-guarded, results-free live odds process.

Run as root on the current Betvima VPS; never restarts the web or settlement
workers. Downloads only two pinned, Git-blob-verified TypeScript files.
"""
import hashlib
import json
import os
import pathlib
import pwd
import re
import subprocess
import sys
import tempfile
import time
import urllib.request

RELEASE_SHA = "0dcade1f3299935e6eaff732484538df62ddf5fa"
SOURCE_SHA = "d9aed59da847f4e7c0a3f1381222fd4f7ba2945e"
RELEASE = pathlib.Path("/opt/nova-releases") / RELEASE_SHA
NAME = "betvima-live-odds-worker"
WORKER_ID = "betvima-new-vps-live-odds"
PM2_HOME = pathlib.Path("/home/novaadmin/.pm2")
SOURCE_BLOBS = {
    "src/workers/odds.worker.ts": "33e159ab069d3c8f455e6c25b66efd4f0a3dcd04",
    "src/domain/odds.ts": "f8315f1b1e592089132bc43f6591deb5c7a6ceb4",
}

def abort(message):
    raise SystemExit("STOP: " + message)

def pm(*args, timeout=40, env=None):
    base = [
        "/usr/sbin/runuser", "-u", "novaadmin", "--",
        "/usr/bin/env", "-u", "NODE_CHANNEL_FD", "-u", "NODE_UNIQUE_ID",
        "-u", "NODE_APP_INSTANCE", "-u", "NODE_CHANNEL_SERIALIZATION_MODE",
        "PM2_HOME=" + str(PM2_HOME), "/usr/bin/pm2",
    ]
    return subprocess.run(base + list(args), capture_output=True, text=True,
                          timeout=timeout, env=env)

def apps():
    r = pm("jlist")
    if r.returncode:
        abort("PM2 unavailable; no processes were started")
    return json.loads(r.stdout)

def blobsha(data):
    return hashlib.sha1(
        b"blob " + str(len(data)).encode() + bytes((0,)) + data
    ).hexdigest()

def pinned_file(path, sha):
    url = ("https://raw.githubusercontent.com/uonesmj/Betvima/"
           + SOURCE_SHA + "/" + path)
    with urllib.request.urlopen(url, timeout=35) as response:
        data = response.read(1_000_001)
    if len(data) > 1_000_000 or blobsha(data) != sha:
        abort("Pinned Git source mismatch: " + path)
    return data

if os.geteuid() != 0:
    abort("Run as root in Termius")

print("=== BETVIMA LIVE ODDS WORKER ===", flush=True)
if not (RELEASE / ".next/BUILD_ID").is_file():
    abort("Approved active release build missing")

initial = apps()
web = [
    a for a in initial
    if a.get("name") == "nova-cd-" + RELEASE_SHA[:12]
    and a.get("pm2_env", {}).get("status") == "online"
    and a.get("pm2_env", {}).get("pm_cwd") == str(RELEASE)
]
financial = [
    a for a in initial
    if a.get("name") == "betvima-settlement-worker"
    and a.get("pm2_env", {}).get("status") == "online"
]
bulk = [
    a for a in initial
    if a.get("name") == "betvima-odds-worker"
    and a.get("pm2_env", {}).get("status") == "online"
]
if len(web) != 1 or len(financial) != 1 or len(bulk) != 1:
    abort("Required web/settlement/bulk service identity mismatch")

existing = [a for a in initial if a.get("name") == NAME]
if existing:
    if len(existing) == 1 and existing[0]["pm2_env"].get("status") == "online":
        print("LIVE_WORKER_ALREADY_RUNNING")
        raise SystemExit(0)
    abort("Existing stopped live worker needs manual inspection")

env = {
    k: str(v) for k, v in web[0]["pm2_env"].items()
    if re.fullmatch(r"[A-Z][A-Z0-9_]*", k) and isinstance(v, (str, int))
}
for key, value in bulk[0]["pm2_env"].items():
    if (
        re.fullmatch(r"(ODDS_|SPORTS_PROVIDER|SPORTS_PROVIDER_API_KEY).*", key)
        and isinstance(value, (str, int))
    ):
        env[key] = str(value)

for key in list(env):
    if key.startswith("NODE_CHANNEL_") or key in {
        "NODE_UNIQUE_ID", "NODE_APP_INSTANCE", "NODE_OPTIONS",
        "LD_PRELOAD", "LD_LIBRARY_PATH", "BASH_ENV", "ENV",
    }:
        env.pop(key, None)

env.update({
    "PATH": "/usr/bin:/bin",
    "HOME": "/home/novaadmin",
    "USER": "novaadmin",
    "LOGNAME": "novaadmin",
    "PM2_HOME": str(PM2_HOME),
    "NODE_ENV": "production",
    "APP_ENV": "production",
    "SPORTS_PROVIDER": "the_odds_api",
    "ODDS_WORKER_MODE": "live",
    "ODDS_LIVE_DISCOVERY_ENABLED": "false",
    "WORKER_ID": WORKER_ID,
    "FIVEDOLLAR_API_KEY": "",
})

if not (env.get("SUPABASE_DB_URL") or env.get("DATABASE_URL")):
    abort("Database runtime connection unavailable")
if not (env.get("ODDS_API_KEY") or env.get("SPORTS_PROVIDER_API_KEY")):
    abort("Odds API credential unavailable in existing worker environment")

# Download and validate all sources *before* changing a single local file.
payloads = {path: pinned_file(path, sha) for path, sha in SOURCE_BLOBS.items()}
print("SIGNED_SOURCE_FILES: VERIFIED", flush=True)

owner = pwd.getpwnam("novaadmin")
for relative, data in payloads.items():
    target = RELEASE / relative
    if not target.is_file() or target.is_symlink():
        abort("Unsafe source target: " + relative)
    original = target.read_bytes()
    backup = pathlib.Path("/home/novaadmin") / (
        "live-worker-prepatch-" + target.name + "-" + RELEASE_SHA[:12]
    )
    if not backup.exists():
        fd = os.open(backup, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, "wb") as output:
            output.write(original)
        os.chown(backup, owner.pw_uid, owner.pw_gid)
    fd, tmp = tempfile.mkstemp(prefix=".live-worker-", dir=target.parent)
    try:
        with os.fdopen(fd, "wb") as output:
            output.write(data)
        os.chmod(tmp, 0o644)
        os.chown(tmp, owner.pw_uid, owner.pw_gid)
        os.replace(tmp, target)
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)

print("ISOLATED_WORKER_SOURCE: UPDATED", flush=True)

ecosystem = {
    "apps": [{
        "name": NAME,
        "cwd": str(RELEASE),
        "script": str(RELEASE / "src/workers/entrypoints/odds.worker.ts"),
        "interpreter": "/usr/bin/node",
        "node_args": ["--import", "tsx"],
        "exec_mode": "fork",
        "instances": 1,
        "watch": False,
        "autorestart": True,
        "restart_delay": 15000,
        "min_uptime": 10000,
        "max_restarts": 5,
        "env": env,
    }]
}

fd, cfg = tempfile.mkstemp(prefix=".live-odds-start-", suffix=".json",
                          dir=PM2_HOME)
try:
    with os.fdopen(fd, "w") as file:
        json.dump(ecosystem, file)
    os.chown(cfg, owner.pw_uid, owner.pw_gid)
    os.chmod(cfg, 0o600)
    r = pm("start", cfg, "--update-env", timeout=50)
    if r.returncode:
        abort("Live worker start refused; existing services remain untouched")
finally:
    if os.path.exists(cfg):
        os.unlink(cfg)

time.sleep(12)
current = apps()
live = [a for a in current if a.get("name") == NAME]
if len(live) != 1 or live[0]["pm2_env"].get("status") != "online":
    abort("Live worker not online; inspect live worker logs")
if not all(any(a.get("name") == n and a["pm2_env"].get("status") == "online"
                   for a in current)
           for n in ("betvima-settlement-worker",
                     "betvima-odds-worker", "nova-cd-" + RELEASE_SHA[:12])):
    abort("An existing service changed status; do not save PM2 yet")

r = pm("save")
if r.returncode:
    abort("Live worker online but persistence save failed")

print("WEB: ONLINE")
print("SETTLEMENT: ONLINE")
print("BULK_ODDS: ONLINE")
print("DEDICATED_LIVE_ODDS: ONLINE")
print("WORKER_ID:", WORKER_ID)
print("PM2_PERSISTENCE: SAVED")
print("LIVE_ODDS_START_COMPLETE")
