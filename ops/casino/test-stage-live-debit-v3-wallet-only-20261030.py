#!/usr/bin/env python3
"""Synthetic negative-path checks for exact-source Debit-only staging patch."""
import importlib.util
from pathlib import Path

target = Path(__file__).with_name('stage-live-debit-v3-wallet-only-20261030.py')
spec = importlib.util.spec_from_file_location('debit_v3_stage', target)
assert spec is not None and spec.loader is not None
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

src = (
    'const header = "unchanged";\n'
    + "await tx.query('select pg_advisory_xact_lock(hashtext($1))', ['wallet:' + userId + ':USD']);\n"
    + 'if (event.rollback && event.action === \'debit\') {}\n'
    + 'if (event.rollback && event.action === \'credit\') {}\n'
    + "const isDebit = event.action === 'debit';\n"
    + 'async function limitAllows() { return false; }\n'
    + module.BEFORE
    + '\nconst ledger = "unchanged";\n'
)
patched = module.patch(src)
assert patched != src
assert patched.count(module.AFTER) == 1
assert patched.replace(module.AFTER, module.BEFORE, 1) == src
assert 'async function limitAllows() { return false; }' in patched
assert patched.count('const ledger = "unchanged"') == 1
assert patched.count('const header = "unchanged"') == 1
assert 'event.action === \'debit\' && !event.rollback' in patched
assert 'on conflict (user_id,currency) do nothing' in patched
assert 'await walletRow(tx, userId, true)' in patched

for source in [
    src.replace(module.BEFORE, 'const walletRule = "changed";'),
    src.replace('const isDebit = event.action', 'const isCredit = event.action'),
    src.replace("if (event.rollback && event.action === 'credit') {}", ''),
]:
    try:
        module.patch(source)
    except SystemExit as exc:
        assert str(exc).startswith('REFUSED:')
    else:
        raise AssertionError('unsafe stage patch did not fail closed')
print('DEBIT_V3_EXACT_ONLY_PATCH_TEST_PASS')
