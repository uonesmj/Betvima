#!/usr/bin/env python3
"""BetVima live, read-only, anonymized Spin callback timing recorder.

Run on VPS as root; observes existing Nginx timing logs, does not request,
sign or alter any callback or wallet. Does NOT collect query strings,
signatures, identities, amounts, source IPs, or environment variables.
"""
import os, re, sys, time, statistics, hashlib
from pathlib import Path
from collections import defaultdict
LIVE=Path("/opt/nova-releases/casino-3098-eligible-fallback-HU6Rbl")
LOG=Path("/var/log/nginx/betvima-casino-callback-timing.log")
CAND=Path("/opt/nova-releases/casino-callback-rtt4-20261026")
LIMIT=180

def tag(line):
    # Extract only a whitelisted callback action; never log the raw line.
    m=re.search(r'(?:^|[\s",{;])(?:cb_action|action|act|callback_action)\s*[:=]\s*["\x27]?(balance|debit|credit|rollback|reverse_win|reverse_win_credit)',line,re.I)
    if m:return m.group(1).lower()
    m=re.search(r'(?:[?&]action=|[?&]type=)(balance|debit|credit|rollback)(?:[&\s"\x27]|$)',line,re.I)
    if m:return m.group(1).lower()
    # Last resort matching known single-word action in any log field
    m=re.search(r'\b(balance|debit|credit|rollback)\b',line,re.I)
    return m.group(1).lower() if m else "unknown"

def field(line,names):
    for name in names:
        pattern=r'(?:^|[\s,{;"])(?:'+re.escape(name)+r')\s*[:=]\s*["\x27]?([0-9]+(?:\.[0-9]+)?)'
        m=re.search(pattern,line,re.I)
        if m:
            value=float(m.group(1))
            return value if 0<=value<120 else None
    return None

def status(line):
    m=re.search(r'(?:^|[\s,{;"])(?:status|code)\s*[:=]\s*["\x27]?(\d{3})\b',line,re.I)
    if m:return int(m.group(1))
    m=re.search(r'"\s+(\d{3})\s+(?:\d+|-)(?:\s|$)',line)
    if m:return int(m.group(1))
    return None

def parse(line):
    # do not print lines: raw callback URLs contain secret tokens
    rt=field(line,["request_time","rt","time_total","requestTime"])
    ut=field(line,["upstream_response_time","urt","upstream_time","upstreamTime"])
    action=tag(line)
    code=status(line)
    return {"action":action,"rt":rt,"ut":ut,"status":code}

def med(values):
    return round(statistics.median(values)*1000,1) if values else None

def summary(events,label):
    print(f"===== {label} =====",flush=True)
    if not events:
        print("NO_CALLBACK_EVENTS",flush=True)
        return
    by=defaultdict(list)
    for ev in events:by[ev["action"]].append(ev)
    for action in sorted(by):
        rows=by[action]
        good=[v["rt"] for v in rows if v["rt"] is not None]
        upstream=[v["ut"] for v in rows if v["ut"] is not None]
        errors=sum(1 for v in rows if v["status"] is not None and v["status"]!=200)
        print(f"CALLBACK_ACTION={action} COUNT={len(rows)} ERRORS={errors} "
              f"REQUEST_MEDIAN_MS={med(good)} UPSTREAM_MEDIAN_MS={med(upstream)} "
              f"REQUEST_MAX_MS={round(max(good)*1000,1) if good else 'NA'}",flush=True)

def check_pid():
    import subprocess
    r=subprocess.run(["ss","-ltnpH"],capture_output=True,text=True,timeout=5,check=True)
    ids=set()
    for line in r.stdout.splitlines():
        if re.search(r":3098(?:\s|$)",line):
            ids.update(int(x) for x in re.findall(r"pid=(\d+)",line))
    if not ids:raise RuntimeError("PORT_3098_NOT_FOUND")
    paths=[]
    for pid in ids:
        try:paths.append(Path(os.readlink(f"/proc/{pid}/cwd")).resolve())
        except OSError:continue
    if LIVE.resolve() not in paths:raise RuntimeError("LIVE_3098_RELEASE_MISMATCH")
    return True

