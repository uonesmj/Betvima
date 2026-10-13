#!/usr/bin/env python3
"""Retire discontinued football APIs from PM2 without touching bets or settlement.

Preconditions: the production web has the deployed Odds-only catalog marker,
the live/bulk workers are online and have an independent The Odds API key.
No API credentials, URLs containing credentials, or PM2 JSON are printed.
"""
import datetime
import json
import os
import pathlib
import subprocess
import sys
import urllib.request

PM2_HOME = "/home/novaadmin/.pm2"
WORKERS = ("betvima-live-odds-worker", "betvima-odds-worker")
EXTRA = "betvima-football-stats-worker"
PROTECTED = "betvima-settlement-worker"
MARKER = b"the-odds-api-only-v1"
NEW_ENV = {
    "SPORTS_PROVIDER": "the_odds_api",
    "SPORTS_PROVIDER_BASE_URL": "https://api.the-odds-api.com",
    # Independent ODDS_API_KEY was preflighted; never retain another vendor's
    # key under the generic SPORTS_PROVIDER_API_KEY alias.
    "SPORTS_PROVIDER_API_KEY": "",
    "FIVEDOLLAR_API_KEY": "",
    "FIVEDOLLAR_API_BASE_URL": "",
    "FIVEDOLLAR_BETTING_ODDS_ENABLED": "false",
    "API_FOOTBALL_KEY": "",
}

def refuse(reason):
    raise RuntimeError("SAFETY_STOP:" + reason)

def pm2(*args, env_updates=None):
    overrides = dict(os.environ)
    overrides["PM2_HOME"] = PM2_HOME
    if env_updates:
        overrides.update(env_updates)
    call = ["runuser", "-u", "novaadmin", "--", "env",
            *(f"{k}={v}" for k,v in overrides.items() if k in
              set(NEW_ENV) | {"PM2_HOME", "ODDS_API_BASE_URL", "SPORTS_PROVIDER_API_KEY",
                              "ODDS_API_KEY", "ODDS_WORKER_MODE", "NODE_ENV"}),
            "pm2", *args]
    response = subprocess.run(call, text=True, capture_output=True, timeout=100)
    if response.returncode != 0:
        refuse("PM2_" + str(args[0]) + "_FAILED")
    return response.stdout

def read_apps():
    return json.loads(pm2("jlist"))

def app(apps, name, optional=False):
    entries = [a for a in apps if a.get("name") == name]
    if not entries and optional:
        return None
    if len(entries) != 1:
        refuse("UNEXPECTED_PROCESS_COUNT_" + name)
    value = entries[0]
    if value.get("pm2_env",{}).get("status") != "online" or not value.get("pid"):
        refuse("PROCESS_NOT_ONLINE_" + name)
    return value

def restored_env(before):
    previous = before.get("pm2_env", {})
    return {k:str(previous.get(k,"")) for k in NEW_ENV}

def main():
    if os.geteuid()!=0:
        refuse("ROOT_REQUIRED")
    with urllib.request.urlopen(
        urllib.request.Request("https://betvima.com/api/v1/live?limit=1",
                               headers={"Accept":"application/json"}),
        timeout=35,
    ) as response:
        body=response.read(1024*1024+1)
        if response.status != 200 or len(body)>1024*1024 or MARKER not in body:
            refuse("ODDS_ONLY_WEB_RELEASE_NOT_LIVE")
    print("ODDS_ONLY_WEB_VERIFIED",flush=True)

    before=read_apps()
    current={name:app(before,name) for name in WORKERS}
    protected=app(before,PROTECTED)
    extras=app(before,EXTRA,optional=True)
    for name, entry in current.items():
        env=entry.get("pm2_env",{})
        # A real independent Odds key must be present before we remove fallback keys.
        # The Odds API itself stays unchanged.
        if not env.get("ODDS_API_KEY"):
            refuse("ODDS_API_CREDENTIAL_NOT_VERIFIED_"+name)
    # Store a root-only local backup; contains environment secrets and MUST NOT
    # be uploaded, shared, logged or pasted into chat.
    stamp=datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    backup=pathlib.Path("/root")/("betvima-odds-only-pm2-"+stamp+".json")
    fd=os.open(str(backup),os.O_CREAT|os.O_WRONLY|os.O_EXCL,0o600)
    with os.fdopen(fd,"w") as fp:
        json.dump(before,fp)
    print("PM2_BACKUP_SECURED",flush=True)

    modified=[]
    try:
        for name in WORKERS:
            pm2("restart",name,"--update-env",env_updates=NEW_ENV)
            modified.append(name)
            after=read_apps()
            proc=app(after,name)
            env=proc.get("pm2_env",{})
            if proc["pid"]==current[name]["pid"]:
                refuse("WORKER_RESTART_UNVERIFIED_"+name)
            if str(env.get("FIVEDOLLAR_BETTING_ODDS_ENABLED","")).lower()!="false":
                refuse("SECOND_SOURCE_FLAG_NOT_DISABLED_"+name)
            if env.get("FIVEDOLLAR_API_KEY"):
                refuse("SECOND_SOURCE_KEY_STILL_ACTIVE_"+name)
            if env.get("SPORTS_PROVIDER")!="the_odds_api":
                refuse("PRIMARY_PROVIDER_MISMATCH_"+name)
            if not env.get("ODDS_API_KEY"):
                refuse("PRIMARY_PROVIDER_KEY_LOST_"+name)
            print("ODDS_ONLY_WORKER_READY",name,flush=True)
        after=read_apps()
        if app(after,PROTECTED)["pid"]!=protected["pid"]:
            refuse("SETTLEMENT_PROCESS_CHANGED")
    except Exception:
        # If a restart or environment check fails, restore only the affected
        # odds-worker environment. Never touch settlement or wallet processes.
        for name in reversed(modified):
            try:
                pm2("restart",name,"--update-env",env_updates=restored_env(current[name]))
                print("ODDS_WORKER_ROLLBACK",name,flush=True)
            except Exception:
                print("MANUAL_REVIEW_REQUIRED",name,flush=True)
        raise

    # The separate football-statistics worker is the remaining autonomous
    # 5Dollar API caller. It is removed only AFTER Odds API workers are safe.
    if extras is not None:
        pm2("delete",EXTRA)
        print("SECONDARY_STATS_WORKER_REMOVED",flush=True)
    pm2("save")
    final=read_apps()
    for name in WORKERS:
        proc=app(final,name)
        if proc.get("pm2_env",{}).get("FIVEDOLLAR_API_KEY"):
            refuse("FINAL_SECONDARY_KEY_PRESENT")
    if any(a.get("name")==EXTRA for a in final):
        refuse("FINAL_STATS_WORKER_STILL_PRESENT")
    if app(final,PROTECTED)["pid"]!=protected["pid"]:
        refuse("FINAL_SETTLEMENT_PROCESS_CHANGED")
    print("ODDS_ONLY_PM2_DEPLOYED",flush=True)
    print("SETTLEMENT_UNCHANGED",flush=True)

if __name__=="__main__":
    try:main()
    except Exception as exc:
        print(str(exc) if str(exc).startswith("SAFETY_STOP:") else "SAFETY_STOP:"+type(exc).__name__,flush=True)
        sys.exit(1)
