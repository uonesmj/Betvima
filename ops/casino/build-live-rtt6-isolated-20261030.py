#!/usr/bin/env python3
"""Build audited RTT6 read-only optimization as a separate, unserved release.

Does not touch any live release, existing candidate, financial SQL, schema,
Nginx, PM2, systemd or public route. Expects previously staged wallet diff
from stage-live-rtt6-balance-readonly-20261030.py. Fail-closed source hashes.
"""
from __future__ import annotations
import hashlib, os, pwd, re, shutil, subprocess, sys
from pathlib import Path

LIVE = Path('/opt/nova-releases/casino-3098-eligible-fallback-HU6Rbl')
BASE = Path('/opt/nova-releases/casino-rtt5-3098-candidate-20261030')
NEW = Path('/opt/nova-releases/casino-rtt6-3098-candidate-20261030')
STAGE = Path('/root/betvima-rtt6-balance-stage-20261030')
REL = Path('src/server/providers/softaggregator/wallet.ts')
EXPECTED_OLD_SHA = '9df555a7e3f04354019435e8e9318675587eb9b401422c0e70e7cc16727ff5af'

def fail(msg): raise SystemExit('REFUSED: ' + msg)
def digest(path): return hashlib.sha256(path.read_bytes()).hexdigest()

if os.geteuid() != 0: fail('root required')
if NEW.exists() or NEW.is_symlink(): fail('target candidate already exists')
if not all(x.is_dir() and not x.is_symlink() for x in (LIVE, BASE, STAGE)):
    fail('required release or staged files missing')
if digest(LIVE / REL) != EXPECTED_OLD_SHA or digest(BASE / REL) != EXPECTED_OLD_SHA:
    fail('active or baseline wallet changed')
old = (LIVE / REL).read_text()
new = (STAGE / REL).read_text()
if old.count("  if (event.action === 'balance') {") != 1:
    fail('unexpected active balance code')
if not new.startswith(old[:old.index("  if (event.action === 'balance') {")]):
    fail('staged wallet changed outside expected location')
from_line = """  if (event.action === 'balance') {
    const p = await getProfile(db, userId);
    if (!p || !accountCanBet(p)) return { error: 2, balance: 0 };
    return safeResponse(0, available(await walletRow(db, userId, false)));
  }"""
to_line = """  if (event.action === 'balance') {
    // Independent, read-only queries may share network wait. The same fresh
    // eligibility gate must pass before any amount can be returned.
    const [p, wallet] = await Promise.all([
      getProfile(db, userId),
      walletRow(db, userId, false),
    ]);
    if (!p || !accountCanBet(p)) return { error: 2, balance: 0 };
    return safeResponse(0, available(wallet));
  }"""
if old.count(from_line) != 1 or old.replace(from_line, to_line) != new:
    fail('stage contains unexpected financial source edits')
if not (BASE / '.next/BUILD_ID').is_file() or not (BASE / 'node_modules').is_dir():
    fail('previous isolated release is incomplete')
if (BASE / 'node_modules').is_symlink():
    fail('baseline dependencies not isolated from production')
if (BASE / '.next/BUILD_ID').read_text().strip() != 'Rc2tySmBIrO3fV7EI7W8u':
    fail('baseline candidate build unexpectedly changed')
sockets = subprocess.run(['ss', '-ltnpH'], capture_output=True, text=True, timeout=8)
pids = re.findall(r':3098\s+[^\n]*?pid=(\d+)', sockets.stdout)
if sockets.returncode or len(pids) != 1 or Path('/proc/'+pids[0]+'/cwd').resolve() != LIVE:
    fail('active production process changed')
env = {'PATH':'/usr/bin:/bin', 'HOME':str(NEW), 'NODE_ENV':'production'}
for item in Path('/proc/'+pids[0]+'/environ').read_bytes().split(b'\0'):
    if b'=' in item:
        a,b=item.split(b'=',1)
        env[os.fsdecode(a)] = os.fsdecode(b)
for key in ('NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_ANON_KEY',
            'SUPABASE_SERVICE_ROLE_KEY','NEXT_PUBLIC_SITE_URL','NODE_EXTRA_CA_CERTS'):
    if not env.get(key): fail('required env variable missing')
if env.get('NODE_TLS_REJECT_UNAUTHORIZED') == '0':
    fail('TLS verification disabled')
env.update({
    'NODE_ENV': 'production', 'NEXT_TELEMETRY_DISABLED': '1',
    'NODE_OPTIONS': '--max-old-space-size=3072'
})
if not (BASE / 'node_modules/next/dist/bin/next').is_file():
    fail('Next.js missing')

def omit(dirpath, names):
    if Path(dirpath).resolve() == BASE.resolve():
        return {'node_modules', '.next', '.git', 'dist'} & set(names)
    return set()

try:
    # Copy source ONLY; build artifacts and dependencies are never copied.
    shutil.copytree(BASE, NEW, symlinks=True, ignore=omit)
    # Candidate may READ the previously isolated node_modules but cannot
    # write through the symlink to the live release.
    os.symlink(str(BASE / 'node_modules'), str(NEW / 'node_modules'))
    shutil.copy2(STAGE / REL, NEW / REL)
    user = pwd.getpwnam('novaadmin')
    subprocess.run(['chown','-R','-h',f'{user.pw_uid}:{user.pw_gid}',str(NEW)],check=True)
    # Build and typecheck use the real service's env, not missing shell vars.
    print('RTT6_ISOLATED_SOURCE_READY', flush=True)
    print('RTT6_WALLET_CHANGE=READ_ONLY_BALANCE_ONLY', flush=True)
    print('NODE_MODULES=ISOLATED_RTT5_REFERENCE_NOT_PRODUCTION', flush=True)
    tsc = subprocess.run(
        ['/usr/bin/node', str(BASE / 'node_modules/typescript/lib/tsc.js'), '--noEmit'],
        cwd=NEW, env=env, user=user.pw_uid, group=user.pw_gid,
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
        text=True, timeout=100,
    )
    if tsc.returncode:
        print(tsc.stdout[-2500:])
        fail('TypeScript failed; production remains unchanged')
    print('RTT6_TYPECHECK_PASS', flush=True)
    build = subprocess.run(
        ['/usr/bin/nice','-n','10','/usr/bin/node',
         str(BASE / 'node_modules/next/dist/bin/next'),'build'],
        cwd=NEW, env=env, user=user.pw_uid, group=user.pw_gid,
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
        text=True, timeout=260,
    )
    if build.returncode or 'configuration.incomplete' in build.stdout:
        print(build.stdout[-2500:])
        fail('Next.js build error or incomplete configuration; production unchanged')
    build_id = NEW / '.next/BUILD_ID'
    if not build_id.is_file(): fail('Next build output missing')
    print('RTT6_NEXT_BUILD_PASS', flush=True)
    print('RTT6_BUILD_ID=' + build_id.read_text().strip())
    print('PRODUCTION_3098_UNCHANGED')
    print('CANDIDATE_NOT_RUNNING')
except subprocess.TimeoutExpired:
    fail('build timed out, production unaffected')
