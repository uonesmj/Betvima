#!/usr/bin/env python3
"""Stage ONLY the existing-wallet read optimization from the exact live 3098 source.

No V1 daily/weekly limit-read skipping; NO changes to policies, geographic
restrictions, wallet rules, ledger, receipts, credit, balance or rollback.
Does NOT build, publish, reload, route, or touch production.
"""
from __future__ import annotations
import difflib
import hashlib
import os
import re
import subprocess
from pathlib import Path

LIVE = Path('/opt/nova-releases/casino-3098-eligible-fallback-HU6Rbl')
DEST = Path('/root/betvima-debit-v3-wallet-only-stage-20261030')
REL = Path('src/server/providers/softaggregator/wallet.ts')
SOURCE_SHA = '9df555a7e3f04354019435e8e9318675587eb9b401422c0e70e7cc16727ff5af'

BEFORE = """    await tx.query(
      "insert into nova.wallets(user_id,currency,balance_minor) values ($1,'USD',0) on conflict (user_id,currency) do nothing",
      [userId],
    );
    const w = await walletRow(tx, userId, true);"""
AFTER = """    // Ordinary Debit ONLY: a pre-existing USD wallet needs no redundant
    // INSERT ON CONFLICT; keep SELECT FOR UPDATE and all financial locks.
    // Missing wallet keeps original INSERT; other actions keep exact flow.
    let w = event.action === 'debit' && !event.rollback
      ? await walletRow(tx, userId, true)
      : null;
    if (!w) {
      await tx.query(
        "insert into nova.wallets(user_id,currency,balance_minor) values ($1,'USD',0) on conflict (user_id,currency) do nothing",
        [userId],
      );
      w = await walletRow(tx, userId, true);
    }"""

def refuse(message):
    raise SystemExit('REFUSED: ' + message)

def digest(data):
    return hashlib.sha256(data).hexdigest()

def patch(source):
    if source.count(BEFORE) != 1:
        refuse('wallet lock and insert path no longer matches approved source')
    expected = (
        "await tx.query('select pg_advisory_xact_lock(hashtext($1))', "
        "['wallet:' + userId + ':USD']);"
    )
    if source.count(expected) != 1:
        refuse('advisory wallet lock differs')
    if source.count('if (event.rollback && event.action') != 2:
        refuse('rollback branch differs')
    if source.count('const isDebit = event.action') != 1:
        refuse('debit path differs')
    after = source.replace(BEFORE, AFTER, 1)
    if after.replace(AFTER, BEFORE, 1) != source:
        refuse('unexpected non-debit source modification')
    return after

if __name__ == '__main__':
    if os.geteuid() != 0: refuse('root required')
    if DEST.exists() or DEST.is_symlink(): refuse('staging destination exists')
    if LIVE.is_symlink() or not LIVE.is_dir(): refuse('pinned release missing')
    result = subprocess.run(['ss', '-ltnpH'], capture_output=True, text=True, timeout=8)
    pids = re.findall(r':3098\\s+[^\\n]*?pid=(\\d+)', result.stdout)
    if result.returncode or len(pids) != 1:
        refuse('cannot pin active production process')
    if Path('/proc/' + pids[0] + '/cwd').resolve() != LIVE:
        refuse('production release different')
    wallet = LIVE / REL
    if wallet.is_symlink() or not wallet.is_file():
        refuse('live wallet source not regular file')
    source_bytes = wallet.read_bytes()
    if digest(source_bytes) != SOURCE_SHA:
        refuse('source hash changed')
    source = source_bytes.decode('utf-8')
    patched = patch(source)
    DEST.mkdir(mode=0o700)
    out = DEST / REL
    out.parent.mkdir(parents=True, mode=0o700)
    out.write_text(patched)
    out.chmod(0o600)
    print('DEBIT_V3_ONLY_STAGED')
    print('ORIGINAL_LIVE_SHA256=' + SOURCE_SHA)
    print('STAGED_WALLET_SHA256=' + digest(patched.encode()))
    print('NO_LIMIT_READ_SKIP=TRUE')
    print('POLICIES_KYC_GEO_CAPS_UNCHANGED=TRUE')
    print('CREDIT_BALANCE_ROLLBACK_UNCHANGED=TRUE')
    print('LEDGER_RECEIPTS_LOCK_ORDER_UNCHANGED=TRUE')
    print('PRODUCTION_3098_UNCHANGED=TRUE')
    for line in difflib.unified_diff(
        source.splitlines(), patched.splitlines(),
        fromfile='running_3098_wallet', tofile='staged_debit_v3',
        lineterm='',
    ):
        print(line)
