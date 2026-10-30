#!/usr/bin/env python3
"""READ-ONLY V4 canary routing and sanitized latency summary. No private fields."""
from __future__ import annotations
from pathlib import Path
import json
import re
import statistics
import subprocess
import sys

NGINX = Path('/etc/nginx/sites-enabled/betvima.com').resolve()
ROOT = Path('/root/betvima-debit-v4-canary-20261030')
LOG = ROOT / 'candidate.log'
TIMER = 'betvima-debit-v4-autorevert-20261030'
PATTERN = re.compile(
    r'location\s+\^~\s+/api/webhooks/softaggregator'
    r'\s*\{[^{}]*?\bproxy_pass\s+http://127\.0\.0\.1:(\d+)\s*;', re.S)
MARKER = '"event":"casino.debit.v4.settlement_latency"'

def route():
    matches = PATTERN.findall(NGINX.read_text())
    return matches[0] if len(matches) == 1 else 'AMBIGUOUS'

def percentile(items, p):
    return sorted(items)[max(0, min(len(items)-1, (len(items)*p+99)//100 - 1))]

if __name__ == '__main__':
    if not NGINX.is_file():
        sys.exit('REFUSED: nginx config missing')
    current = route()
    print('CALLBACK_PORT=' + current)
    print('ROLLBACK_VERIFIED=' + str(current == '3098').lower())
    if current not in ('3098', '3128'):
        sys.exit('REFUSED: unexpected callback route')
    for suffix in ('timer', 'service'):
        result = subprocess.run(
            ['systemctl','show',TIMER+'.'+suffix,
             '-p','ActiveState','-p','Result','-p','ExecMainStatus'],
            capture_output=True,text=True,timeout=8)
        print('AUTO_REVERT_'+suffix.upper()+'='+(' '.join(result.stdout.splitlines()) if result.returncode==0 else 'UNKNOWN'))
    if not LOG.is_file():
        print('DEBIT_V4_SAMPLES=0')
        print('NO_TIMING_LOG_YET')
        sys.exit(0)
    times=[]
    invalid=0
    decoder=json.JSONDecoder()
    for line in LOG.read_text(errors='replace').splitlines():
        offset=line.find('{'+MARKER)
        if offset<0: continue
        try:
            obj,_=decoder.raw_decode(line[offset:])
            ms=obj.get('settlement_ms')
            if type(ms) not in (float,int) or not (0<=ms<=120000):
                raise ValueError('invalid duration')
            times.append(float(ms))
        except (ValueError,TypeError):
            invalid+=1
    print('DEBIT_V4_SAMPLES='+str(len(times)))
    print('INVALID_TIMING_LINES='+str(invalid))
    if times:
        print('DEBIT_V4_TIMES_MS='+json.dumps([round(x,1) for x in times]))
        print('DEBIT_V4_P50_MS='+str(round(statistics.median(times),1)))
        print('DEBIT_V4_MAX_MS='+str(round(max(times),1)))
        if len(times)>=5:
            print('DEBIT_V4_NEAREST_RANK_P95_MS='+str(round(percentile(times,95),1)))
        else:
            print('P95_NOT_RELIABLE_SAMPLE_BELOW_5=true')
        print('NOTE=server settlement only, excludes supplier and browser network RTT')
