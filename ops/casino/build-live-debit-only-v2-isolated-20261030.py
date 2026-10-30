#!/usr/bin/env python3
"""Build exact pinned Debit V2 on localhost-only candidate; never publish.

Copies V1 candidate SOURCE (no .next or node_modules); only wallet.ts from
audited stage differs. Uses isolated dependencies and live env read-only.
"""
from __future__ import annotations
import hashlib
import importlib.util
import os
from pathlib import Path
import pwd
import re
import shutil
import subprocess

LIVE=Path('/opt/nova-releases/casino-3098-eligible-fallback-HU6Rbl')
BASE=Path('/opt/nova-releases/casino-debit-only-3098-candidate-20261030')
DEP=Path('/opt/nova-releases/casino-rtt5-3098-candidate-20261030')
STAGE=Path('/root/betvima-debit-only-v2-stage-20261030')
DEST=Path('/opt/nova-releases/casino-debit-v2-3098-candidate-20261030')
REL=Path('src/server/providers/softaggregator/wallet.ts')
LIVE_SHA='9df555a7e3f04354019435e8e9318675587eb9b401422c0e70e7cc16727ff5af'
BASE_SHA='71d8c680ee311d75c2c41a7ec871875a927a3d6120a9fc805b6e07909bda0855'
BASE_BUILD='2rgx_WOZRt8aQvBnAHfkt'
STAGER_BLOB='488cba256da629e6ec1b47dc7578f1a45130661f'

def refuse(message): raise SystemExit('REFUSED: '+message)
def sha(raw): return hashlib.sha256(raw).hexdigest()
def blob(raw):
    return hashlib.sha1(('blob '+str(len(raw))+'\0').encode()+raw).hexdigest()

if os.geteuid()!=0: refuse('root required')
if DEST.exists() or DEST.is_symlink(): refuse('candidate already exists')
if any(not d.is_dir() or d.is_symlink() for d in (LIVE,BASE,DEP,STAGE)):
    refuse('required release missing or symlink')
if (DEP/'node_modules').is_symlink() or not (DEP/'node_modules/next/dist/bin/next').is_file():
    refuse('isolated dependencies unavailable')
if sha((LIVE/REL).read_bytes())!=LIVE_SHA:
    refuse('live financial source changed')
base=(BASE/REL).read_bytes()
if sha(base)!=BASE_SHA or (BASE/'.next/BUILD_ID').read_text().strip()!=BASE_BUILD:
    refuse('Debit V1 candidate differs')
stage=(STAGE/REL).read_bytes()
helper=Path('/root/stage-live-debit-only-v2-wallet-20261030.py')
if not helper.is_file() or blob(helper.read_bytes())!=STAGER_BLOB:
    refuse('trusted source transformer missing or modified')
spec=importlib.util.spec_from_file_location('debit_v2_stage',helper)
if spec is None or spec.loader is None: refuse('cannot verify source patch')
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
if mod.patch(base.decode()).encode()!=stage:
    refuse('stage has extra financial edits')
proc=subprocess.run(['ss','-ltnpH'],capture_output=True,text=True,timeout=8)
pids=re.findall(r':3098\s+[^\n]*?pid=(\d+)',proc.stdout)
if proc.returncode or len(pids)!=1 or Path('/proc/'+pids[0]+'/cwd').resolve()!=LIVE:
    refuse('active 3098 differs')
env={}
for entry in Path('/proc/'+pids[0]+'/environ').read_bytes().split(b'\0'):
    if b'=' in entry:
        k,v=entry.split(b'=',1)
        env[os.fsdecode(k)]=os.fsdecode(v)
for name in ('NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_ANON_KEY',
             'SUPABASE_SERVICE_ROLE_KEY','NEXT_PUBLIC_SITE_URL','NODE_EXTRA_CA_CERTS'):
    if not env.get(name): refuse('required production build variable missing')
if env.get('NODE_TLS_REJECT_UNAUTHORIZED')=='0':
    refuse('TLS verification is disabled')
env.update(NODE_ENV='production',NEXT_TELEMETRY_DISABLED='1',
           NODE_OPTIONS='--max-old-space-size=2500')

def ignore(directory,names):
    if Path(directory).resolve()==BASE.resolve():
        exclude={'node_modules','.next','.git','dist','coverage','logs','tmp','uploads'}
        return {n for n in names if n in exclude or n.startswith('.env') or
                n.endswith(('.pem','.key','.p12'))}
    return set()

user=pwd.getpwnam('novaadmin')
try:
    shutil.copytree(BASE,DEST,symlinks=True,ignore=ignore)
    os.symlink(str(DEP/'node_modules'),str(DEST/'node_modules'))
    shutil.copy2(STAGE/REL,DEST/REL)
    for unchanged in (
        'src/server/providers/softaggregator/fiat-wallet.ts',
        'src/server/providers/softaggregator/pilot-limits.ts',
        'src/server/providers/softaggregator/contract.ts',
        'src/app/api/webhooks/softaggregator/route.ts',
        'src/server/db/postgres.ts',
    ):
        if (LIVE/unchanged).read_bytes()!=(DEST/unchanged).read_bytes():
            refuse('non-Debit source differs: '+unchanged)
    subprocess.run(['chown','-R','-h',f'{user.pw_uid}:{user.pw_gid}',str(DEST)],check=True)
    print('DEBIT_V2_ISOLATED_SOURCE_READY',flush=True)
    tsc=subprocess.run(
        ['/usr/bin/node',str(DEP/'node_modules/typescript/lib/tsc.js'),'--noEmit'],
        cwd=DEST,env=env,user=user.pw_uid,group=user.pw_gid,
        capture_output=True,text=True,timeout=110)
    if tsc.returncode:
        print(tsc.stdout[-2500:])
        refuse('TypeScript failed; live unchanged')
    print('DEBIT_V2_TYPECHECK_PASS',flush=True)
    build=subprocess.run(
        ['/usr/bin/nice','-n','10','/usr/bin/node',
         str(DEP/'node_modules/next/dist/bin/next'),'build'],
        cwd=DEST,env=env,user=user.pw_uid,group=user.pw_gid,
        capture_output=True,text=True,timeout=350)
    if build.returncode or 'configuration.incomplete' in build.stdout:
        print(build.stdout[-2500:])
        refuse('Next.js build failed; live unchanged')
    if not (DEST/'.next/BUILD_ID').is_file():
        refuse('missing build output')
    print('DEBIT_V2_NEXT_BUILD_PASS',flush=True)
    print('DEBIT_V2_BUILD_ID='+(DEST/'.next/BUILD_ID').read_text().strip(),flush=True)
    print('DEBIT_V2_WALLET_SHA256='+sha((DEST/REL).read_bytes()),flush=True)
    print('CREDIT_BALANCE_ROLLBACK_NONDEBIT_FILES_UNCHANGED',flush=True)
    print('PRODUCTION_3098_UNCHANGED',flush=True)
except subprocess.TimeoutExpired:
    refuse('isolated build timeout; live unchanged')
