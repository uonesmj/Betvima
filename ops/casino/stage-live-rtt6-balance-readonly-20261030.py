#!/usr/bin/env python3
"""Safely stage a read-only Balance callback optimization from exact active 3098.

Never changes the live release, Nginx, environment, production DB or any
already-built candidate. Stages ONLY a wallet.ts diff, guarded by the audited
LIVE SHA-256. Tests and an isolated rebuild are mandatory before deployment.
"""
from __future__ import annotations
import difflib, hashlib, os, re, subprocess
from pathlib import Path

LIVE = Path('/opt/nova-releases/casino-3098-eligible-fallback-HU6Rbl')
CAND = Path('/opt/nova-releases/casino-rtt5-3098-candidate-20261030')
DEST = Path('/root/betvima-rtt6-balance-stage-20261030')
WALLET = Path('src/server/providers/softaggregator/wallet.ts')
EXPECTED_SHA256 = '9df555a7e3f04354019435e8e9318675587eb9b401422c0e70e7cc16727ff5af'
BEFORE = """  if (event.action === 'balance') {
    const p = await getProfile(db, userId);
    if (!p || !accountCanBet(p)) return { error: 2, balance: 0 };
    return safeResponse(0, available(await walletRow(db, userId, false)));
  }"""
AFTER = """  if (event.action === 'balance') {
    // Independent, read-only queries may share network wait. The same fresh
    // eligibility gate must pass before any amount can be returned.
    const [p, wallet] = await Promise.all([
      getProfile(db, userId),
      walletRow(db, userId, false),
    ]);
    if (!p || !accountCanBet(p)) return { error: 2, balance: 0 };
    return safeResponse(0, available(wallet));
  }"""

def fail(msg):
    raise SystemExit('REFUSED: ' + msg)

def digest(data):
    return hashlib.sha256(data).hexdigest()

if os.geteuid() != 0: fail('root required')
if DEST.exists(): fail('existing stage would be overwritten')
if not LIVE.is_dir() or not CAND.is_dir(): fail('source release missing')
if LIVE.is_symlink() or CAND.is_symlink(): fail('symlink release not permitted')
result = subprocess.run(['ss', '-ltnpH'], capture_output=True, text=True, timeout=8)
if result.returncode != 0: fail('ss failed')
pid = re.findall(r':3098\s+[^\n]*?pid=(\d+)', result.stdout)
if len(pid) != 1 or Path('/proc/' + pid[0] + '/cwd').resolve() != LIVE:
    fail('live 3098 release changed')
live = (LIVE / WALLET).read_bytes()
candidate = (CAND / WALLET).read_bytes()
if digest(live) != EXPECTED_SHA256 or candidate != live:
    fail('wallet differs from frozen live baseline')
source = live.decode('utf-8')
if source.count(BEFORE) != 1: fail('read-only balance anchor unexpectedly changed')
updated = source.replace(BEFORE, AFTER)
if updated == source: fail('no change')
if 'accountCanBet(p)' not in AFTER or 'walletRow(db, userId, false)' not in AFTER:
    fail('read-only authorization check incomplete')
DEST.mkdir(mode=0o700)
target = DEST / WALLET
target.parent.mkdir(mode=0o700, parents=True)
target.write_text(updated)
target.chmod(0o600)
print('RTT6_SAFE_STAGE_CREATED')
print('ACTIVE_WALLET_SHA256=' + digest(live))
print('STAGED_WALLET_SHA256=' + digest(updated.encode()))
print('NO_LEDGER_OR_LOCK_OR_ELIGIBILITY_LOGIC_CHANGED')
print('PRODUCTION_AND_RTT5_CANDIDATE_UNCHANGED')
print('===== REVIEW PATCH =====')
for line in difflib.unified_diff(
    source.splitlines(), updated.splitlines(),
    fromfile='LIVE_wallet.ts', tofile='STAGED_wallet.ts', lineterm='',
):
    print(line)
print('===== PREFLIGHT STRUCTURE FOR NEXT OPTIMIZATION =====')
begin = source.find('export async function settleCasinoCallback(')
end = source.find('  if (currency ===', begin)
if begin < 0 or end < 0: fail('unknown preflight structure')
for line in source[begin:end].splitlines():
    if any(token in line for token in (
        'FinancialSchemaReady', 'readCasinoPlayerWallet', 'Promise.all',
        'originalRound', 'schemaReady', 'event.action',
        'event.rollback', 'readOriginalRound', 'const currency',
        'const db = getDb()', 'return { error: 2',
    )):
        print(line)
print('===== NEXT: build and test an isolated RTT6 candidate; NOT DEPLOYED =====')