def source_fingerprint():
    print("===== REAL ACTIVE RELEASE SOURCE SAFETY =====",flush=True)
    for path in ("src/server/db/postgres.ts",
                 "src/server/providers/softaggregator/wallet.ts",
                 "src/server/providers/softaggregator/fiat-wallet.ts",
                 "src/app/api/webhooks/softaggregator/route.ts"):
        a,b=LIVE/path,CAND/path
        if not a.is_file():
            print(f"SOURCE={path} LIVE_MISSING",flush=True);continue
        raw=a.read_bytes()
        count=len(re.findall(r"\bawait\s+",raw.decode("utf8","replace")))
        match=b.is_file() and hashlib.sha256(raw).digest()==hashlib.sha256(b.read_bytes()).digest()
        print(f"SOURCE={path} LIVE_SHA256_12={hashlib.sha256(raw).hexdigest()[:12]} "
              f"AWAIT_COUNT={count} RTT4_SAME={str(match).lower()} "
              f"RTT4_PRESENT={str(b.is_file()).lower()}",flush=True)

def main():
    print("BETVIMA_REAL_ACCOUNT_CALLBACK_TIMING_READ_ONLY=true",flush=True)
    try:check_pid()
    except Exception as e:
        print("ERROR=PRODUCTION_GUARD_"+str(e),flush=True);return 1
    print("ACTIVE_RELEASE_3098=VERIFIED",flush=True)
    if not LOG.is_file():
        print("ERROR=DEDICATED_NGINX_TIMING_LOG_NOT_FOUND",flush=True);return 1
    source_fingerprint()
    with LOG.open("r",encoding="utf-8",errors="replace") as fh:
        historical=list(__import__("collections").deque(fh,maxlen=100))
        before=[parse(x) for x in historical if "/api/webhooks/softaggregator" in x or tag(x)!="unknown"]
        before=[x for x in before if x["rt"] is not None]
        summary(before[-40:],"LATEST_EXISTING_REAL_CALLBACK_BASELINE")
        if not before:
            print("ERROR=NO_PARSEABLE_EXISTING_REQUEST_TIME",flush=True)
            print("TIMER_NOT_STARTED_AVOID_USELESS_LIVE_SPIN",flush=True)
            return 2
        # From this point only newly appended log entries are measured.
        fh.seek(0,os.SEEK_END)
        inode=os.fstat(fh.fileno()).st_ino
        seen=[]
        started=time.monotonic()
        print("===== LIVE WINDOW =====",flush=True)
        print("PERFORM_1_OR_2_ELIGIBLE_TEST_SPINS_IN_YOUR_OWN_APP_NOW=true",flush=True)
        print("STOP_AFTER_SPINS=CTRL_C",flush=True)
        try:
            while time.monotonic()-started<LIMIT:
                row=fh.readline()
                if row:
                    if "/api/webhooks/softaggregator" not in row and tag(row)=="unknown":continue
                    ev=parse(row)
                    seen.append(ev)
                    print(f"NEW_CALLBACK_ACTION={ev['action']} STATUS={ev['status']} "
                          f"REQUEST_MS={round(ev['rt']*1000,1) if ev['rt'] is not None else 'NA'} "
                          f"UPSTREAM_MS={round(ev['ut']*1000,1) if ev['ut'] is not None else 'NA'}",flush=True)
                    continue
                try:
                    if LOG.stat().st_ino!=inode:
                        fh.close();fh=LOG.open("r",encoding="utf-8",errors="replace")
                        inode=os.fstat(fh.fileno()).st_ino
                except OSError:pass
                time.sleep(.2)
        except KeyboardInterrupt:
            print("LIVE_WINDOW_STOPPED_BY_OPERATOR=true",flush=True)
        summary(seen,"ACCOUNT_SPIN_WINDOW_CALLBACK_METRICS")
        print(f"NEW_CALLBACK_COUNT={len(seen)}",flush=True)
        print("FINANCIAL_WRITES_BY_THIS_SCRIPT=0",flush=True)
        print("PRODUCTION_SOURCE_OR_CONFIG_CHANGED_BY_THIS_SCRIPT=false",flush=True)
        print("END=true",flush=True)
    return 0

if __name__=="__main__":
    sys.exit(main())
