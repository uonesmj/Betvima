#!/usr/bin/env python3
"""Stage10 live performance critical-path candidate audit: READ ONLY.

This verifies pinned deployed source hashes; prints only fixed allowlisted
classification labels, line numbers and source-relative filenames.
It never emits raw source, secrets, SQL, URL, environment or callback payloads.
No real user transactions, no API calls, no changes to live server.
"""
from pathlib import Path
import hashlib, re, sys

ROOT=Path("/opt/nova-releases/casino-3098-eligible-fallback-HU6Rbl")
PINNED={
 "src/server/db/postgres.ts":"3d66c5724ff6",
 "src/server/providers/softaggregator/wallet.ts":"9df555a7e3f0",
 "src/server/providers/softaggregator/fiat-wallet.ts":"242410f73f8a",
 "src/app/api/webhooks/softaggregator/route.ts":"fca89762e8ff",
}
PHASES={
 "FX_RATE":r"\b(?:getUsdIrtRate|get[A-Za-z]*ExchangeRate|quote|fetch)\s*\(",
 "PROFILE":r"\b(?:getProfile|readProfile|profileRow)\s*\(",
 "WALLET_ROW":r"\b(?:readWallet|readCasinoPlayerWallet|walletRow)\s*\(",
 "BIND_WALLET":r"\bbindCasinoPlayerWallet\s*\(",
 "RISK_GUARD":r"\b(?:pilotCasinoDebitPermitted|limitsAllow|limitAllows)\s*\(",
 "ROUND_LOOKUP":r"\breadOriginalRound\s*\(",
 "QUERY":r"\b(?:db|tx|pool|client|this\.pool)\.(?:query|queryOne|queryMany|connect)\s*\(",
 "ATOMIC_RPC":r"\b(?:db|tx)\.rpc\s*\(",
 "PARALLEL":r"\bPromise\.(?:all|allSettled)\s*\(",
 "HANDLER":r"\bwithCasinoCallbackTimeoutReuse\s*\(",
}
REGEXES={name:re.compile(pattern) for name,pattern in PHASES.items()}

def read_pinned(path,sha):
    p=ROOT/path
    if not p.is_file() or p.stat().st_size>250000:
        raise RuntimeError("FILE_MISSING_OR_TOO_LARGE")
    data=p.read_bytes()
    if hashlib.sha256(data).hexdigest()[:12]!=sha:
        raise RuntimeError("SOURCE_FINGERPRINT_CHANGED")
    return data.decode("utf8","replace")

def relevant_lines(code):
    output=[]
    for number,line in enumerate(code.splitlines(),1):
        if "await" not in line:continue
        for name,pattern in REGEXES.items():
            if pattern.search(line):
                output.append((number,name))
    return output

def fx_sources():
    scan=ROOT/"src/server"
    if not scan.is_dir():
        print("STAGE10_FX_IMPLEMENTATION=NOT_SEARCHABLE")
        return
    hits=[]
    for path in scan.rglob("*.ts"):
        if "node_modules" in path.parts or path.stat().st_size>160000:
            continue
        try: text=path.read_text("utf8",errors="replace")
        except OSError:continue
        if not re.search(r"\bgetUsdIrtRate\b",text):continue
        hits.append((str(path.relative_to(ROOT)),text))
    print("STAGE10_FX_REFERENCE_FILES="+str(len(hits)))
    for rel,text in hits[:12]:
        # Only paths within application src/server; never any source body or URLs.
        text_path=re.sub(r"[^a-zA-Z0-9_/.-]","",rel)
        definition=bool(re.search(r"(?:function|const|let|async)\s+getUsdIrtRate\b",text))
        is_module=bool(re.search(r"\bexport\b",text))
        has_net=bool(re.search(r"\b(fetch|axios|undici|request)\s*\(",text))
        has_cache=bool(re.search(r"\b(cache|cached|Cache|unstable_cache|Redis|ttl|TTL)\b",text))
        has_timeout=bool(re.search(r"\b(?:AbortSignal\.timeout|setTimeout|timeoutMs|timeout)\b",text))
        print("STAGE10_FX_PATH="+text_path+
              " IMPLEMENTS="+str(definition).lower()+
              " EXPORTED="+str(is_module).lower()+
              " HTTP_CALL_TOKEN="+str(has_net).lower()+
              " CACHE_TOKEN="+str(has_cache).lower()+
              " TIMEOUT_TOKEN="+str(has_timeout).lower())

def main():
    print("STAGE10_CRITICAL_PATH_AUDIT=READ_ONLY")
    print("STAGE10_RELEASE=KNOWN_3098")
    try:
        code={path:read_pinned(path,hash12) for path,hash12 in PINNED.items()}
    except RuntimeError as err:
        print("STAGE10_FAIL_CLOSED="+str(err))
        return 2
    for path,text in code.items():
        label=Path(path).name.replace(".","_").upper()
        if path.endswith("/wallet.ts") and "fiat-wallet.ts" not in path:
            label="USD_WALLET"
        elif path.endswith("/fiat-wallet.ts"):label="FIAT_WALLET"
        elif path.endswith("/postgres.ts"):label="POSTGRES_ADAPTER"
        elif path.endswith("/route.ts"):label="CALLBACK_ROUTE"
        items=relevant_lines(text)
        print("STAGE10_SECTION="+label+" AWAITED_PHASE_MARKERS="+str(len(items)))
        for num,phase in items:
            print("STAGE10_PHASE_CALLSITE="+label+":"+phase+":"+str(num))
    db=code["src/server/db/postgres.ts"]
    print("STAGE10_DB_POOL_CONSTRUCTOR_COUNT="+str(len(re.findall(r"\bnew\s+Pool\s*\(",db))))
    print("STAGE10_DB_CONNECTION_REUSE_TOKENS="+str(len(re.findall(r"\b(?:this\.pool|pool)\b",db))))
    print("STAGE10_DB_CONNECTION_TIMEOUT_CONFIG_PRESENT="+str("connectionTimeoutMillis" in db).lower())
    print("STAGE10_DB_IDLE_TIMEOUT_CONFIG_PRESENT="+str("idleTimeoutMillis" in db).lower())
    print("STAGE10_DB_POOL_MAX_CONFIG_PRESENT="+str(bool(re.search(r"\bmax\s*:",db))).lower())
    fx_sources()
    print("STAGE10_CAUTION=STATIC_CALLS_NOT_PER_SPIN_TIMINGS")
    print("STAGE10_NO_CALLBACKS_SENT=true")
    print("STAGE10_NO_PRODUCTION_DB_QUERIES=true")
    print("STAGE10_NO_PRODUCTION_CHANGES=true")
    print("STAGE10_RAW_SOURCE_OR_SECRETS_PRINTED=false")
    print("STAGE10_CRITICAL_PATH_AUDIT_DONE=true")
    return 0
if __name__=="__main__":sys.exit(main())
