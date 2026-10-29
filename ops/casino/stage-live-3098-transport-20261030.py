#!/usr/bin/env python3
"""Stage a safe transport-only overlay against the EXACT active 3098 release.

No deployment, no Nginx, PM2, SQL, secrets, wallet/KYC/geography edits.
Refuse every unexpected source version or anchor. The generated files can be
copied into a separate isolated test build only after code review.
"""
from __future__ import annotations
import difflib
import hashlib
import os
from pathlib import Path

LIVE = Path('/opt/nova-releases/casino-3098-eligible-fallback-HU6Rbl')
RTT4 = Path('/opt/nova-releases/casino-callback-rtt4-20261026')
DEST = Path('/root/betvima-rtt5-3098-overlay-20261030')
PG = 'src/server/db/postgres.ts'
ROUTE = 'src/app/api/webhooks/softaggregator/route.ts'
MODULE = 'src/server/providers/softaggregator/perf-trace.ts'
WALLET = 'src/server/providers/softaggregator/wallet.ts'
FIAT = 'src/server/providers/softaggregator/fiat-wallet.ts'
PINNED_PG = '3d66c5724ff67ebdbc160ca56fb05e1597ebf38f48a7d01b3482bccae01916a3'
PINNED_WALLET = '9df555a7e3f04354019435e8e9318675587eb9b401422c0e70e7cc16727ff5af'

def stop(msg: str):
    raise SystemExit('REFUSED: ' + msg)

def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()

def change_once(source: str, before: str, after: str, label: str) -> str:
    n = source.count(before)
    if n != 1:
        stop(f'{label}: anchor count={n} (expected 1)')
    return source.replace(before, after, 1)

