#!/usr/bin/env python3
"""Build isolated, exact-source ordinary Debit optimization V3; NEVER publish.

Copies source from PINNED running 3098 release (not divergent GitHub branch),
changes exactly ONE wallet block from pinned stage; no other source changes.
Does not deploy, restart, reload, route traffic, send signed callbacks, or
perform financial SQL. Uses isolated Next.js dependencies and existing local
environment exactly as audited in earlier V2 builds.
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

LIVE = Path('/opt/nova-releases/casino-3098-eligible-fallback-HU6Rbl')
DEP = Path('/opt/nova-releases/casino-rtt5-3098-candidate-20261030')
STAGE = Path('/root/betvima-debit-v3-wallet-only-stage-20261030')
DEST = Path('/opt/nova-releases/casino-debit-v3-3098-candidate-20261030')
REL = Path('src/server/providers/softaggregator/wallet.ts')
LIVE_SHA = '9df555a7e3f04354019435e8e9318675587eb9b401422c0e70e7cc16727ff5af'
STAGED_SHA = '0e536e0c790666782b565dae8919b67f4afd02b585ba51229bb10dd78431bb02'
STAGER_BLOB = 'eaffd250c3d850d40a6a9a47cc697f9d8d44fb66'
STAGER = Path('/root/stage-live-debit-v3-wallet-only-20261030.py')

def refuse(message: str) -> None:
    raise SystemExit('REFUSED: ' + message)

def sha(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()

def gitblob(value: bytes) -> str:
    return hashlib.sha1(('blob ' + str(len(value)) + '\0').encode() + value).hexdigest()

def production_pid() -> str:
    result = subprocess.run(['ss', '-ltnpH'], capture_output=True, text=True, timeout=8)
    pids = re.findall(r':3098\s+[^\n]*?pid=(\d+)', result.stdout)
    if result.returncode != 0 or len(pids) != 1:
        refuse('could not pin exactly one production listener')
    if Path('/proc/' + pids[0] + '/cwd').resolve() != LIVE:
        refuse('3098 active release changed')
    return pids[0]

if os.geteuid() != 0:
    refuse('root required for pinned 3098 audit')
if DEST.exists() or DEST.is_symlink():
    refuse('candidate destination already exists')
if any(not x.is_dir() or x.is_symlink() for x in (LIVE, DEP, STAGE)):
    refuse('pinned live, dependency or staged source unavailable')
if not (DEP / 'node_modules/next/dist/bin/next').is_file():
    refuse('offline isolated Next.js dependency unavailable')
if (DEP / 'node_modules').is_symlink():
    refuse('isolated node_modules cannot be a link')

pid = production_pid()
live_bytes = (LIVE / REL).read_bytes()
if sha(live_bytes) != LIVE_SHA:
    refuse('live wallet version changed')
stage_bytes = (STAGE / REL).read_bytes()
if sha(stage_bytes) != STAGED_SHA:
    refuse('Debit-only staged wallet version changed')
if not STAGER.is_file() or STAGER.is_symlink() or gitblob(STAGER.read_bytes()) != STAGER_BLOB:
    refuse('source patch script not pinned')
spec = importlib.util.spec_from_file_location('v3_debit_only_stage', STAGER)
if not spec or not spec.loader:
    refuse('cannot audit stage generator')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
if module.patch(live_bytes.decode('utf-8')).encode('utf-8') != stage_bytes:
    refuse('staged wallet is not byte-exact Debit-only change')

environment: dict[str, str] = {}
for item in Path('/proc/' + pid + '/environ').read_bytes().split(b'\0'):
    if b'=' in item:
        key, value = item.split(b'=', 1)
        environment[os.fsdecode(key)] = os.fsdecode(value)
for name in (
    'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY', 'NEXT_PUBLIC_SITE_URL', 'NODE_EXTRA_CA_CERTS',
):
    if not environment.get(name):
        refuse('production build variable not available: ' + name)
if environment.get('NODE_TLS_REJECT_UNAUTHORIZED') == '0':
    refuse('TLS verification disabled')
environment.update(
    NODE_ENV='production',
    NEXT_TELEMETRY_DISABLED='1',
    NODE_OPTIONS='--max-old-space-size=2500',
)

def ignore(directory: str, names: list[str]) -> set[str]:
    deny = {'node_modules', '.next', '.git', '.cache', 'dist', 'coverage',
            'logs', 'tmp', 'uploads', 'backup', 'backups'}
    return {
        name for name in names
        if name in deny or name.startswith('.env') or
        name.endswith(('.pem', '.key', '.p12', '.log', '.sqlite', '.db'))
    }

def source_manifest(directory: Path) -> dict[str, str]:
    root = directory / 'src'
    if not root.is_dir() or root.is_symlink():
        refuse('source directory unavailable')
    hashes = {}
    for p in root.rglob('*'):
        if p.is_symlink():
            refuse('symlink present in source tree')
        if p.is_file():
            rel = str(p.relative_to(directory))
            hashes[rel] = sha(p.read_bytes())
    return hashes

user = pwd.getpwnam('novaadmin')
try:
    # Keep the original source tree intact: no writes to LIVE, PM2 or Nginx.
    shutil.copytree(LIVE, DEST, symlinks=True, ignore=ignore)
    os.symlink(str(DEP / 'node_modules'), str(DEST / 'node_modules'))
    shutil.copy2(STAGE / REL, DEST / REL)
    live_sources = source_manifest(LIVE)
    candidate_sources = source_manifest(DEST)
    candidate_sources[REL.as_posix()] = live_sources[REL.as_posix()]
    if live_sources != candidate_sources:
        refuse('a non-wallet source changed or disappeared')
    if sha((DEST / REL).read_bytes()) != STAGED_SHA:
        refuse('candidate wallet hash mismatch')
    if production_pid() != pid:
        refuse('3098 process changed during source preparation')
    subprocess.run(
        ['chown', '-R', '-h', f'{user.pw_uid}:{user.pw_gid}', str(DEST)],
        check=True,
    )
    print('DEBIT_V3_ISOLATED_SOURCE_READY', flush=True)
    print('ALL_NONWALLET_SOURCE_BYTE_IDENTICAL_TO_LIVE', flush=True)

    result = subprocess.run(
        ['/usr/bin/node', str(DEP / 'node_modules/typescript/lib/tsc.js'), '--noEmit'],
        cwd=DEST, env=environment, user=user.pw_uid, group=user.pw_gid,
        capture_output=True, text=True, timeout=110,
    )
    if result.returncode:
        print(result.stdout[-2200:], flush=True)
        refuse('isolated TypeScript check failed; production unchanged')
    print('DEBIT_V3_TYPECHECK_PASS', flush=True)
    result = subprocess.run(
        ['/usr/bin/nice', '-n', '10', '/usr/bin/node',
         str(DEP / 'node_modules/next/dist/bin/next'), 'build'],
        cwd=DEST, env=environment, user=user.pw_uid, group=user.pw_gid,
        capture_output=True, text=True, timeout=350,
    )
    if result.returncode or 'configuration.incomplete' in result.stdout:
        print(result.stdout[-2200:], flush=True)
        refuse('isolated Next.js build failed; production unchanged')
    build_id = DEST / '.next/BUILD_ID'
    if not build_id.is_file():
        refuse('candidate build ID missing')
    if production_pid() != pid:
        refuse('active production process changed during build')
    print('DEBIT_V3_BUILD_PASS', flush=True)
    print('DEBIT_V3_BUILD_ID=' + build_id.read_text().strip(), flush=True)
    print('DEBIT_V3_WALLET_SHA256=' + sha((DEST / REL).read_bytes()), flush=True)
    print('POLICIES_CAPS_GEO_KYC_AND_ALL_OTHER_SOURCE_UNCHANGED', flush=True)
    print('NO_SIGNED_CALLBACK_OR_MONEY_WRITES', flush=True)
    print('PRODUCTION_3098_UNCHANGED', flush=True)
except subprocess.TimeoutExpired:
    refuse('isolated build timeout; production unchanged')
