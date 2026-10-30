#!/usr/bin/env python3
"""Offline verification of Debit V2 wallet fast-path exact patch boundaries."""
from __future__ import annotations
import importlib.util
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
wallet=(ROOT/'src/server/providers/softaggregator/wallet.ts').read_text()
script=ROOT/'ops/casino/stage-live-debit-only-v2-wallet-20261030.py'
spec=importlib.util.spec_from_file_location('debit_v2_audit',script)
assert spec is not None and spec.loader is not None
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
assert wallet.count(mod.AFTER)==1
previous=wallet.replace(mod.AFTER,mod.BEFORE,1)
assert previous.count(mod.BEFORE)==1
assert mod.patch(previous)==wallet
assert wallet.replace(mod.AFTER,mod.BEFORE,1)==previous
for token in (
    "await tx.query('select pg_advisory_xact_lock(hashtext($1))', ['wallet:' + userId + ':USD']);",
    "const isDebit = event.action === 'debit';",
    "if (event.rollback && event.action === 'debit')",
    "if (event.rollback && event.action === 'credit')",
    "post_wallet_entry",
):
    assert wallet.count(token)==previous.count(token),token

def must_refuse(code):
    try: mod.patch(code)
    except SystemExit as error: assert str(error).startswith('REFUSED:')
    else: raise AssertionError('unsafe source accepted')

must_refuse(previous.replace(
    "await tx.query('select pg_advisory_xact_lock(hashtext($1))', ['wallet:' + userId + ':USD']);",
    "// removed lock",1))
must_refuse(previous.replace(
    "if (event.rollback && event.action === 'debit')",
    "if (event.action === 'debit')",1))
print('DEBIT_V2_STAGE_INVARIANT_PASS')
print('CREDIT_BALANCE_ROLLBACK_LOCKS_UNCHANGED')