def main():
    if not LIVE.is_dir() or not RTT4.is_dir():
        stop('source releases missing')
    pg_raw = (LIVE / PG).read_bytes()
    wallet_raw = (LIVE / WALLET).read_bytes()
    if sha(pg_raw) != PINNED_PG or sha(wallet_raw) != PINNED_WALLET:
        stop('active source changed; never patch an unrecognized version')
    if (LIVE / ROUTE).read_bytes() != (RTT4 / ROUTE).read_bytes():
        stop('the callback HTTP signature verification route changed')
    for path in (ROUTE, PG, WALLET, FIAT):
        if not (LIVE / path).is_file():
            stop('missing active source: ' + path)
    if DEST.exists():
        stop('staging destination exists, preserving prior work')

    pg = pg_raw.decode('utf-8')
    pg = change_once(pg,
        "import { param } from './rows';",
        "import { param } from './rows';\nimport { isCasinoSignedTransport, casinoSqlLabel, measureCasinoDb } from '@/server/providers/softaggregator/perf-trace';",
        'import-telemetry')
    pg = change_once(pg,
        '    const result = await this.pool.query(sql, values as unknown[]);',
        "    const result = await measureCasinoDb(casinoSqlLabel(sql), () =>\n      this.pool.query(sql, values as unknown[]));",
        'pool-read-timing')
    pg = change_once(pg,
        '    const client = await this.pool.connect();',
        "    const casinoTransport = isCasinoSignedTransport();\n    const client = await measureCasinoDb('db.pool.acquire', () => this.pool.connect());",
        'tx-pool')
    pg = change_once(pg,
        "      await client.query('begin read write');",
        """      // Signed normal debit/credit only: execute the SAME BEGIN and SET LOCAL
      // in one simple-protocol request, before the financial transaction body.
      // Rollbacks and all other transactions retain the original path.
      const beginSql = casinoTransport
        ? `begin read write; set local statement_timeout = ${Math.max(1000, Math.trunc(this.statementTimeoutMs))}`
        : 'begin read write';
      await measureCasinoDb('db.transaction.begin', () => client.query(beginSql));""",
        'begin-set-local')
    pg = change_once(pg,
        'new TransactionDb(client, this.statementTimeoutMs, this.kind)',
        'new TransactionDb(client, this.statementTimeoutMs, this.kind, casinoTransport)',
        'tx-constructor-call')
    pg = change_once(pg,
        "      await client.query('commit');",
        "      await measureCasinoDb('db.transaction.commit', () => client.query('commit'));",
        'tx-commit')
    pg = change_once(pg,
        "      await client.query('rollback').catch(() => undefined);",
        "      await measureCasinoDb('db.transaction.rollback', () => client.query('rollback')).catch(() => undefined);",
        'tx-rollback')
    pg = change_once(pg,
        "constructor(private client: PoolClient, private statementTimeoutMs: number, kind: 'postgres' | 'supabase') {",
        "constructor(private client: PoolClient, private statementTimeoutMs: number, kind: 'postgres' | 'supabase', private readonly casinoTransport = false) {",
        'constructor')
    pg = change_once(pg,
        "    this.kind = kind;",
        "    this.kind = kind;\n    if (casinoTransport) this.lastAppliedTimeout = Math.max(1000, Math.trunc(statementTimeoutMs));",
        'tx-flag-init')
    pg = change_once(pg,
        """    const mustSet = this.reuseIdenticalTimeout
      ? this.lastAppliedTimeout !== effectiveTimeout
      : true;""",
        """    const mustSet = this.casinoTransport
      ? this.lastAppliedTimeout !== effectiveTimeout
      : (this.reuseIdenticalTimeout ? this.lastAppliedTimeout !== effectiveTimeout : true);""",
        'timeout-preservation')
    pg = change_once(pg,
        '        await this.client.query(`set local statement_timeout = ${effectiveTimeout}`);',
        "        await measureCasinoDb('db.transaction.timeout', () =>\n          this.client.query(`set local statement_timeout = ${effectiveTimeout}`));",
        'tx-timeout-timing')
    pg = change_once(pg,
        '      const result = await this.client.query(sql, values as unknown[]);',
        "      const result = await measureCasinoDb(casinoSqlLabel(sql), () =>\n        this.client.query(sql, values as unknown[]));",
        'tx-sql-timing')
    pg = change_once(pg,
        '      if (!mayReuseStatementTimeoutAfter(sql)) this.lastAppliedTimeout = null;',
        '      if (!this.casinoTransport && !mayReuseStatementTimeoutAfter(sql)) this.lastAppliedTimeout = null;',
        'timeout-lifetime')
    route = (LIVE / ROUTE).read_text()
    route = change_once(route,
        "import { settleCasinoCallback } from '@/server/providers/softaggregator/wallet';",
        "import { settleCasinoCallback } from '@/server/providers/softaggregator/wallet';\nimport { traceCasinoCallback, withCasinoSignedTransport } from '@/server/providers/softaggregator/perf-trace';",
        'route-import')
    route = change_once(route,
        '    const result = await settleCasinoCallback(event);',
        """    const result = await withCasinoSignedTransport(event.action, event.rollback,
      () => traceCasinoCallback(event.action, event.rollback,
        () => settleCasinoCallback(event)));""",
        'signed-route')
    # Embedded, reviewed TypeScript module; no network access or external code.
    module = "/**\n * Opt-in, read-only latency telemetry for authenticated SoftAggregator callbacks.\n * Never log player identifiers, amounts, URL/query strings, SQL values or keys.\n * Timings are grouped by fixed SQL operation labels.\n */\nimport { AsyncLocalStorage } from 'node:async_hooks';\n\ntype Duration = { count: number; totalMs: number; maxMs: number };\ntype Trace = { phases: Record<string, Duration> };\nconst context = new AsyncLocalStorage<Trace>();\nconst transport = new AsyncLocalStorage<boolean>();\n\n// Only signed ordinary Debit/Credit opt into transport-level optimization.\n// Eligibility, policy and accounting functions are deliberately not touched.\nexport async function withCasinoSignedTransport<T>(\n  action: 'balance' | 'debit' | 'credit', rollback: boolean, fn: () => Promise<T>,\n): Promise<T> {\n  if ((action !== 'debit' && action !== 'credit') || rollback) return fn();\n  return transport.run(true, fn);\n}\nexport function isCasinoSignedTransport(): boolean {\n  return transport.getStore() === true;\n}\nconst ms = () => Number(process.hrtime.bigint()) / 1_000_000;\nconst round = (value: number) => Math.round(value * 10) / 10;\n\nexport function casinoSqlLabel(sql: string): string {\n  const s = sql.trimStart().toLowerCase();\n  if (s.startsWith('select pg_advisory_xact_lock')) return 'db.lock';\n  if (s.includes('to_regclass(\\'nova.softaggregator_callback_receipts\\')')) return 'db.schema';\n  if (s.includes('softaggregator_player_wallet_bindings')) return 'db.wallet_binding';\n  if (s.includes('softaggregator_round_fx')) return 'db.round';\n  if (s.includes('softaggregator_callback_receipts')) return 'db.receipt';\n  if (s.includes('post_wallet_entry')) return 'db.ledger';\n  if (s.includes('nova.wallets')) return 'db.wallet';\n  if (s.includes('nova.wallet_transactions')) return 'db.limits';\n  if (s.includes('nova.profiles') || s.includes('nova.user_limits')) return 'db.profile';\n  return 'db.other';\n}\n\nexport async function measureCasinoDb<T>(label: string, fn: () => Promise<T>): Promise<T> {\n  const active = context.getStore();\n  if (!active) return fn();\n  const start = ms();\n  try {\n    return await fn();\n  } finally {\n    const duration = Math.max(0, ms() - start);\n    const current = active.phases[label] ?? { count: 0, totalMs: 0, maxMs: 0 };\n    current.count += 1;\n    current.totalMs += duration;\n    current.maxMs = Math.max(current.maxMs, duration);\n    active.phases[label] = current;\n  }\n}\n\nexport async function traceCasinoCallback<T>(\n  action: 'balance' | 'debit' | 'credit', rollback: boolean,\n  fn: () => Promise<T>,\n): Promise<T> {\n  if (process.env.SOFTAGGREGATOR_CALLBACK_PERF_TRACE !== 'true') return fn();\n  const trace: Trace = { phases: Object.create(null) as Record<string, Duration> };\n  const started = ms();\n  let outcome = 'failed';\n  return context.run(trace, async () => {\n    try {\n      const value = await fn();\n      outcome = 'completed';\n      return value;\n    } finally {\n      const phases = Object.fromEntries(\n        Object.entries(trace.phases)\n          .sort(([a], [b]) => a.localeCompare(b))\n          .map(([name, timing]) => [\n            name,\n            { count: timing.count, total_ms: round(timing.totalMs), max_ms: round(timing.maxMs) },\n          ]),\n      );\n      console.info(JSON.stringify({\n        event: 'casino.callback.latency',\n        action, rollback, outcome,\n        total_ms: round(Math.max(0, ms() - started)),\n        phases,\n      }));\n    }\n  });\n}\n"
    for required in ('export function isCasinoSignedTransport()', 'export async function withCasinoSignedTransport',
                     'export async function traceCasinoCallback', 'export async function measureCasinoDb'):
        if required not in module:
            stop('unrecognized telemetry module')

    # Atomic directory creation; never mutate live files or the real wallet.
    DEST.mkdir(mode=0o700, parents=False, exist_ok=False)
    for path, data in ((PG, pg), (ROUTE, route), (MODULE, module)):
        target = DEST / path
        target.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
        target.write_text(data)
        target.chmod(0o600)
    print('STAGED_ONLY, ZERO_PRODUCTION_CHANGES')
    print('ACTIVE_PG_SHA256', sha(pg_raw))
    print('ACTIVE_WALLET_SHA256', sha(wallet_raw))
    print('WALLET_AND_FIAT_FILES_LEFT_UNTOUCHED')
    for path in (PG, ROUTE, MODULE):
        print('STAGED', path, sha((DEST / path).read_bytes()))
    for label, original, patched in (('POSTGRES', pg_raw.decode('utf-8'), pg),
                                     ('WEBHOOK', (LIVE / ROUTE).read_text(), route)):
        diff = list(difflib.unified_diff(original.splitlines(), patched.splitlines(),
                   fromfile='active/'+label, tofile='staged/'+label, lineterm=''))
        print(label + '_DIFF_BEGIN')
        print('\n'.join(diff[:150]))
        print(label + '_DIFF_END')
    print('NEXT: review staged patches; do not deploy over port 3098 yet')

if __name__ == '__main__':
    main()
