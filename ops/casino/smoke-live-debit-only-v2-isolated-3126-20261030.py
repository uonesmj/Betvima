#!/usr/bin/env python3
"""Loopback-only Debit candidate smoke; no signed callback or financial writes."""
from __future__ import annotations
import hashlib
import json
import os
from pathlib import Path
import pwd
import re
import signal
import socket
import subprocess
import sys
import time
from urllib.request import urlopen

LIVE = Path('/opt/nova-releases/casino-3098-eligible-fallback-HU6Rbl')
DEP = Path('/opt/nova-releases/casino-rtt5-3098-candidate-20261030')
TEST = Path('/opt/nova-releases/casino-debit-v2-3098-candidate-20261030')
STAGE = Path('/root/betvima-debit-only-v2-stage-20261030')
LOG = Path('/root/betvima-debit-v2-smoke-3126-20261030.log')
REL = Path('src/server/providers/softaggregator/wallet.ts')
PINNED_LIVE_SHA = '9df555a7e3f04354019435e8e9318675587eb9b401422c0e70e7cc16727ff5af'
PORT = 3126

def refuse(message):
    raise SystemExit('REFUSED: '+message)

def run(*args):
    return subprocess.run(args,capture_output=True,text=True,timeout=16)

def request(path,timeout=10):
    with urlopen('http://127.0.0.1:'+str(PORT)+path,timeout=timeout) as response:
        return response.status,response.read(4096)

if os.geteuid()!=0:
    refuse('root required')
if any(not d.is_dir() or d.is_symlink() for d in (LIVE,DEP,TEST,STAGE)):
    refuse('release or stage missing')
if not (TEST/'.next/BUILD_ID').is_file():
    refuse('candidate not built')
digest=lambda b: hashlib.sha256(b).hexdigest()
if digest((LIVE/REL).read_bytes()) != PINNED_LIVE_SHA or (
    (TEST/REL).read_bytes() != (STAGE/REL).read_bytes()
):
    refuse('source mismatch')
for unchanged in (
    'src/server/providers/softaggregator/fiat-wallet.ts',
    'src/server/providers/softaggregator/pilot-limits.ts',
    'src/server/providers/softaggregator/contract.ts',
    'src/app/api/webhooks/softaggregator/route.ts',
    'src/server/db/postgres.ts',
):
    if (TEST/unchanged).read_bytes() != (LIVE/unchanged).read_bytes():
        refuse('non-Debit source modified')
nginx=run('nginx','-T')
if nginx.returncode or re.search(r'\b3126\b',nginx.stdout):
    refuse('nginx invalid or candidate port publicly routed')
with socket.socket() as sock:
    try:
        sock.bind(('127.0.0.1',PORT))
    except OSError:
        refuse('candidate port already in use')
ss=run('ss','-ltnpH')
pids=re.findall(r':3098\s+[^\n]*?pid=(\d+)',ss.stdout)
if ss.returncode or len(pids)!=1 or Path('/proc/'+pids[0]+'/cwd').resolve()!=LIVE:
    refuse('active 3098 no longer pinned')
env={}
for item in Path('/proc/'+pids[0]+'/environ').read_bytes().split(b'\0'):
    if b'=' in item:
        a,b=item.split(b'=',1)
        env[os.fsdecode(a)]=os.fsdecode(b)
for k in ('NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_ANON_KEY',
          'SUPABASE_SERVICE_ROLE_KEY','NEXT_PUBLIC_SITE_URL','NODE_EXTRA_CA_CERTS'):
    if not env.get(k):
        refuse('live environment missing required key')
if env.get('NODE_TLS_REJECT_UNAUTHORIZED')=='0':
    refuse('TLS verification disabled')
env.update(NODE_ENV='production', NEXT_TELEMETRY_DISABLED='1',
           NODE_OPTIONS='--max-old-space-size=1536',
           PORT=str(PORT), HOSTNAME='127.0.0.1')
user=pwd.getpwnam('novaadmin')
process=None
try:
    with LOG.open('wb') as output:
        LOG.chmod(0o600)
        process=subprocess.Popen(
            ['/usr/bin/node',str(DEP/'node_modules/next/dist/bin/next'),
             'start','-H','127.0.0.1','-p',str(PORT)],
            cwd=TEST,env=env,stdout=output,stderr=subprocess.STDOUT,
            user=user.pw_uid,group=user.pw_gid,start_new_session=True,
        )
    print('DEBIT_V2_CANDIDATE_LOCAL_ONLY_STARTED',flush=True)
    for attempt in range(45):
        if process.poll() is not None:
            raise RuntimeError('candidate exited before readiness')
        try:
            status,_=request('/api/v1/casino/games?page=1&limit=1',timeout=5)
            if status==200:
                print('GAMES_HTTP_200',flush=True)
                break
        except Exception:
            time.sleep(1)
    else:
        raise RuntimeError('candidate readiness timeout')
    status,_=request('/api/health',timeout=15)
    if status!=200:
        raise RuntimeError('health failure')
    print('HEALTH_HTTP_200',flush=True)
    status,body=request('/api/webhooks/softaggregator',timeout=15)
    if status!=200 or json.loads(body) != {'error':2,'balance':0}:
        raise RuntimeError('unsigned money callback was not rejected')
    print('UNSIGNED_CALLBACK_REJECTED',flush=True)
    print('DEBIT_V2_ISOLATED_SMOKE_PASS',flush=True)
except Exception as e:
    print('DEBIT_V2_ISOLATED_SMOKE_FAILED='+type(e).__name__,flush=True)
    sys.exit(2)
finally:
    if process is not None:
        try:
            os.killpg(process.pid,signal.SIGTERM)
            process.wait(timeout=8)
        except ProcessLookupError:
            pass
        except subprocess.TimeoutExpired:
            os.killpg(process.pid,signal.SIGKILL)
            process.wait()
    print('DEBIT_V2_CANDIDATE_STOPPED',flush=True)
    print('PRODUCTION_3098_UNCHANGED',flush=True)
