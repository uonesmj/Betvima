#!/usr/bin/env python3
"""Read-only, sanitized PM2 notification-process diagnostic for BetVima.
Never starts/deletes/restarts an application or accesses voucher/mail contents.
"""
import collections
import json
import pathlib
import re
import subprocess
import sys

HOME=pathlib.Path("/home/novaadmin/.pm2")
PM2="/usr/bin/pm2"
RUNUSER="/usr/sbin/runuser"
TARGET="betvima-notification-worker"

def status(v):
    return v if v in ("online","stopped","errored","launching","stopping","one-launch-status") else "other"

def summarize_daemon_line(line):
    low=line.lower()
    if TARGET not in low and "notification" not in low:
        return None
    signals=[
        ("too many unstable", "UNSTABLE_RESTARTS"),
        ("errored", "ERRORED"),
        ("online", "ONLINE"),
        ("starting", "STARTING"),
        ("launched", "LAUNCHED"),
        ("exited with code", "EXITED_WITH_CODE"),
        ("exit code", "EXIT_CODE"),
        ("deleted", "DELETED"),
        ("stopping", "STOPPING"),
        ("restart", "RESTART"),
        ("error", "ERROR"),
    ]
    for needle,label in signals:
        if needle in low:
            return label
    return "OTHER_NOTIFICATION_EVENT"

def classify_runtime_line(line):
    tests=[
        (r"ERR_MODULE_NOT_FOUND|MODULE_NOT_FOUND|Cannot find (?:module|package)", "MODULE_MISSING"),
        (r"ERR_UNKNOWN_FILE_EXTENSION|Unknown file extension", "TYPESCRIPT_LOADER_ERROR"),
        (r"SyntaxError", "SYNTAX_ERROR"),
        (r"TypeError", "TYPE_ERROR"),
        (r"ReferenceError", "REFERENCE_ERROR"),
        (r"EACCES|Permission denied", "PERMISSION_DENIED"),
        (r"ECONNREFUSED|connection refused", "CONNECT_REFUSED"),
        (r"ENOTFOUND|getaddrinfo", "DNS_FAILED"),
        (r"Missing (?:environment|config)|INVALID_ENVIRONMENT", "INVALID_ENVIRONMENT"),
        (r"ERR_REQUIRE_ESM|ERR_PACKAGE_PATH_NOT_EXPORTED", "NODE_MODULE_LOADER_ERROR"),
        (r"fatal|FATAL", "NODE_FATAL"),
        (r"Error:|error:", "OTHER_ERROR"),
    ]
    for needle,label in tests:
        if re.search(needle,line,re.I):
            return label
    return None

def main():
    print("DIAG_VERSION","read_only_pm2_v1",flush=True)
    if not pathlib.Path(PM2).is_file() or not pathlib.Path(RUNUSER).is_file():
        print("REQUIRED_COMMAND_MISSING")
        return
    res=subprocess.run([RUNUSER,"-u","novaadmin","--","env",
                       "PM2_HOME="+str(HOME),PM2,"jlist"],
                       capture_output=True,text=True,timeout=40)
    if res.returncode:
        print("PM2_JLIST_FAILED")
        return
    try:
        apps=json.loads(res.stdout)
    except Exception:
        print("PM2_JSON_INVALID")
        return
    print("PM2_APP_COUNT",len(apps))
    matching=[x for x in apps if ("notification" in str(x.get("name","")).lower())]
    print("NOTIFICATION_PM2_COUNT",len(matching))
    for x in matching[:8]:
        e=x.get("pm2_env") or {}
        print("NOTIFICATION_NAME",str(x.get("name",""))[:80])
        print("NOTIFICATION_STATUS",status(e.get("status")))
        print("NOTIFICATION_PID",x.get("pid") if isinstance(x.get("pid"),int) else "unknown")
        print("NOTIFICATION_RESTART_COUNT",e.get("restart_time") if isinstance(e.get("restart_time"),int) else "unknown")
        print("NOTIFICATION_EXIT_CODE",e.get("exit_code") if isinstance(e.get("exit_code"),int) else "unknown")
        print("NOTIFICATION_CWD_IS_RELEASE",str(e.get("pm_cwd","")).startswith("/opt/nova-releases/"))
        print("NOTIFICATION_SCRIPT_IS_EXPECTED",str(e.get("pm_exec_path","")).endswith("/src/workers/entrypoints/notification.worker.ts"))
        # A duplicate PM2 entry must be resolved before starting another.
    daemon=HOME/"pm2.log"
    if daemon.is_file():
        with daemon.open("rb") as f:
            f.seek(max(0,daemon.stat().st_size-512000))
            data=f.read().decode("utf-8","replace")
        events=[e for line in data.splitlines() if (e:=summarize_daemon_line(line))]
        print("PM2_DAEMON_NOTIFICATION_EVENTS",len(events))
        print("PM2_DAEMON_LAST_EVENTS",",".join(events[-20:]) if events else "none")
    else:
        print("PM2_DAEMON_LOG_MISSING")
    paths={p for p in (HOME/"logs").glob("*notification*") if p.is_file()}
    print("PM2_NOTIFICATION_LOG_FILES",len(paths))
    for p in sorted(paths,key=lambda f:f.stat().st_mtime,reverse=True)[:10]:
        print("LOG_KIND","stderr" if "error" in p.name or "err" in p.name else "stdout")
        print("LOG_BYTES",p.stat().st_size)
        with p.open("rb") as f:
            f.seek(max(0,p.stat().st_size-150000))
            content=f.read().decode("utf-8","replace")
        labels=[l for line in content.splitlines() if (l:=classify_runtime_line(line))]
        counts=collections.Counter(labels)
        print("LOG_DIAGNOSES",json.dumps(dict(counts),sort_keys=True))
        if labels: print("LOG_LAST_DIAGNOSIS",labels[-1])
    print("DIAGNOSTIC_COMPLETE")

if __name__=="__main__":
    try:main()
    except Exception as exc:
        print("DIAGNOSTIC_ERROR",type(exc).__name__)
        sys.exit(0)
