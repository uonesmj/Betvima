#!/usr/bin/env python3
"""RTT8 staged-only existing-wallet fastpath, SHA pinned to audited RTT7.

Reads the live production release to verify it has not changed. Produces only
a new wallet.ts under /root, never edits code, Nginx, DB, PM2, or callbacks.
Avoids an unnecessary upsert ONLY when SELECT FOR UPDATE found a wallet.
If absent, it runs the exact former upsert and re-lock sequence.
"""
from __future__ import annotations
import difflib
import hashlib
import os
import re
import subprocess
from pathlib import Path

LIVE = Path('/opt/nova-releases/casino-3098-eligible-fallback-HU6Rbl')
BASE = Path('/opt/nova-releases/casino-rtt7-3098-candidate-20261030')
DEST = Path('/root/betvima-rtt8-wallet-fastpath-stage-20261030')
REL = Path('src/server/providers/softaggregator/wallet.ts')
LIVE_SHA = '9df555a7e3f04354019435e8e9318675587eb9b401422c0e70e7cc16727ff5af'
BASE_SHA = '6c9c0e69422bfa858d4ba8da50e043f893df917d1981c85191805bef2cf745e1'
BEFORE = """    await tx.query(
      "insert into nova.wallets(user_id,currency,balance_minor) values ($1,'USD',0) on conflict (user_id,currency) do nothing",
      [userId],
    );
    const w = await walletRow(tx, userId, true);"""
AFTER = """    // Existing wallets dominate signed casino rounds. Avoid an unnecessary
    // INSERT ... ON CONFLICT network trip on that path. The advisory wallet
    // lock has already been taken, and SELECT FOR UPDATE remains mandatory.
    // For a genuinely absent wallet, preserve the original create-then-lock
    // behavior (including all following checks and ledger posting semantics).
    let w = await walletRow(tx, userId, true);
    if (!w) {
      await tx.query(
        "insert into nova.wallets(user_id,currency,balance_minor) values ($1,'USD',0) on conflict (user_id,currency) do nothing",
        [userId],
      );
      w = await walletRow(tx, userId, true);
    }"""

def refuse(message):
    raise SystemExit('REFUSED: ' + message)
def sha(data):
    return hashlib.sha256(data).hexdigest()
if os.geteuid() != 0:
    refuse('root required')
if DEST.exists() or DEST.is_symlink():
    refuse('staging destination exists')
if any(not x.is_dir() or x.is_symlink() for x in (LIVE,BASE)):
    refuse('pinned live/RTT7 release unavailable')
sockets = subprocess.run(['ss','-ltnpH'],capture_output=True,text=True,timeout=8)
pids = re.findall(r':3098\s+[^\n]*?pid=(\d+)',sockets.stdout)
if sockets.returncode or len(pids)!=1 or Path('/proc/'+pids[0]+'/cwd').resolve()!=LIVE:
    refuse('active 3098 release changed')
if (BASE/'.next/BUILD_ID').read_text().strip()!='_zFdzPJOIAEA-kPvh_J2i':
    refuse('RTT7 baseline build changed')
if sha((LIVE/REL).read_bytes()) != LIVE_SHA:
    refuse('live financial source changed')
original = (BASE/REL).read_bytes()
if sha(original)!=BASE_SHA:
    refuse('RTT7 candidate financial source changed')
src = original.decode('utf-8')
if src.count(BEFORE)!=1:
    refuse('existing-wallet anchor not recognized')
patched = src.replace(BEFORE,AFTER,1)
if patched==src or patched.replace(AFTER,BEFORE,1)!=src:
    refuse('unexpected modifications outside wallet lookup')
DEST.mkdir(mode=0o700)
out=DEST/REL
out.parent.mkdir(parents=True,mode=0o700)
out.write_text(patched)
out.chmod(0o600)
print('RTT8_WALLET_FASTPATH_STAGED')
print('RTT8_WALLET_SHA256='+sha(patched.encode()))
print('LOCK_AND_LEDGER_CODE_UNCHANGED')
print('MISSING_WALLET_FALLBACK_RETAINED')
print('ROLLBACK_KYC_COUNTRY_CHECKS_UNCHANGED')
print('PRODUCTION_3098_UNCHANGED')
for line in difflib.unified_diff(src.splitlines(),patched.splitlines(),
    fromfile='RTT7_wallet',tofile='RTT8_staged_wallet',lineterm=''):
    print(line)
print('NEXT=build_and_test_separate_candidate')
