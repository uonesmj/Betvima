#!/usr/bin/env python3
"""Measure existing 3098 vs isolated RTT7 Balance callback without any financial writes.

Strictly loopback 3098 / 3122; signed balance-only requests for the existing
configured pilot identity. Do not log secrets, player identifiers, URL, balances
or signed payloads. Candidate always stopped. No nginx/systemd/db mutations.
"""
from __future__ import annotations
import hashlib
import hmac
import http.client
import json
import os
from pathlib import Path
import pwd
import re
import signal
import socket
import statistics
import subprocess
import sys
import time
from urllib.parse import urlencode

LIVE = Path('/opt/nova-releases/casino-3098-eligible-fallback-HU6Rbl')
CAND = Path('/opt/nova-releases/casino-rtt7-3098-candidate-20261030')
DEPS = Path('/opt/nova-releases/casino-rtt5-3098-candidate-20261030')
STAGE = Path('/root/betvima-rtt7-safe-preflight-stage-20261030')
TEST_PORT = 3122
LOG = Path('/root/betvima-rtt7-readonly-balance-3122.log')
HASHES = {
    LIVE / 'src/server/providers/softaggregator/wallet.ts':
       '9df555a7e3f04354019435e8e9318675587eb9b401422c0e70e7cc16727ff5af',
    CAND / 'src/server/providers/softaggregator/wallet.ts':
       '6c9c0e69422bfa858d4ba8da50e043f893df917d1981c85191805bef2cf745e1',
    CAND / 'src/server/db/postgres.ts':
       '9d1d664c519bbaf05a1af076865d385f800e3ea481f7e7783ab0019b6234c2db',
    CAND / 'src/app/api/webhooks/softaggregator/route.ts':
       '82137036c2e67f27d6c1292d369d271bbea03e23dd492c95582655234cbd53d2',
}

def refuse(msg): raise SystemExit('REFUSED: ' + msg)
def run(args, timeout=15):
    return subprocess.run(args, text=True, capture_output=True, timeout=timeout)
