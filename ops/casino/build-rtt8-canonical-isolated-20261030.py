#!/usr/bin/env python3
"""Isolated RTT8_CANONICAL build with only the audited existing-wallet lookup shortcut.

Reads production environment from the running 3098 process without logging it.
No nginx/public routes/PM2/systemd/DB changes. Refuses any non-matching release.
"""
from __future__ import annotations
import hashlib, os, pwd, re, shutil, subprocess
from pathlib import Path

LIVE=Path('/opt/nova-releases/casino-3098-eligible-fallback-HU6Rbl')
BASE=Path('/opt/nova-releases/casino-rtt8-3098-candidate-20261030')
DEP=Path('/opt/nova-releases/casino-rtt5-3098-candidate-20261030')
DEST=Path('/opt/nova-releases/casino-rtt8-canonical-3098-candidate-20261030')
STAGE=Path('/root/betvima-rtt8-canonical-stage-20261030')
REL=Path('src/server/providers/softaggregator/wallet.ts')
LIVE_SHA='9df555a7e3f04354019435e8e9318675587eb9b401422c0e70e7cc16727ff5af'
BASE_SHA='1c98491d2af6231e86b902bffcad520309592d56adaadec80469b624ee748d8e'

def fail(msg): raise SystemExit('REFUSED: '+msg)
def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()

if os.geteuid()!=0: fail('root required')
if DEST.exists() or DEST.is_symlink(): fail('target already exists')
if any(not x.is_dir() or x.is_symlink() for x in (LIVE,BASE,DEP,STAGE)):
    fail('pinned release or stage missing')
if sha(LIVE/REL)!=LIVE_SHA or sha(BASE/REL)!=BASE_SHA:
    fail('wallet baseline changed')
if (BASE/'.next/BUILD_ID').read_text().strip()!='ISgbMW3GwdrfM7TbI0z9P':
    fail('RTT8 baseline build differs')
if not (DEP/'node_modules/typescript/lib/tsc.js').is_file() or \
   not (DEP/'node_modules/next/dist/bin/next').is_file():
    fail('isolate dependencies missing')
if (DEP/'node_modules').is_symlink():
    fail('dependency source points elsewhere')

source=(BASE/REL).read_text()
desired=(STAGE/REL).read_text()
def blob_hash(data):
    return hashlib.sha1(('blob ' + str(len(data)) + '\0').encode() + data).hexdigest()
CANONICAL_BLOB='55abc91fdc2238def50d7883a47659948e84a53c'
if blob_hash(desired.encode())!=CANONICAL_BLOB:
    fail('staged source differs from CI-tested canonical Git blob')
if sha(BASE/REL)!=BASE_SHA:
    fail('RTT8 tested isolated candidate differs')
if source==desired:
    fail('unexpected: source already canonical; check build baseline')

if not (BASE/'src/server/providers/softaggregator/fiat-wallet.ts').read_bytes() == \
       (LIVE/'src/server/providers/softaggregator/fiat-wallet.ts').read_bytes():
    fail('fiat source mismatch')
listeners=subprocess.run(['ss','-ltnpH'],capture_output=True,text=True,timeout=8)
pids=re.findall(r':3098\s+[^\n]*?pid=(\d+)',listeners.stdout)
if listeners.returncode or len(pids)!=1 or Path('/proc/'+pids[0]+'/cwd').resolve()!=LIVE:
    fail('active 3098 release differs')

env={}
for pair in Path('/proc/'+pids[0]+'/environ').read_bytes().split(b'\0'):
    if b'=' in pair:
        k,v=pair.split(b'=',1)
        env[os.fsdecode(k)]=os.fsdecode(v)
for key in ('NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_ANON_KEY',
            'SUPABASE_SERVICE_ROLE_KEY','NEXT_PUBLIC_SITE_URL','NODE_EXTRA_CA_CERTS'):
    if not env.get(key): fail('live production environment incomplete')
if env.get('NODE_TLS_REJECT_UNAUTHORIZED')=='0': fail('insecure TLS environment')
env.update({
    'NODE_ENV':'production',
    'NEXT_TELEMETRY_DISABLED':'1',
    'NODE_OPTIONS':'--max-old-space-size=3072'
})

def ignore(directory,names):
    if Path(directory).resolve()==BASE.resolve():
        return {'node_modules','.next','.git','dist'} & set(names)
    return set()

try:
    shutil.copytree(BASE,DEST,symlinks=True,ignore=ignore)
    os.symlink(str(DEP/'node_modules'),str(DEST/'node_modules'))
    shutil.copy2(STAGE/REL,DEST/REL)
    user=pwd.getpwnam('novaadmin')
    subprocess.run(['chown','-R','-h',f'{user.pw_uid}:{user.pw_gid}',str(DEST)],check=True)
    print('RTT8_CANONICAL_ISOLATED_SOURCE_READY',flush=True)
    tsc=subprocess.run(['/usr/bin/node',str(DEP/'node_modules/typescript/lib/tsc.js'),'--noEmit'],
        cwd=DEST,env=env,user=user.pw_uid,group=user.pw_gid,
        capture_output=True,text=True,timeout=100)
    if tsc.returncode:
        print(tsc.stdout[-2500:])
        fail('TypeScript failed (no production changes)')
    print('RTT8_CANONICAL_TYPECHECK_PASS',flush=True)
    build=subprocess.run(['/usr/bin/nice','-n','10','/usr/bin/node',
                          str(DEP/'node_modules/next/dist/bin/next'),'build'],
        cwd=DEST,env=env,user=user.pw_uid,group=user.pw_gid,
        capture_output=True,text=True,timeout=260)
    if build.returncode or 'configuration.incomplete' in build.stdout:
        print(build.stdout[-2500:])
        fail('isolated Next build failed or missing config')
    if not (DEST/'.next/BUILD_ID').is_file(): fail('build ID missing')
    print('RTT8_CANONICAL_NEXT_BUILD_PASS',flush=True)
    print('RTT8_CANONICAL_BUILD_ID='+(DEST/'.next/BUILD_ID').read_text().strip())
    print('RTT8_CANONICAL_STAGED_WALLET_SHA256='+sha(DEST/REL))
    print('PRODUCTION_3098_UNCHANGED')
    print('RTT8_CANONICAL_NOT_RUNNING')
except subprocess.TimeoutExpired:
    fail('isolated typecheck/build timeout; production unchanged')
