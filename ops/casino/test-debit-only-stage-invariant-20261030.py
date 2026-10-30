#!/usr/bin/env python3
"""Offline regression: Debit-only staging changes exactly one guarded region."""
from __future__ import annotations
import importlib.util
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / 'ops/casino/stage-live-debit-only-limit-read-20261030.py'
WALLET = ROOT / 'src/server/providers/softaggregator/wallet.ts'
spec = importlib.util.spec_from_file_location('debit_patch_under_test', SCRIPT)
assert spec is not None and spec.loader is not None
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

src = WALLET.read_text(encoding='utf-8')
patched = mod.patch_debit_only(src)
assert patched != src
assert patched == src.replace(mod.ANCHOR, mod.ANCHOR + mod.INSERT, 1)
assert patched.replace(mod.ANCHOR + mod.INSERT, mod.ANCHOR, 1) == src
assert patched.count(mod.INSERT) == 1

# Debit-only: preserve the structure and invocation counts of every other
# signed callback action, all locks, all ledger writes and all receipt writes.
for marker in (
    "const isDebit = event.action === 'debit';",
    "const ordinaryCredit = event.action === 'credit' && !event.rollback;",
    "const existing = await tx.queryOne<ReceiptRow>",
    "pg_advisory_xact_lock",
    "post_wallet_entry",
    "softaggregator_callback_receipts",
):
    assert patched.count(marker) == src.count(marker), marker

def must_refuse(bad: str):
    try:
        mod.patch_debit_only(bad)
    except SystemExit as error:
        assert str(error).startswith('REFUSED:')
    else:
        raise AssertionError('unsafe source unexpectedly accepted')

must_refuse(src.replace(
    'await pilotCasinoDebitPermitted(db, userId, amount)',
    'true', 1,
))
must_refuse(src.replace(
    "const isDebit = event.action === 'debit';",
    "const isDebit = event.action !== 'credit';", 1,
))
must_refuse(src.replace(
    'await limitAllows(tx, userId, event.amountMinor!, p)',
    'true', 1,
))
print('DEBIT_PATCH_INVARIANT_PASS')
print('ONLY_ONE_OPTIONAL_AGGREGATE_GUARD_CHANGED')
print('CREDIT_BALANCE_ROLLBACK_LEDGER_UNCHANGED')
