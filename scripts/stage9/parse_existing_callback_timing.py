#!/usr/bin/env python3
"""Stage9 existing Nginx callback latency inspection. READ-ONLY.
Raw log lines may include secrets (callback query strings, IP, signature).
Only fixed whitelisted aggregates leave this process.
"""
import collections, math, re, statistics, sys
from pathlib import Path

SOURCES=(
  Path("/var/log/nginx/betvima-casino-callback-timing.log"),
  Path("/var/log/nginx/betvima-casino-callback-timing.log.1"),
)
KEYS={
  "request_time":"seconds",
  "request_time_s":"seconds",
  "request_time_ms":"ms",
  "rt":"seconds",
  "upstream_response_time":"seconds",
  "upstream_time":"seconds",
  "urt":"seconds",
  "upstream_response_time_ms":"ms",
}
VALUE=lambda name: re.compile(
    r'(?<![a-zA-Z0-9_])["\']?'+re.escape(name)+r'["\']?\s*(?:=|:)\s*["\']?([0-9]+(?:\.[0-9]+)?)',re.I)
DURATIONS={key:VALUE(key) for key in KEYS}
ACTION=re.compile(r'(?:[?&]|["\']?)(?:action|type|cb_action|callback_action)["\']?\s*(?:=|:)\s*["\']?(balance|debit|credit|rollback|reversal)\b',re.I)
ACTION_FALLBACK=re.compile(r'\b(balance|debit|credit|rollback|reversal)\b',re.I)
STATUS=re.compile(r'(?<![a-zA-Z0-9_])["\']?(?:status|http_status|code)["\']?\s*(?:=|:)\s*["\']?([1-5]\d\d)\b',re.I)
STATUS_NGINX=re.compile(r'"\s+([1-5]\d\d)\s+(?:\d+|-)(?:\s|$)')
def duration(line,key):
    m=DURATIONS[key].search(line)
    if not m:return None
    v=float(m.group(1))
    if not math.isfinite(v) or v<0 or v>120:return None
    if KEYS[key]=="seconds":v*=1000
    return round(v,2)
def quantile(xs,p):
    if not xs:return "NA"
    s=sorted(xs);pos=(len(s)-1)*p;lo=int(pos);hi=min(lo+1,len(s)-1)
    return round(s[lo]+(s[hi]-s[lo])*(pos-lo),1)
def summary(rows):
    if not rows:return "COUNT=0"
    r=[v[0] for v in rows if v[0] is not None]
    u=[v[1] for v in rows if v[1] is not None]
    sc=collections.Counter(v[2] for v in rows if v[2])
    return ("COUNT="+str(len(rows))+
      " RT_SAMPLES="+str(len(r))+
      " REQ_P50_MS="+str(quantile(r,.5))+
      " REQ_P95_MS="+str(quantile(r,.95))+
      " REQ_MAX_MS="+str(round(max(r),1) if r else "NA")+
      " UPSTREAM_P50_MS="+str(quantile(u,.5))+
      " HTTP_2XX="+str(sum(v for k,v in sc.items() if 200<=k<300))+
      " HTTP_4XX="+str(sum(v for k,v in sc.items() if 400<=k<500))+
      " HTTP_5XX="+str(sum(v for k,v in sc.items() if 500<=k<600)))
def main():
    print("===== STAGE9 EXISTING CASINO CALLBACK BASELINE =====",flush=True)
    available=[p for p in SOURCES if p.is_file()]
    if not available:
        print("STAGE9_CALLBACK_LOG=NOT_FOUND",flush=True)
        print("STAGE9_CALLBACK_TIMING=UNVERIFIED",flush=True)
        return
    lines=[]
    # Bounded sampling; no raw log ever displayed.
    for path in reversed(available):
        try:
            with path.open("r",errors="replace",encoding="utf8") as fh:
                lines.extend(collections.deque(fh,maxlen=600))
        except (OSError,UnicodeError):
            print("STAGE9_LOG_READ=FAILED",flush=True)
    lines=lines[-900:]
    parsed=collections.defaultdict(list);metric_count=0
    key_counts=collections.Counter()
    for line in lines:
        if "/api/webhooks/softaggregator" not in line.lower() and not ACTION.search(line):
            continue
        a=ACTION.search(line) or ACTION_FALLBACK.search(line)
        action=a.group(1).lower() if a else "unknown"
        rt=None;upstream=None
        for key in ("request_time_ms","request_time_s","request_time","rt"):
            v=duration(line,key)
            if v is not None:
                rt=v;key_counts["request_time"]+=1;break
        for key in ("upstream_response_time_ms","upstream_response_time","upstream_time","urt"):
            v=duration(line,key)
            if v is not None:
                upstream=v;key_counts["upstream"]+=1;break
        c=STATUS.search(line) or STATUS_NGINX.search(line)
        status=int(c.group(1)) if c else None
        parsed[action].append((rt,upstream,status))
        if rt is not None:metric_count+=1
    print("STAGE9_LOG_SOURCE=EXISTING_NGINX_TIMING_ONLY",flush=True)
    print("STAGE9_LOG_RECORDS_SCANNED="+str(len(lines)),flush=True)
    print("STAGE9_LOG_REQUEST_TIME_PARSEABLE="+str(metric_count),flush=True)
    for a in ("balance","debit","credit","rollback","reversal","unknown"):
        if a in parsed:
            print("STAGE9_CALLBACK_"+a.upper()+" "+summary(parsed[a]),flush=True)
    if not metric_count:
        print("STAGE9_CALLBACK_TIMING=UNVERIFIED_LOG_FORMAT",flush=True)
    else:
        print("STAGE9_CALLBACK_TIMING=RECORDED_BASELINE_ONLY",flush=True)
    print("STAGE9_RAW_LOGS_PRINTED=false",flush=True)
if __name__=="__main__":
    main()
