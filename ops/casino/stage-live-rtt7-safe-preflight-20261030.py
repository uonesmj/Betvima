#!/usr/bin/env python3
"""Stage RTT7: overlap independent read-only callback preflight on LIVE-compatible RTT6.

No publication. No schema changes. Only replaces LIVE's ordinary-debit-only
preflight scheduling with concurrent reads for ordinary debit, credit and
balance. Every schema/binding/round check remains. Rollback stays sequential.
The exact original LIVE wallet and fully staged RTT6 wallet are hash-pinned.
"""
from __future__ import annotations
import difflib, hashlib, os, re, subprocess
from pathlib import Path

LIVE = Path('/opt/nova-releases/casino-3098-eligible-fallback-HU6Rbl')
RTT6 = Path('/opt/nova-releases/casino-rtt6-3098-candidate-20261030')
DEST = Path('/root/betvima-rtt7-safe-preflight-stage-20261030')
REL = Path('src/server/providers/softaggregator/wallet.ts')
LIVE_SHA = '9df555a7e3f04354019435e8e9318675587eb9b401422c0e70e7cc16727ff5af'
RTT6_SHA = 'cb2bb59200babf0f6429c0ab565bdbb12972d396c2c288e2f36bdf55eac33bf5'

def fail(message): raise SystemExit('REFUSED: ' + message)
def digest(data): return hashlib.sha256(data).hexdigest()

if os.geteuid() != 0: fail('root required')
if DEST.exists() or DEST.is_symlink(): fail('stage already exists')
if any(not d.is_dir() or d.is_symlink() for d in (LIVE, RTT6)):
    fail('candidate or live source release missing')
port = subprocess.run(['ss', '-ltnpH'], capture_output=True, text=True, timeout=8)
pids = re.findall(r':3098\s+[^\n]*?pid=(\d+)', port.stdout)
if port.returncode or len(pids) != 1 or Path('/proc/'+pids[0]+'/cwd').resolve() != LIVE:
    fail('production 3098 release changed')
if digest((LIVE / REL).read_bytes()) != LIVE_SHA:
    fail('unexpected live wallet source')
src_bytes = (RTT6 / REL).read_bytes()
if digest(src_bytes) != RTT6_SHA:
    fail('unexpected RTT6 wallet source')
src = src_bytes.decode()
# Match only the independent, READ-ONLY preflight flag. Never alter SQL,
# transaction statements, eligibility helpers, receipt or wallet posting code.
definition = re.compile(
    r"const normalDebit\s*=\s*event\.action\s*===\s*'debit'\s*&&\s*"
    r"!event\.rollback\s*&&\s*Boolean\(event\.roundId\s*&&\s*event\.gameId\);"
)
matches = list(definition.finditer(src))
if len(matches) != 1:
    fail('preflight flag not recognized: expected exactly one normalDebit')
if src.count('normalDebit') != 2 or src.count('if (normalDebit) {') != 1:
    fail('unexpected preflight variable use')
replacement = """const parallelReadOnlyPreflight =
    event.action === 'balance' ||
    ((event.action === 'debit' || event.action === 'credit') &&
     !event.rollback && Boolean(event.roundId && event.gameId));"""
patched = definition.sub(replacement, src, count=1)
patched = patched.replace('if (normalDebit) {','if (parallelReadOnlyPreflight) {', 1)
if patched == src or patched.count('parallelReadOnlyPreflight') != 2:
    fail('no safe change made')
# Keep ALL guards and queries exactly as before; validate only 2 edits.
if patched.replace(replacement, matches[0].group(0)).replace(
    'if (parallelReadOnlyPreflight) {','if (normalDebit) {',1) != src:
    fail('unexpected diff outside preflight flag')
DEST.mkdir(mode=0o700)
file = DEST / REL
file.parent.mkdir(parents=True, mode=0o700)
file.write_text(patched)
file.chmod(0o600)
print('RTT7_READONLY_PREFLIGHT_STAGED')
print('STAGED_WALLET_SHA256=' + digest(patched.encode()))
print('DEBIT_CREDIT_BALANCE_FRESH_READS_PARALLEL')
print('ROLLBACK_SEQUENTIAL_UNCHANGED')
print('KYC_COUNTRY_LEDGER_LOCKS_AND_FINANCIAL_SQL_UNCHANGED')
print('PRODUCTION_3098_UNCHANGED')
for line in difflib.unified_diff(src.splitlines(), patched.splitlines(),
    fromfile='RTT6_wallet', tofile='RTT7_staged_wallet', lineterm=''):
    print(line)
print('NEXT=build_separate_candidate_and_test_before_any_live_routing')
