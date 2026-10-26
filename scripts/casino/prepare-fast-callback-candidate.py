#!/usr/bin/env python3
"""Safely stage only the SoftAggregator callback timeout transport optimization.

Run on the existing BetVima VPS (read/write ONLY a fresh isolated release directory).
Do not touch Nginx, PM2, main release, database, credentials, or user/geo/wallet policies.
This adapter intentionally targets the production overlay with
transaction-timeout-context.ts, which differs from the PR base.
"""
import subprocess
from pathlib import Path
from urllib.request import Request, urlopen

BASE = Path('/opt/nova-releases/casino-debit-fast-20261026')
NEW = Path('/opt/nova-releases/casino-callback-rtt3-20261026')
ROUTE = '/api/webhooks/softaggregator'
FILES = (
    'src/server/db/postgres.ts',
    'src/server/providers/softaggregator/wallet.ts',
    'src/server/providers/softaggregator/fiat-wallet.ts',
)


def stop(reason):
    raise SystemExit('STOP: ' + reason)


def replace_once(text, old, new, label):
    if text.count(old) != 1:
        stop(f'UNEXPECTED_SOURCE_{label} (matches={text.count(old)})')
    return text.replace(old, new, 1)


def candidate_files():
    try:
        with urlopen(Request('http://127.0.0.1:3098/', headers={'Host': 'betvima.com'}), timeout=10) as response:
            if response.status != 200:
                stop('CURRENT_CALLBACK_SERVICE_UNHEALTHY')
    except Exception:
        stop('CURRENT_CALLBACK_SERVICE_UNREACHABLE')

    if not BASE.is_dir() or not (BASE / '.next/BUILD_ID').is_file():
        stop('BASE_RELEASE_MISSING')
    if NEW.exists():
        stop('CANDIDATE_ALREADY_EXISTS (never overwrite)')
    timeout_module = BASE / 'src/server/db/transaction-timeout-context.ts'
    if not timeout_module.is_file():
        stop('PRODUCTION_TIMEOUT_CONTEXT_MISSING')

    original = {name: (BASE / name).read_text() for name in FILES}
    pg = original[FILES[0]]
    if 'transaction-timeout-context' not in pg or 'mayReuseStatementTimeoutAfter' not in pg:
        stop('UNEXPECTED_POSTGRES_OVERLAY')
    if 'transactionForCasinoCallback' in pg:
        stop('ALREADY_OPTIMIZED')

    pg = replace_once(pg,
        '  async transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T> {\\n    const client = await this.pool.connect();',
        '''  // The single SET LOCAL optimization is exclusive to ordinary signed casino
  // debit/credit. All other transactions preserve their current behavior.
  async transactionForCasinoCallback<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
    return this.runTransaction(fn, true);
  }

  async transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
    return this.runTransaction(fn, false);
  }

  private async runTransaction<T>(fn: (tx: Db) => Promise<T>, singleTimeout: boolean): Promise<T> {
    const client = await this.pool.connect();''',
        'TRANSACTION_ENTRY')

    pg = replace_once(pg,
        "      await client.query('begin read write');\\n      const tx = new TransactionDb(client, this.statementTimeoutMs, this.kind);",
        """      await client.query('begin read write');
      if (singleTimeout) {
        // SET LOCAL remains in force until COMMIT/ROLLBACK, including after
        // INSERT/UPDATE and the authoritative post_wallet_entry SQL function.
        await client.query(`set local statement_timeout = ${Math.max(1000, Math.trunc(this.statementTimeoutMs))}`);
      }
      const tx = new TransactionDb(client, this.statementTimeoutMs, this.kind, singleTimeout);""",
        'TRANSACTION_BEGIN')

    pg = replace_once(pg,
        """  constructor(private client: PoolClient, private statementTimeoutMs: number, kind: 'postgres' | 'supabase') {
    this.kind = kind;
  }""",
        """  constructor(private client: PoolClient, private statementTimeoutMs: number, kind: 'postgres' | 'supabase', private readonly singleTimeout = false) {
    this.kind = kind;
    if (singleTimeout) this.lastAppliedTimeout = Math.max(1000, Math.trunc(statementTimeoutMs));
  }""",
        'TRANSACTION_CONSTRUCTOR')

    pg = replace_once(pg,
        """    const mustSet = this.reuseIdenticalTimeout
      ? this.lastAppliedTimeout !== effectiveTimeout
      : true;""",
        """    const mustSet = this.singleTimeout
      ? this.lastAppliedTimeout !== effectiveTimeout
      : (this.reuseIdenticalTimeout ? this.lastAppliedTimeout !== effectiveTimeout : true);""",
        'TIMEOUT_GUARD')

    pg = replace_once(pg,
        '      if (!mayReuseStatementTimeoutAfter(sql)) this.lastAppliedTimeout = null;',
        '      if (!this.singleTimeout && !mayReuseStatementTimeoutAfter(sql)) this.lastAppliedTimeout = null;',
        'TIMEOUT_WRITE_INVALIDATION')

    usd = original[FILES[1]]
    usd = replace_once(usd, "import { getDb } from '@/server/db';",
        "import { getDb } from '@/server/db';\\nimport { PostgresDb } from '@/server/db/postgres';",
        'USD_POSTGRES_IMPORT')
    usd = replace_once(usd,
        '  return db.transaction(async (tx) => {',
        '  const executeTransaction = async (tx: Db): Promise<CasinoBalanceResponse> => {',
        'USD_TRANSACTION_ENTRY')
    usd = replace_once(usd,
        '    return safeResponse(error, resultBalance);\\n  });\\n}',
        """    return safeResponse(error, resultBalance);
  };
  // Financial rules, wallet locks, receipt and settlement statements above
  // are unmodified. All rollback operations retain the original transaction.
  return (event.action === 'debit' || event.action === 'credit') &&
    !event.rollback && db instanceof PostgresDb
    ? db.transactionForCasinoCallback(executeTransaction)
    : db.transaction(executeTransaction);
}""",
        'USD_TRANSACTION_EXIT')

    fiat = original[FILES[2]]
    fiat = replace_once(fiat, "import type { Db } from '@/lib/ports/db';",
        "import type { Db } from '@/lib/ports/db';\\nimport { PostgresDb } from '@/server/db/postgres';",
        'FIAT_POSTGRES_IMPORT')
    fiat = replace_once(fiat,
        '  return db.transaction(async (tx) => {',
        '  const executeTransaction = async (tx: Db): Promise<BalanceResult> => {',
        'FIAT_TRANSACTION_ENTRY')
    fiat = replace_once(fiat,
        '    return respond(error, usdBalance);\\n  });\\n}',
        """    return respond(error, usdBalance);
  };
  // Currency conversion, FX, limits and reconciliation above are unmodified.
  // Every rollback keeps its original transaction path.
  return (event.action === 'debit' || event.action === 'credit') &&
    !event.rollback && db instanceof PostgresDb
    ? db.transactionForCasinoCallback(executeTransaction)
    : db.transaction(executeTransaction);
}""",
        'FIAT_TRANSACTION_EXIT')

    return {FILES[0]: pg, FILES[1]: usd, FILES[2]: fiat}


def main():
    files = candidate_files()
    subprocess.run(['cp', '-a', '--reflink=auto', str(BASE), str(NEW)], check=True)
    for name, value in files.items():
        destination = NEW / name
        if not destination.is_file():
            stop('CANDIDATE_MISSING_FILE_' + name)
        destination.write_text(value)
    for name in FILES:
        if (NEW / name).read_text() != files[name]:
            stop('VERIFY_FAILED_' + name)

    print('CANDIDATE_PREPARED')
    print('DIR=' + str(NEW))
    print('MODIFIED_FILES=' + ', '.join(FILES))
    print('NO_NGINX_PM2_DATABASE_OR_WALLET_SCHEMA_CHANGES')
    print('NEXT: typecheck and unit tests, then isolated production build')


if __name__ == '__main__':
    main()
