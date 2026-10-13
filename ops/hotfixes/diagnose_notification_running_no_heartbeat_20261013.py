#!/usr/bin/env python3
"""Read-only diagnosis of an online PM2 notification worker that does not update Supabase.
Never starts/stops processes, calls external APIs, or prints secrets and message contents.
"""
import json
import os
import pathlib
import re
import subprocess

HOME=pathlib.Path("/home/novaadmin/.pm2")
NAME="betvima-notification-worker"
ERROR_LABELS=[
    ("heartbeat failed","HEARTBEAT_FAILED"),
    ("loop error","WORKER_LOOP_ERROR"),
    ("tick failed","WORKER_TICK_FAILED"),
    ("job failed","JOB_FAILED"),
    ("ECONNREFUSED","CONNECTION_REFUSED"),
    ("ENOTFOUND","DNS_FAILURE"),
    ("PGRST","SUPABASE_API_FAILURE"),
    ("JWT","AUTH_FAILURE"),
    ("permission denied","ACCESS_DENIED"),
    ("authentication failed","AUTH_FAILURE"),
    ("password authentication failed","DATABASE_AUTH_FAILED"),
    ("relation ","DATABASE_RELATION_MISSING"),
    ("TypeError","TYPE_ERROR"),
    ("ReferenceError","REFERENCE_ERROR"),
    ("ERR_MODULE_NOT_FOUND","MODULE_MISSING"),
    ("MODULE_NOT_FOUND","MODULE_MISSING"),
    ("Cannot find module","MODULE_MISSING"),
    ("Cannot find package","MODULE_MISSING"),
    ("Error:","GENERIC_ERROR"),
    ("worker started","WORKER_STARTED"),
    ("provider registry resolved","PROVIDER_REGISTRY_INITIALIZED"),
    ("worker stopped","WORKER_STOPPED"),
    ("sending","SENDING_EVENT"),
    ("notification","NOTIFICATION_EVENT"),
]
def classify(line):
    for token,label in ERROR_LABELS:
        if token.lower() in line.lower():
            return label
    return None

def main():
    p=subprocess.run(["/usr/sbin/runuser","-u","novaadmin","--",
        "/usr/bin/env","PM2_HOME="+str(HOME),"/usr/bin/pm2","jlist"],
        capture_output=True,text=True,timeout=45)
    if p.returncode:
        print("PM2_QUERY_FAILED");return
    apps=json.loads(p.stdout)
    found=[a for a in apps if a.get("name")==NAME]
    print("PM2_NOTIFICATION_COUNT",len(found))
    if len(found)!=1:
        print("STOP_UNEXPECTED_PROCESS_COUNT");return
    app=found[0]
    e=app.get("pm2_env") or {}
    pid=app.get("pid")
    print("PM2_STATUS",e.get("status") if e.get("status") in
          ("online","errored","stopped","launching") else "unknown")
    print("PID",pid if isinstance(pid,int) else "unknown")
    print("RESTART_COUNT",e.get("restart_time") if isinstance(e.get("restart_time"),int) else "unknown")
    print("EXIT_CODE",e.get("exit_code") if isinstance(e.get("exit_code"),int) else "unknown")
    print("SOURCE_RELEASE",pathlib.Path(str(e.get("pm_cwd") or "")).name[:52])
    print("EXECUTABLE_IS_NODE",str(e.get("pm_exec_path") or "")=="/usr/bin/node")
    print("INTERPRETER_NONE",str(e.get("exec_interpreter") or "").lower()=="none")
    args=e.get("args") or []
    print("NODE_ARGS_HAS_TSX",any("tsx" in str(x) for x in args))
    print("NODE_ARGS_HAS_ENTRYPOINT",any("notification.worker.ts" in str(x) for x in args))
    env=e
    if isinstance(pid,int) and pid>0:
        try:
            raw=(pathlib.Path("/proc")/str(pid)/"environ").read_bytes()
            present={}
            for entry in raw.split(b"\\x00"):
                if b"=" not in entry:continue
                k=entry.split(b"=",1)[0].decode("ascii","ignore")
                present[k]=True
            for k in ("SUPABASE_DB_URL","DATABASE_URL","DB_DRIVER",
                      "RESEND_API_KEY","RESEND_FROM_EMAIL","NOVA_WORKER_ONCE","WORKER_ID"):
                print("PROCESS_HAS_"+k,k in present)
        except Exception:
            print("PROCESS_ENV_READ_UNAVAILABLE")
    for kind,key in (("STDOUT","pm_out_log_path"),("STDERR","pm_err_log_path")):
        val=e.get(key) or app.get(key)
        path=pathlib.Path(val) if isinstance(val,str) and val.startswith("/") else None
        if not path or not path.is_file():
            print(kind+"_LOG_STATUS","MISSING")
            continue
        n=path.stat().st_size
        print(kind+"_LOG_BYTES",n)
        with path.open("rb") as f:
            f.seek(max(0,n-750000))
            s=f.read().decode("utf-8","replace")
        events=[label for line in s.splitlines() if (label:=classify(line))]
        from collections import Counter
        print(kind+"_CLASSIFIED_COUNTS",json.dumps(Counter(events),sort_keys=True))
        print(kind+"_LAST_EVENTS",",".join(events[-18:]) if events else "none")
    print("READ_ONLY_DIAGNOSTIC_COMPLETE")

if __name__=="__main__":
    try:main()
    except Exception as err:print("READ_ONLY_DIAGNOSTIC_FAILED",type(err).__name__)