def digest(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def median(nums): return round(statistics.median(nums), 1)

if os.geteuid() != 0: refuse('root required')
if any(not p.is_dir() or p.is_symlink() for p in (LIVE,CAND,DEPS,STAGE)):
    refuse('pinned releases or stage missing')
for p,h in HASHES.items():
    if not p.is_file() or digest(p) != h:
        refuse('source differs: ' + p.name)
if not (CAND/'.next/BUILD_ID').is_file() or \
   (CAND/'.next/BUILD_ID').read_text().strip() != '_zFdzPJOIAEA-kPvh_J2i':
    refuse('candidate build id differs')
if (CAND/'src/server/providers/softaggregator/wallet.ts').read_bytes() != \
   (STAGE/'src/server/providers/softaggregator/wallet.ts').read_bytes():
    refuse('candidate differs from safe staged version')
if (CAND/'src/server/providers/softaggregator/fiat-wallet.ts').read_bytes() != \
   (LIVE/'src/server/providers/softaggregator/fiat-wallet.ts').read_bytes():
    refuse('fiat financial code differs')
if not (CAND/'node_modules').is_symlink() or \
   (CAND/'node_modules').resolve() != (DEPS/'node_modules').resolve():
    refuse('dependencies not on isolated baseline')
nginx=run(['nginx','-T'],20)
if nginx.returncode or re.search(r'\b3122\b',nginx.stdout):
    refuse('candidate port is referenced by nginx or nginx invalid')
listeners=run(['ss','-ltnpH'])
pids=re.findall(r':3098\s+[^\n]*?pid=(\d+)', listeners.stdout)
if listeners.returncode or len(pids) != 1 or \
   Path('/proc/'+pids[0]+'/cwd').resolve() != LIVE:
    refuse('live 3098 listener does not match audited source')
with socket.socket() as sock:
    try: sock.bind(('127.0.0.1',TEST_PORT))
    except OSError: refuse('3122 already in use')

env={}
for entry in Path('/proc/'+pids[0]+'/environ').read_bytes().split(b'\0'):
    if b'=' in entry:
        k,v=entry.split(b'=',1)
        env[os.fsdecode(k)]=os.fsdecode(v)
if env.get('NODE_TLS_REJECT_UNAUTHORIZED')=='0':
    refuse('TLS verification disabled')
required=['SOFTAGGREGATOR_TEST_USER_ID','SOFTAGGREGATOR_SALT_KEY',
          'SOFTAGGREGATOR_EDGE_HMAC_SECRET',
          'NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_ANON_KEY',
          'SUPABASE_SERVICE_ROLE_KEY','NODE_EXTRA_CA_CERTS']
if any(not env.get(key) for key in required):
    refuse('required live pilot setting absent')
if env.get('SOFTAGGREGATOR_REAL_MONEY_ENABLED')!='true':
    refuse('real-money pilot flag disabled; read-only comparison not representative')
uid=env['SOFTAGGREGATOR_TEST_USER_ID'].lower()
if not re.fullmatch(r'[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}',uid):
    refuse('pilot user id invalid')
salt=env['SOFTAGGREGATOR_SALT_KEY']
edge=env['SOFTAGGREGATOR_EDGE_HMAC_SECRET']
if len(salt)<12 or len(edge)<32: refuse('callback keys incomplete')

def signed_balance(port):
    stamp=str(int(time.time()))
    fields={
       'action':'balance',
       'currency':'USD',
       'timestamp':stamp,
       'key':hashlib.md5((stamp+salt).encode('utf8')).hexdigest(),
       'username':'bv_'+uid.replace('-',''),
    }
    fields_sorted=sorted(fields.items())
    query=urlencode(fields_sorted)
    vendor=hmac.new(salt.encode(), '&'.join(k+'='+v for k,v in fields_sorted).encode(), hashlib.sha256).hexdigest()
    edge_sig=hmac.new(edge.encode(), query.encode(), hashlib.sha256).hexdigest()
    c=http.client.HTTPConnection('127.0.0.1',port,timeout=13)
    start=time.monotonic()
    try:
        c.request('GET','/api/webhooks/softaggregator?'+query,
            headers={'x-signature':vendor,
                     'x-betvima-edge-signature':edge_sig,
                     'cache-control':'no-store'})
        r=c.getresponse()
        body=r.read(4096)
        ms=(time.monotonic()-start)*1000.
        obj=json.loads(body)
        if r.status!=200 or set(obj.keys())!={'error','balance'} or obj['error'] not in (0,1,2):
            raise RuntimeError('unexpected callback response')
        return ms, obj['error']
    finally: c.close()

env.update({
    'NODE_ENV':'production','NEXT_TELEMETRY_DISABLED':'1',
    'NODE_OPTIONS':'--max-old-space-size=1536'
})
user=pwd.getpwnam('novaadmin')
p=None
try:
    with LOG.open('wb') as stream:
        LOG.chmod(0o600)
        p=subprocess.Popen(
            ['/usr/bin/node','node_modules/next/dist/bin/next','start',
             '-H','127.0.0.1','-p',str(TEST_PORT)],
            cwd=CAND,env=env,user=user.pw_uid,group=user.pw_gid,
            stdout=stream,stderr=subprocess.STDOUT,start_new_session=True,
        )
    limit=time.monotonic()+45.
    while time.monotonic()<limit:
        if p.poll() is not None: raise RuntimeError('candidate process exited')
        try:
            c=http.client.HTTPConnection('127.0.0.1',TEST_PORT,timeout=4)
            c.request('GET','/api/v1/casino/games?page=1&limit=1')
            r=c.getresponse()
            r.read(128)
            c.close()
            if r.status==200: break
        except Exception:
            time.sleep(1)
    else:
        raise RuntimeError('candidate startup timeout')
    print('RTT7_LOCAL_ONLY_STARTED',flush=True)
    before, after=[],[]
    errors_before,errors_after=[],[]
    for _ in range(2):
        signed_balance(3098);signed_balance(TEST_PORT)
    for _ in range(6):
        ms,err=signed_balance(3098)
        before.append(ms);errors_before.append(err)
        ms,err=signed_balance(TEST_PORT)
        after.append(ms);errors_after.append(err)
    if any(x!=0 for x in errors_before+errors_after):
        print('BALANCE_BUSINESS_RESPONSE_NOT_SUCCESSFUL')
        print('BASELINE_ERRORS='+','.join(str(x) for x in errors_before))
        print('RTT7_ERRORS='+','.join(str(x) for x in errors_after))
        print('REFUSED_TO_COMPARE_NON_SUCCESSFUL_BALANCE')
    else:
        print('BALANCE_READONLY_BASELINE_3098_MEDIAN_MS='+str(median(before)))
        print('BALANCE_READONLY_RTT7_3122_MEDIAN_MS='+str(median(after)))
        print('BALANCE_MEDIAN_SAVED_MS='+str(round(median(before)-median(after),1)))
        print('READ_ONLY_BALANCE_SUCCESS_SAMPLES=6_PER_VERSION')
    print('NO_FINANCIAL_WRITES_OR_PRODUCTION_ROUTING_CHANGES',flush=True)
except Exception as e:
    print('DIAGNOSTIC_FAILED:'+type(e).__name__,flush=True)
    sys.exit(2)
finally:
    if p is not None:
        try:
            os.killpg(p.pid,signal.SIGTERM)
            p.wait(timeout=8)
        except ProcessLookupError: pass
        except subprocess.TimeoutExpired:
            os.killpg(p.pid,signal.SIGKILL)
            p.wait()
    print('RTT7_CANDIDATE_STOPPED',flush=True)
    print('PRODUCTION_3098_UNCHANGED',flush=True)
