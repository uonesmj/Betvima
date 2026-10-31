#!/usr/bin/env python3
"""BetVima Stage10 source/rollback preflight (read-only, no secret output).

Examines only explicit source files in the known current active and older candidate
release directories and the listening status for 3098. Never sends requests,
opens a DB connection, changes routing, touches accounts or prints file contents,
environment variables, process command lines, provider URLs or credentials.
"""
from __future__ import annotations
import hashlib
import os
import re
import subprocess
from collections import Counter
from pathlib import Path

LIVE=Path("/opt/nova-releases/casino-3098-eligible-fallback-HU6Rbl")
CANDIDATE=Path("/opt/nova-releases/casino-callback-rtt4-20261026")
FILES=(
    "src/server/db/postgres.ts",
    "src/server/providers/softaggregator/wallet.ts",
    "src/server/providers/softaggregator/fiat-wallet.ts",
    "src/app/api/webhooks/softaggregator/route.ts",
    "src/app/api/v1/wallet/balance/route.ts",
    "src/server/wallet/balance-snapshot.ts",
    "src/components/layout/top-wallet-balance.tsx",
)
CATEGORIES={
    "DATABASE":r"(?i)\b(?:sql|query|execute|pg|postgres|rpc|transaction|db|pool|wallets|receipt)\b",
    "PROVIDER":r"(?i)\b(?:softaggregator|provider|fetch|axios|http|request|rate|fx|currency|quote)\b",
    "WALLET":r"(?i)\b(?:post_wallet_entry|debit|credit|balance|settlement|reversal|rollback|idempotency)\b",
}
AWAITS=re.compile(r"\bawait\s+([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*){0,3})")
ROUTE_KEYWORDS=(
  "SOFTAGGREGATOR_CALLBACK_EDGE_READY",
  "SOFTAGGREGATOR_EDGE_HMAC_SECRET",
  "SOFTAGGREGATOR_TEST_USER_ID",
  "SOFTAGGREGATOR_ALLOWED_COUNTRIES",
  "SOFTAGGREGATOR_REAL_MONEY_ENABLED",
)
def fingerprint(p:Path):
    if not p.is_file() or not p.resolve().is_relative_to(p.parent.resolve()):
        return None
    if p.stat().st_size>2_000_000:
        return {"too_large":True}
    raw=p.read_bytes()
    return {"sha":hashlib.sha256(raw).hexdigest()[:12],
            "source":raw.decode("utf8","replace")}
def shape(name:str, live:dict|None, cand:dict|None):
    label=name.replace("/","_").replace(".","_").replace("-","_").upper()
    if not live:
        print("STAGE10_FILE_"+label+"=MISSING_ACTIVE_RELEASE")
        return
    if live.get("too_large"):
        print("STAGE10_FILE_"+label+"=TOO_LARGE_FOR_READONLY")
        return
    src=live["source"]
    print("STAGE10_FILE_"+label+"=PRESENT SHA12="+live["sha"]+
          " CANDIDATE="+("SAME" if cand and cand.get("sha")==live["sha"] else
                       "DIFFERENT" if cand and cand.get("sha") else "MISSING"))
    matches=AWAITS.findall(src)
    counts=Counter()
    for call in matches:
        for category,pattern in CATEGORIES.items():
            if re.search(pattern,call):counts[category]+=1
    print("STAGE10_SOURCE_"+label+
          " AWAIT_COUNT="+str(len(matches))+
          " AWAIT_DATABASE_LIKE="+str(counts["DATABASE"])+
          " AWAIT_PROVIDER_LIKE="+str(counts["PROVIDER"])+
          " AWAIT_WALLET_LIKE="+str(counts["WALLET"])+
          " FETCH_CALL_COUNT="+str(len(re.findall(r'\bfetch\s*\(',src)))+
          " RPC_CALL_COUNT="+str(len(re.findall(r'\.rpc\s*\(',src)))+
          " SET_INTERVAL_COUNT="+str(len(re.findall(r'\bsetInterval\s*\(',src))))
    if "webhooks_softaggregator" in label.lower() or "softaggregator" in name:
        print("STAGE10_CALLBACK_GUARD_NAMES_"+label+"="+
              ",".join(k+"="+("present" if k in src else "not_seen") for k in ROUTE_KEYWORDS))
    # Pure identifier names, never raw code, strings, args, accounts, secrets.
    calls=[]
    for token in matches:
        if token not in calls and len(calls)<25:calls.append(token)
    print("STAGE10_AWAIT_IDENTIFIERS_"+label+"="+
          (",".join(calls) if calls else "NONE"))
def active_process():
    try:
        result=subprocess.run(["ss","-ltnpH"],capture_output=True,
                              text=True,timeout=6,check=True)
    except Exception:
        print("STAGE10_PORT_3098=UNKNOWN")
        return
    ports=[row for row in result.stdout.splitlines()
           if re.search(r":3098(?:\s|$)",row)]
    if not ports:
        print("STAGE10_PORT_3098=NOT_LISTENING")
        return
    print("STAGE10_PORT_3098=LISTENING")
    pids={int(x) for row in ports for x in re.findall(r"pid=(\d+)",row)}
    cwd=[]
    for pid in pids:
        try:cwd.append(Path(os.readlink("/proc/"+str(pid)+"/cwd")).resolve())
        except OSError:pass
    state=("MATCHES_EXPECTED_RELEASE" if LIVE.resolve() in cwd else
           "UNVERIFIED_CWD" if not cwd else "DIFFERENT_RELEASE_CWD")
    print("STAGE10_LISTENER_RELEASE="+state)
def main():
    print("STAGE10_PREFLIGHT_READONLY=true")
    print("STAGE10_MAIN_FINANCE_WRITES=0")
    print("STAGE10_FINANCIAL_CALLBACK_REQUESTS_SENT=0")
    print("STAGE10_CASINO_3098_RESTARTED=false")
    print("STAGE10_PRIVATE_KEYS_PRINTED=false")
    print("STAGE10_LIVE_RELEASE_EXISTS="+str(LIVE.is_dir()).lower())
    print("STAGE10_OLD_CANDIDATE_EXISTS="+str(CANDIDATE.is_dir()).lower())
    active_process()
    for name in FILES:
        shape(name,fingerprint(LIVE/name),fingerprint(CANDIDATE/name))
    print("STAGE10_NO_ACTIVATION_OR_CUTOVER=true")
    print("STAGE10_PREFLIGHT_DONE=true")
if __name__=="__main__":
    main()
