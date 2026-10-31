#!/usr/bin/env python3
"""Stage10 live callback phase call graph, static read-only and secret-safe.

Purpose: identify where to add scoped timers to separate LIVE RELEASE candidate.
No requests, database calls, environment inspection, application code changes,
wallet/real-money interactions, or raw source/log output.
"""
import hashlib
import re
from pathlib import Path
from collections import Counter

ROOT=Path("/opt/nova-releases/casino-3098-eligible-fallback-HU6Rbl")
EXPECT={
 "src/server/db/postgres.ts":"3d66c5724ff6",
 "src/server/providers/softaggregator/wallet.ts":"9df555a7e3f0",
 "src/server/providers/softaggregator/fiat-wallet.ts":"242410f73f8a",
 "src/app/api/webhooks/softaggregator/route.ts":"fca89762e8ff"
}
CALL=re.compile(r"\bawait\s+(?:(?:new\s+)?)([A-Za-z_$][\w$]*(?:\??\.[A-Za-z_$][\w$]*){0,4})\b")
FUNCTION=re.compile(
    r"^\s*(?:(?:export|default|async|declare|private|public|protected|static|const|let|function)\s+)*"
    r"([A-Za-z_$][\w$]*)\s*(?:=|<[^>]+>\s*=|\()"
)
ACTION=re.compile(r"\b(?:balance|debit|credit|rollback|reverseWin|reverse_win|refund|cancel)\b",re.I)
STAGES={
 "wallet_rpc":re.compile(r"\.rpc$|post_wallet_entry|debit_wallet|credit_wallet",re.I),
 "database_roundtrip":re.compile(r"db\.(?:query|queryOne|queryMany|transaction|rpc)|tx\.(?:query|queryOne|rpc)|pool\.(?:query|connect)|client\.query",re.I),
 "external_fx":re.compile(r"getUsdIrtRate|get[A-Za-z]*Rate|fetch|request",re.I),
 "authorization":re.compile(r"pilotCasinoDebitPermitted|limitAllows|limitsAllow|getProfile|readProfile|verify|validate|eligible|checkSignature",re.I),
 "wallet_binding":re.compile(r"readCasinoPlayerWallet|bindCasinoPlayerWallet|readWallet|walletRow",re.I),
 "round_receipt":re.compile(r"readOriginalRound|write[A-Za-z]*Receipt|insertReceipt|receipt",re.I),
 "parallel":re.compile(r"Promise\.all|Promise\.allSettled",re.I),
 "callback_entry":re.compile(r"withCasinoCallbackTimeoutReuse",re.I)
}
TARGETS={
 "wallet.ts":["getProfile","getUsdIrtRate","readCasinoPlayerWallet","bindCasinoPlayerWallet",
              "pilotCasinoDebitPermitted","readOriginalRound","walletRow","tx.query",
              "tx.queryOne","tx.rpc","db.queryOne","Promise.all"],
 "fiat-wallet.ts":["getUsdIrtRate","readProfile","readWallet","pilotCasinoDebitPermitted",
                   "limitsAllow","tx.query","tx.queryOne","tx.rpc","db.queryOne","Promise.all"],
 "postgres.ts":["this.pool.connect","this.pool.query","client.query","this.query","this.queryOne"],
 "route.ts":["withCasinoCallbackTimeoutReuse"]
}
def line_locations(text, identifier):
    # Only return integer line numbers for exact call tokens.
    return [i for i,line in enumerate(text.splitlines(),1)
            if re.search(r"(?<![\w$])"+re.escape(identifier)+r"\s*(?:\(|\?)",line)]
def main():
    print("STAGE10_PHASE_MAP_SOURCE_READONLY=true",flush=True)
    if not ROOT.is_dir():
        print("STAGE10_PHASE_MAP=EXPECTED_RELEASE_MISSING",flush=True)
        return 1
    bad=False
    for path,sha in EXPECT.items():
        p=ROOT/path
        if not p.is_file():
            print("STAGE10_SOURCE="+path+" STATUS=MISSING",flush=True)
            bad=True
            continue
        source=p.read_bytes()
        hash12=hashlib.sha256(source).hexdigest()[:12]
        if hash12!=sha:
            print("STAGE10_SOURCE="+path+" STATUS=CHANGED_UNEXPECTED_HASH",flush=True)
            bad=True
            continue
        txt=source.decode("utf8","replace")
        tokens=CALL.findall(txt)
        print("STAGE10_SOURCE="+path+" HASH_VERIFIED=true AWAIT_STATIC_COUNT="+str(len(tokens)),flush=True)
        counts={name:sum(bool(pattern.search(token)) for token in tokens)
                for name,pattern in STAGES.items()}
        print("STAGE10_AWAIT_CLASS_COUNTS="+
              " ".join(k+"="+str(v) for k,v in counts.items()),flush=True)
        basename=p.name
        for token in TARGETS.get(basename,[]):
            # Use only fixed token names; raw code, SQL strings, URLs and secrets never printed.
            lines=line_locations(txt,token)
            if lines:
                print("STAGE10_CALLSITE="+token+" COUNT="+str(len(lines))+
                      " LINES="+",".join(str(x) for x in lines[:20]),flush=True)
        print("STAGE10_NESTED_SQL_CALL_TOKENS="+str(len(re.findall(r"\b(?:db|tx|client|pool)\.(?:query|queryOne|queryMany|rpc|transaction|connect)\s*\(",txt))),flush=True)
        print("STAGE10_SEQUENTIAL_WAIT_TOKENS="+str(len(re.findall(r"\bawait\b",txt))),flush=True)
    print("STAGE10_SOURCE_FINGERPRINTS="+("UNEXPECTED" if bad else "ALL_MATCH"),flush=True)
    print("STAGE10_SQL_QUERIES_EXECUTED=0",flush=True)
    print("STAGE10_NETWORK_REQUESTS_SENT=0",flush=True)
    print("STAGE10_CASINO_PORT_3098_CHANGED=false",flush=True)
    print("STAGE10_SOURCE_OR_ENV_CHANGED=false",flush=True)
    print("STAGE10_RAW_SOURCE_PRINTED=false",flush=True)
    print("STAGE10_PHASE_MAP_DONE=true",flush=True)
    return 1 if bad else 0
if __name__=="__main__":raise SystemExit(main())
