#!/usr/bin/env python3
"""Stage second Debit-only optimization from pinned, isolated V1, never live.

Existing wallet fast path skips redundant INSERT ON CONFLICT only for ordinary
Debit; missing wallet still gets original INSERT and FOR UPDATE. Credit,
Balance, Rollback, receipts, locks, KYC, jurisdiction and ledger code unchanged.
"""
from __future__ import annotations
import difflib
import hashlib
import os
from pathlib import Path
import re
import subprocess

LIVE=Path('/opt/nova-releases/casino-3098-eligible-fallback-HU6Rbl')
BASE=Path('/opt/nova-releases/casino-debit-only-3098-candidate-20261030')
DEST=Path('/root/betvima-debit-only-v2-stage-20261030')
REL=Path('src/server/providers/softaggregator/wallet.ts')
LIVE_SHA='9df555a7e3f04354019435e8e9318675587eb9b401422c0e70e7cc16727ff5af'
BASE_SHA='71d8c680ee311d75c2c41a7ec871875a927a3d6120a9fc805b6e07909bda0855'
BASE_BUILD='2rgx_WOZRt8aQvBnAHfkt'
BEFORE="""    await tx.query(
      "insert into nova.wallets(user_id,currency,balance_minor) values ($1,'USD',0) on conflict (user_id,currency) do nothing",
      [userId],
    );
    const w = await walletRow(tx, userId, true);"""
AFTER="""    // Debit-only fast path: keep the wallet advisory lock and SELECT FOR
    // UPDATE. An existing USD wallet does not need INSERT ON CONFLICT.
    // Credit and every rollback still perform the original insert-then-read.
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

def refuse(msg): raise SystemExit('REFUSED: '+msg)
def sha(data): return hashlib.sha256(data).hexdigest()

def patch(source):
    if source.count(BEFORE)!=1:
        refuse('unexpected wallet insert-before-lock code')
    if source.count("await tx.query('select pg_advisory_xact_lock(hashtext($1))', ['wallet:' + userId + ':USD']);")!=1:
        refuse('wallet advisory lock changed')
    if source.count("const isDebit = event.action === 'debit';")!=1:
        refuse('Debit semantics changed')
    if source.count("if (event.rollback && event.action === 'debit')")!=1:
        refuse('reverse-win guard changed')
    patched=source.replace(BEFORE,AFTER,1)
    if patched.replace(AFTER,BEFORE,1)!=source:
        refuse('unexpected edit outside wallet lookup')
    return patched

if __name__=='__main__':
    if os.geteuid()!=0: refuse('root required')
    if DEST.exists() or DEST.is_symlink(): refuse('stage already exists')
    if any(not d.is_dir() or d.is_symlink() for d in (LIVE,BASE)):
        refuse('pinned releases unavailable')
    if sha((LIVE/REL).read_bytes())!=LIVE_SHA:
        refuse('active wallet source changed')
    original=(BASE/REL).read_bytes()
    if sha(original)!=BASE_SHA:
        refuse('Debit V1 wallet differs')
    if (BASE/'.next/BUILD_ID').read_text().strip()!=BASE_BUILD:
        refuse('Debit V1 build ID changed')
    r=subprocess.run(['ss','-ltnpH'],capture_output=True,text=True,timeout=8)
    pids=re.findall(r':3098\s+[^\n]*?pid=(\d+)',r.stdout)
    if r.returncode or len(pids)!=1 or Path('/proc/'+pids[0]+'/cwd').resolve()!=LIVE:
        refuse('production 3098 moved')
    before=original.decode()
    after=patch(before)
    DEST.mkdir(mode=0o700)
    out=DEST/REL
    out.parent.mkdir(parents=True,mode=0o700)
    out.write_text(after)
    out.chmod(0o600)
    print('DEBIT_V2_WALLET_STAGED')
    print('STAGED_WALLET_SHA256='+sha(after.encode()))
    print('ORDINARY_DEBIT_EXISTING_WALLET_INSERT_SKIPPED')
    print('MISSING_WALLET_FALLBACK_RETAINED')
    print('CREDIT_BALANCE_ROLLBACK_UNCHANGED')
    print('FINANCIAL_LOCKS_LEDGER_RECEIPTS_UNCHANGED')
    print('PRODUCTION_3098_UNCHANGED')
    for line in difflib.unified_diff(
        before.splitlines(),after.splitlines(),
        fromfile='isolated_debit_v1',tofile='isolated_debit_v2',lineterm='',
    ):
        print(line)
