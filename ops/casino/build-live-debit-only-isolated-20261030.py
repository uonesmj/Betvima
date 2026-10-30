#!/usr/bin/env python3
"""Build isolated Debit-only candidate from the EXACT live release source.

No live edits, database writes, Nginx changes, or server restarts. Wallet.ts
must match the sole change staged by stage-live-debit-only-limit-read-20261030.
"""
from __future__ import annotations

import hashlib
import os
from pathlib import Path
import pwd
import re
import shutil
import subprocess

LIVE = Path('/opt/nova-releases/casino-3098-eligible-fallback-HU6Rbl')
DEP = Path('/opt/nova-releases/casino-rtt5-3098-candidate-20261030')
STAGE = Path('/root/betvima-debit-only-stage-20261030')
DEST = Path('/opt/nova-releases/casino-debit-only-3098-candidate-20261030')
REL = Path('src/server/providers/softaggregator/wallet.ts')
LIVE_SHA = '9df555a7e3f04354019435e8e9318675587eb9b401422c0e70e7cc16727ff5af'

def refuse(msg):
    raise SystemExit('REFUSED: ' + msg)

def sha(raw):
    return hashlib.sha256(raw).hexdigest()

if os.geteuid() != 0:
    refuse('root required')
if DEST.exists() or DEST.is_symlink():
    refuse('candidate destination already exists')
if any(not x.is_dir() or x.is_symlink() for x in (LIVE, DEP, STAGE)):
    refuse('pinned live, dependency or stage directory unavailable')
if (DEP/'node_modules').is_symlink():
    refuse('isolated dependencies unexpectedly link elsewhere')
if not (DEP/'node_modules/next/dist/bin/next').is_file() or not (
    DEP/'node_modules/typescript/lib/tsc.js'
).is_file():
    refuse('isolated build tooling missing')
live = (LIVE/REL).read_bytes()
if sha(live) != LIVE_SHA:
    refuse('live financial source changed')
staged = (STAGE/REL).read_bytes()
if staged == live:
    refuse('staged wallet has no Debit-only optimization')
# Reuse exact source transformation as a separately audited pure helper.
# The helper has no main-time side effects when imported.
import importlib.util
helper = Path('/root/stage-live-debit-only-limit-read-20261030.py')
if not helper.is_file():
    refuse('original audited staging helper missing')
spec = importlib.util.spec_from_file_location('debit_stage', helper)
if spec is None or spec.loader is None:
    refuse('cannot import staging helper')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
if module.patch_debit_only(live.decode('utf-8')).encode() != staged:
    refuse('unexpected edits beyond Debit helper')
listeners = subprocess.run(['ss','-ltnpH'], capture_output=True, text=True, timeout=8)
pids = re.findall(r':3098\s+[^\n]*?pid=(\d+)', listeners.stdout)
if listeners.returncode or len(pids) != 1 or Path('/proc/'+pids[0]+'/cwd').resolve() != LIVE:
    refuse('active 3098 release changed')
if os.environ.get('NODE_TLS_REJECT_UNAUTHORIZED') == '0':
    refuse('insecure shell TLS')
env = {}
for entry in Path('/proc/'+pids[0]+'/environ').read_bytes().split(b'\0'):
    if b'=' in entry:
        k, v = entry.split(b'=', 1)
        env[os.fsdecode(k)] = os.fsdecode(v)
for key in ('NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
            'SUPABASE_SERVICE_ROLE_KEY', 'NEXT_PUBLIC_SITE_URL',
            'NODE_EXTRA_CA_CERTS'):
    if not env.get(key):
        refuse('missing live environment key')
if env.get('NODE_TLS_REJECT_UNAUTHORIZED') == '0':
    refuse('live TLS verification disabled')
env.update(NODE_ENV='production', NEXT_TELEMETRY_DISABLED='1',
           NODE_OPTIONS='--max-old-space-size=2500')

def ignore(directory, names):
    if Path(directory).resolve() == LIVE.resolve():
        excluded = {'node_modules','.next','.git','dist','build','.vercel',
                    'logs','uploads','tmp','backups','coverage'}
        return {n for n in names if n in excluded or n.startswith('.env') or
                n.endswith(('.pem','.key','.p12'))}
    return set()

user = pwd.getpwnam('novaadmin')
try:
    shutil.copytree(LIVE, DEST, symlinks=True, ignore=ignore)
    os.symlink(str(DEP/'node_modules'), str(DEST/'node_modules'))
    shutil.copy2(STAGE/REL, DEST/REL)
    for unchanged in (
        'src/server/providers/softaggregator/fiat-wallet.ts',
        'src/server/providers/softaggregator/pilot-limits.ts',
        'src/server/providers/softaggregator/contract.ts',
        'src/app/api/webhooks/softaggregator/route.ts',
        'src/server/db/postgres.ts',
    ):
        if (LIVE/unchanged).read_bytes() != (DEST/unchanged).read_bytes():
            refuse('non-Debit source differs: ' + unchanged)
    subprocess.run(['chown','-R','-h',f'{user.pw_uid}:{user.pw_gid}',str(DEST)],check=True)
    print('DEBIT_ONLY_ISOLATED_SOURCE_READY',flush=True)
    tsc=subprocess.run(
        ['/usr/bin/node',str(DEP/'node_modules/typescript/lib/tsc.js'),'--noEmit'],
        cwd=DEST,env=env,user=user.pw_uid,group=user.pw_gid,
        stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,timeout=100,
    )
    if tsc.returncode:
        print(tsc.stdout[-1800:],flush=True)
        refuse('isolated TypeScript check failed')
    print('DEBIT_ONLY_TYPECHECK_PASS',flush=True)
    build=subprocess.run(
        ['/usr/bin/nice','-n','10','/usr/bin/node',
         str(DEP/'node_modules/next/dist/bin/next'),'build'],
        cwd=DEST,env=env,user=user.pw_uid,group=user.pw_gid,
        stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,timeout=300,
    )
    if build.returncode or 'configuration.incomplete' in build.stdout:
        print(build.stdout[-2000:],flush=True)
        refuse('isolated build failed')
    if not (DEST/'.next/BUILD_ID').is_file():
        refuse('isolated Next build missing')
    print('DEBIT_ONLY_NEXT_BUILD_PASS',flush=True)
    print('DEBIT_ONLY_BUILD_ID='+(DEST/'.next/BUILD_ID').read_text().strip(),flush=True)
    print('DEBIT_ONLY_STAGED_SHA256='+sha((DEST/REL).read_bytes()),flush=True)
    print('UNCHANGED_CREDIT_BALANCE_ROLLBACK_ROUTES_PG',flush=True)
    print('PRODUCTION_3098_UNCHANGED',flush=True)
except subprocess.TimeoutExpired:
    refuse('isolated build timeout; production unchanged')
