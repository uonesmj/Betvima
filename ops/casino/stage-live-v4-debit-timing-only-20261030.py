#!/usr/bin/env python3
"""Stage a source-exact, opt-in measurement around authenticated ordinary USD Debit.

NO financial, wallet, limit, KYC, geo, response or call-order change. Reads
the exact running 3098 route only, stages modified route under /root, and
never deploys or changes the live 3098 release. Only the signed Debit
settlement branch is timed; no player IDs, amounts, balances or URLs logged.
"""
from __future__ import annotations
from pathlib import Path
import hashlib
import os
import difflib

LIVE = Path('/opt/nova-releases/casino-3098-eligible-fallback-HU6Rbl')
REL = Path('src/app/api/webhooks/softaggregator/route.ts')
OUTPUT = Path('/root/betvima-v4-debit-timing-20261030/route.ts')
SOURCE_SHA = 'fca89762e8ff325b229084de1c334c6a39b6ed8a9157e209131afab36556676f'
BEFORE = """  try {
    const result = await withCasinoCallbackTimeoutReuse(
      () => settleCasinoCallback(event),
    );
    return reply(result.error, result.balance);
  } catch (err) {
    // Never acknowledge a failed database transaction as successful.
    console.error('softaggregator.callback.failed', err instanceof Error ? err.name : 'unknown');
    return reply(2);
  }"""
AFTER = """  // Measurement ONLY. This is entered after BOTH existing callback
  // signatures and the strict provider callback contract are verified.
  // It does not affect Balance, Credit, Rollback, limits or settlements.
  const debitTiming = process.env.SOFTAGGREGATOR_DEBIT_V4_TIMING === 'true' &&
    event.action === 'debit' && !event.rollback && event.currency === 'USD';
  const debitStarted = debitTiming ? process.hrtime.bigint() : 0n;
  try {
    const result = await withCasinoCallbackTimeoutReuse(
      () => settleCasinoCallback(event),
    );
    return reply(result.error, result.balance);
  } catch (err) {
    // Never acknowledge a failed database transaction as successful.
    console.error('softaggregator.callback.failed', err instanceof Error ? err.name : 'unknown');
    return reply(2);
  } finally {
    if (debitTiming) {
      // This measures authenticated Debit settlement; NOT network latency
      // from provider through CDN, Nginx, and browser.
      const elapsed = Number(process.hrtime.bigint() - debitStarted) / 1_000_000;
      console.info(JSON.stringify({
        event: 'casino.debit.v4.settlement_latency',
        settlement_ms: Math.round(elapsed * 10) / 10,
      }));
    }
  }"""

def refuse(reason):
    raise SystemExit('REFUSED: ' + reason)

def sha(v):
    return hashlib.sha256(v).hexdigest()

def patch(source):
    if source.count(BEFORE) != 1:
        refuse('exact Debit settlement original block differs')
    if source.count("if (!verifySupplierCallbackSignature(url, request.headers.get('x-signature'), salt))") != 1:
        refuse('supplier signature gate changed')
    if source.count("if (!event) return reply(2);") != 1:
        refuse('Edge signed callback validation changed')
    modified = source.replace(BEFORE, AFTER, 1)
    if modified.replace(AFTER, BEFORE, 1) != source:
        refuse('noninstrumentation edit detected')
    return modified

if __name__ == '__main__':
    if os.geteuid() != 0:
        refuse('root required')
    if OUTPUT.exists() or OUTPUT.parent.exists():
        refuse('existing stage must not be overwritten')
    if LIVE.is_symlink() or not LIVE.is_dir():
        refuse('live release missing or symlink')
    p = LIVE / REL
    if p.is_symlink() or not p.is_file():
        refuse('active callback route missing or symlink')
    raw = p.read_bytes()
    if sha(raw) != SOURCE_SHA:
        refuse('live route hash changed')
    modified = patch(raw.decode('utf-8'))
    OUTPUT.parent.mkdir(mode=0o700)
    OUTPUT.write_text(modified)
    OUTPUT.chmod(0o600)
    print('V4_DEBIT_ONLY_TIMING_SOURCE_STAGED')
    print('ROUTE_LIVE_SHA256='+SOURCE_SHA)
    print('ROUTE_STAGED_SHA256='+sha(modified.encode()))
    print('ONLY_SIGNED_ORDINARY_USD_DEBIT_TIMED=true')
    print('ALL_FINANCIAL_AND_POLICY_BEHAVIOR_UNCHANGED=true')
    print('PRODUCTION_3098_UNCHANGED=true')
    for x in difflib.unified_diff(raw.decode().splitlines(),modified.splitlines(),
            fromfile='live_3098_route',tofile='staged_v4_route',lineterm=''):
        print(x)
