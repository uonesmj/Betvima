#!/usr/bin/env python3
"""Read-only aggregate of prior RTT5 live canary timing. No DB or route access.

Only whitelisted action names, counts, durations, and SQL phase labels printed.
Never logs players, ids, game names, URLs, balances, query text, or secrets.
"""
from __future__ import annotations

import json
import math
import statistics
from collections import defaultdict
from pathlib import Path

LOGS = [
    Path('/root/betvima-rtt5-retry10m-20261030/candidate.log'),
    Path('/root/betvima-rtt5-canary-20261030/candidate.log'),
]
ACTIONS = ('balance', 'debit', 'credit')
def percentile(samples: list[float], q: float) -> float:
    seq = sorted(samples)
    if not seq:
        return 0.
    x = (len(seq) - 1) * q
    lo = math.floor(x)
    hi = math.ceil(x)
    return seq[lo] + (seq[hi] - seq[lo]) * (x-lo)

found = False
for path in LOGS:
    if not path.is_file():
        continue
    durations: dict[str, list[float]] = defaultdict(list)
    phases: dict[str, dict[str, list[float]]] = defaultdict(lambda: defaultdict(list))
    count = 0
    with path.open('r', encoding='utf-8', errors='replace') as handle:
        for line in handle:
            if '"casino.callback.latency"' not in line or len(line)>16384:
                continue
            try:
                obj = json.loads(line.strip())
            except (json.JSONDecodeError, ValueError):
                continue
            if not isinstance(obj, dict) or obj.get('event')!='casino.callback.latency':
                continue
            act = obj.get('action')
            if act not in ACTIONS or obj.get('rollback') is not False:
                continue
            duration = obj.get('total_ms')
            if not isinstance(duration, (int,float)) or not math.isfinite(duration) or duration<0:
                continue
            durations[act].append(float(duration))
            p = obj.get('phases',{})
            if isinstance(p,dict):
                for name,record in p.items():
                    if not isinstance(name,str) or not name.startswith('db.') or not isinstance(record,dict):
                        continue
                    v=record.get('total_ms')
                    if isinstance(v,(int,float)) and math.isfinite(v) and v>=0:
                        phases[act][name].append(float(v))
            count+=1
    if not count:
        continue
    found=True
    print('===== PREVIOUS_RTT5_CALLBACK_TRACE =====')
    print('LOG_EXISTS=True')
    print('RECORDED_REQUESTS='+str(count))
    for act in ACTIONS:
        sample=durations[act]
        if not sample: continue
        print(f'{act.upper()}: n={len(sample)}, median_ms={percentile(sample,.5):.1f}, p90_ms={percentile(sample,.9):.1f}, max_ms={max(sample):.1f}')
        for name,vals in sorted(phases[act].items(), key=lambda x:statistics.mean(x[1]),reverse=True)[:6]:
            print(f'  {name}: avg_total_ms={statistics.mean(vals):.1f}, max_total_ms={max(vals):.1f}')
if not found:
    print('NO_PREVIOUS_VALID_RTT5_TRACES_FOUND')
print('READ_ONLY=TRUE')
print('PRODUCTION_CONFIG_AND_DATABASE_UNCHANGED')
