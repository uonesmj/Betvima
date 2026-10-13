#!/usr/bin/env python3
"""Diagnose BetVima email worker DB failures read-only without leaking secrets.
Never sends emails or changes PM2, balances, vouchers or the database.
"""
from __future__ import annotations
import collections
import json
import os
import pathlib
import re
import subprocess

PM2HOME="/home/novaadmin/.pm2"
WORKER="betvima-notification-worker"

RULES=[
 ("DB_TLS_CERTIFICATE",r"self.signed.certificate|unable to verify|certificate (?:has expired|verify failed)|ERR_TLS|UNABLE_TO_VERIFY_LEAF_SIGNATURE|SELF_SIGNED_CERT"),
 ("DB_AUTHENTICATION",r"password authentication failed|authentication failed|SASL|invalid password|28P01"),
 ("DB_NETWORK_DNS",r"ENOTFOUND|EAI_AGAIN|could not translate host|name or service not known"),
 ("DB_NETWORK_REFUSED",r"ECONNREFUSED|connection refused"),
 ("DB_NETWORK_TIMED_OUT",r"ETIMEDOUT|Connection terminated unexpectedly|connection timed out|timeout exceeded|Connection terminated due to connection timeout"),
 ("DB_HOST_RESTRICTED",r"no pg_hba.conf entry|not allowed to connect|access denied for user"),
 ("DB_URL_FORMAT",r"Invalid URL|invalid connection string|unsupported protocol"),
 ("DB_SSL_SETUP",r"SSL is not enabled|SSL required|sslmode|client certificate"),
 ("DB_SCHEMA_TABLE",r"relation .+ does not exist|schema .+ does not exist|42P01|3F000"),
 ("DB_SCHEMA_COLUMN",r"column .+ does not exist|42703"),
 ("DB_SCHEMA_PERMISSION",r"permission denied for (?:schema|table|function)|42501"),
 ("DB_FUNCTION",r"function .+ does not exist|42883"),
 ("DB_POOL",r"too many clients|remaining connection slots|53300"),
 ("DB_IPV6",r"ENETUNREACH|Network is unreachable|EHOSTUNREACH"),
 ("DB_PASSWORD_NOT_STRING",r"client password must be a string"),
 ("APP_CONFIGURATION",r"SUPABASE_DB_URL_REQUIRED|SUPABASE_SERVICE_ROLE_NOT_CONFIGURED|INVALID_ENVIRONMENT|Env validation"),
 ("WORKER_LOCK",r"acquire_worker_lock|release_worker_lock"),
 ("DB_OTHER_POSTGRES_CODE",r"SQLSTATE|postgres|database error|query failed"),
]
EVENTS=("heartbeat failed","loop error","tick failed","job failed")
def classify(line):
    for name,exp in RULES:
        if re.search(exp,line,re.IGNORECASE):
            return name
    return "OTHER_UNCLASSIFIED"
def env_snapshot(pid):
    try:
        raw=(pathlib.Path("/proc")/str(pid)/"environ").read_bytes()
        result={}
        for part in raw.split(b"\x00"):
            if b"=" in part:
                k,v=part.split(b"=",1)
                result[k.decode("ascii","ignore")]=v
        return result
    except Exception:
        return None
def apps():
    p=subprocess.run(["/usr/sbin/runuser","-u","novaadmin","--",
        "/usr/bin/env","PM2_HOME="+PM2HOME,"/usr/bin/pm2","jlist"],
        capture_output=True,text=True,timeout=40)
    if p.returncode: return None
    return json.loads(p.stdout)
def main():
    a=apps()
    if not isinstance(a,list):
        print("PM2_READ_UNAVAILABLE");return
    matches=[x for x in a if x.get("name")==WORKER]
    if len(matches)!=1:
        print("WORKER_COUNT",len(matches));return
    worker=matches[0]
    pid=worker.get("pid")
    if not isinstance(pid,int) or pid<1:
        print("WORKER_PID_INVALID");return
    environment=env_snapshot(pid)
    print("WORKER_STATUS",worker.get("pm2_env",{}).get("status"))
    print("WORKER_PID",pid)
    if environment is None:
        print("PROCESS_ENV_UNAVAILABLE")
    else:
        for key in ("SUPABASE_DB_URL","DATABASE_URL","PGSSLMODE","PGSSLROOTCERT","NODE_EXTRA_CA_CERTS"):
            print("HAS_"+key, bool(environment.get(key)))
        for key in ("PGSSLROOTCERT","NODE_EXTRA_CA_CERTS"):
            raw=environment.get(key,b"")
            try:
                if raw: print(key+"_FILE_EXISTS",pathlib.Path(os.fsdecode(raw)).is_file())
            except Exception:
                print(key+"_FILE_EXISTS","unknown")
        for label in ("betvima-odds-worker","betvima-live-odds-worker","nova"):
            peers=[x for x in a if x.get("name")==label and isinstance(x.get("pid"),int) and x.get("pid")>0]
            if not peers:continue
            peer=env_snapshot(peers[0]["pid"])
            if not peer:continue
            for key in ("SUPABASE_DB_URL","DATABASE_URL","NODE_EXTRA_CA_CERTS"):
                k=key
                if environment.get(k) and peer.get(k):
                    print("DB_CONFIG_EQUALS_"+label+"_"+key,environment[k]==peer[k])
            break
    e=worker.get("pm2_env",{})
    paths=[e.get("pm_out_log_path"),e.get("pm_err_log_path")]
    labels=collections.Counter()
    eventcounts=collections.Counter()
    for item in paths:
        if not isinstance(item,str) or not item.startswith("/"):continue
        path=pathlib.Path(item)
        if not path.is_file():continue
        with path.open("rb") as f:
            f.seek(max(0,path.stat().st_size-1100000))
            lines=f.read().decode("utf-8","replace").splitlines()
        for line in lines:
            if any(e in line for e in EVENTS):
                event=next(e for e in EVENTS if e in line)
                eventcounts[event]+=1
                labels[classify(line)]+=1
    print("ERROR_EVENT_COUNTS",json.dumps(eventcounts,sort_keys=True))
    print("ERROR_CLASS_COUNTS",json.dumps(labels,sort_keys=True))
    print("READ_ONLY_DIAGNOSTIC_COMPLETE")
if __name__=="__main__":
    try:main()
    except Exception as exc:
        print("DIAGNOSTIC_FAILED",type(exc).__name__)
