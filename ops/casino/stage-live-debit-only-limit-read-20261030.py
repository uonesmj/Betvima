#!/usr/bin/env python3
"""Fail-closed, Debit-only staging from the exact active casino wallet source.

Does not edit the live release, app, Nginx, services, database or accounts.
An existing pilot wagering-cap query remains mandatory. Only the optional
aggregate-wallet-history read is skipped when all three personal limits are
explicitly NULL. No other eligibility or accounting logic changes.
"""
from __future__ import annotations

import difflib
import hashlib
import os
from pathlib import Path
import re
import subprocess

LIVE = Path('/opt/nova-releases/casino-3098-eligible-fallback-HU6Rbl')
DEST = Path('/root/betvima-debit-only-stage-20261030')
REL = Path('src/server/providers/softaggregator/wallet.ts')
PINNED_LIVE_SHA = '9df555a7e3f04354019435e8e9318675587eb9b401422c0e70e7cc16727ff5af'
ANCHOR = (
    '  if (p.max_stake_per_bet_minor !== null && '
    'amount > BigInt(p.max_stake_per_bet_minor)) return false;\n'
)
INSERT = (
    '  // Debit only. The independent pilot cap above always runs first.\n'
    '  // If no personal aggregate cap exists, the wallet history aggregation\n'
    '  // cannot alter the decision, so avoid its remote database round-trip.\n'
    '  if (p.max_stake_per_day_minor === null &&\n'
    '      p.loss_limit_daily_minor === null &&\n'
    '      p.loss_limit_weekly_minor === null) return true;\n'
)


def refuse(message: str) -> None:
    raise SystemExit('REFUSED: ' + message)


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def patch_debit_only(src: str) -> str:
    signature = 'async function limitAllows(db: Db, userId: string, amount: bigint, p: ProfileRow): Promise<boolean> {'
    end_marker = 'export async function settleCasinoCallback(event: SignedCallback)'
    if src.count(signature) != 1 or src.count(end_marker) != 1:
        refuse('unexpected Debit limit helper or callback structure')
    start = src.index(signature)
    end = src.index(end_marker, start)
    segment = src[start:end]
    if src.count(ANCHOR) != 1 or segment.count(ANCHOR) != 1:
        refuse('personal-limit guard missing or changed')
    if segment.count('await pilotCasinoDebitPermitted(db, userId, amount)') != 1:
        refuse('mandatory pilot caps missing or moved')
    if segment.count('from nova.wallet_transactions') != 1:
        refuse('wallet history SQL changed')
    if segment.count('p.max_stake_per_day_minor !== null') != 1 or (
        segment.count('p.loss_limit_daily_minor !== null') != 1
        or segment.count('p.loss_limit_weekly_minor !== null') != 1
    ):
        refuse('personal aggregate limits changed')
    # The existing helper must still be used ONLY in the ordinary Debit
    # rejection branch and never by Credit, Balance, or Rollback.
    if src.count('await limitAllows(tx, userId, event.amountMinor!, p)') != 1:
        refuse('Debit call site changed')
    if "const isDebit = event.action === 'debit';" not in src:
        refuse('ordinary Debit branch changed')
    updated = src.replace(ANCHOR, ANCHOR + INSERT, 1)
    if updated.replace(ANCHOR + INSERT, ANCHOR, 1) != src:
        refuse('edit differs outside the intended Debit helper')
    return updated


def main():
    if os.geteuid() != 0:
        refuse('root required')
    if DEST.exists() or DEST.is_symlink():
        refuse('staging destination already exists')
    if not LIVE.is_dir() or LIVE.is_symlink():
        refuse('pinned production release is not a normal directory')
    original = (LIVE / REL).read_bytes()
    if digest(original) != PINNED_LIVE_SHA:
        refuse('active wallet SHA changed')
    listeners = subprocess.run(
        ['ss', '-ltnpH'], capture_output=True, text=True, timeout=8,
    )
    pids = re.findall(r':3098\s+[^\n]*?pid=(\d+)', listeners.stdout)
    if listeners.returncode or len(pids) != 1:
        refuse('unable to uniquely identify live 3098 process')
    if Path('/proc/' + pids[0] + '/cwd').resolve() != LIVE:
        refuse('active 3098 release differs from pinned path')
    before = original.decode('utf-8')
    after = patch_debit_only(before)
    DEST.mkdir(mode=0o700)
    destination = DEST / REL
    destination.parent.mkdir(parents=True, mode=0o700)
    destination.write_text(after, encoding='utf-8')
    destination.chmod(0o600)
    print('DEBIT_ONLY_STAGED', flush=True)
    print('DEBIT_ONLY_WALLET_SHA256=' + digest(after.encode()), flush=True)
    print('SOURCE_HASH_AND_LIVE_PROCESS_VERIFIED', flush=True)
    print('CHANGED_ONLY_DEBIT_LIMIT_HELPER', flush=True)
    print('PILOT_CAPS_LEDGER_RECEIPTS_LOCKS_UNCHANGED', flush=True)
    print('CREDIT_BALANCE_ROLLBACK_UNCHANGED', flush=True)
    print('PRODUCTION_3098_UNCHANGED', flush=True)
    for line in difflib.unified_diff(
        before.splitlines(), after.splitlines(),
        fromfile='pinned_live_wallet', tofile='debit_only_staged',
        lineterm='',
    ):
        print(line)


if __name__ == '__main__':
    main()
