/**
 * Disposable CI database only. Never run against Supabase/Production.
 *
 * The SQL migration smoke test creates a synthetic local PostgreSQL schema.
 * This checks the SAME application readiness query against deliberately
 * weakened financial guards, each modification rolled back afterwards.
 */
import assert from 'node:assert/strict';
import { Client } from 'pg';
import { casinoFinancialSchemaReady } from '../../src/server/providers/softaggregator/financial-readiness';

async function main() {
  if (process.env.PGHOST !== '127.0.0.1' ||
      process.env.PGDATABASE !== 'postgres' ||
      process.env.PGSSLMODE !== 'disable' ||
      process.env.DATABASE_URL || process.env.SUPABASE_DB_URL ||
      process.env.SOFTAGGREGATOR_REAL_MONEY_ENABLED)
    throw new Error('CASINO_PRECHECK_TEST_REQUIRES_LOCAL_DISPOSABLE_PG');

  const client = new Client();
  await client.connect();
  try {
    const adapter = {
      queryOne: async (sql: string) => {
        const response = await client.query(sql);
        return response.rows[0] ?? null;
      },
    };
    assert.equal(await casinoFinancialSchemaReady(adapter), true,
      'full synthetic migration set must be verified');

    for (const [label, sql] of [
      ['RLS disabled', 'alter table nova.softaggregator_round_fx disable row level security'],
      ['audit trigger disabled', 'alter table nova.softaggregator_callback_receipts disable trigger sa_receipt_immutable'],
      ['receipt-to-ledger trigger disabled', 'alter table nova.softaggregator_callback_receipts disable trigger sa_receipt_integrity_on_insert'],
      ['rollback index removed', 'drop index nova.sa_unique_reversed_debit'],
      ['rollback foreign key missing', 'alter table nova.softaggregator_callback_receipts drop constraint sa_original_debit_receipt_fk'],
      ['posting integrity removed', 'alter table nova.softaggregator_callback_receipts drop constraint sa_receipt_posting_coherent'],
      ['anon granted write access', 'grant insert on nova.softaggregator_callback_receipts to anon'],
      ['authenticated granted write access', 'grant delete on nova.softaggregator_round_fx to authenticated'],
    ] as const) {
      await client.query('begin');
      try {
        await client.query(sql);
        assert.equal(await casinoFinancialSchemaReady(adapter), false, label);
      } finally {
        await client.query('rollback');
      }
      assert.equal(await casinoFinancialSchemaReady(adapter), true,
        'restored after ' + label);
    }
    process.stdout.write('CASINO_CASH_READINESS_FAIL_CLOSED_PASS (synthetic PostgreSQL only)\n');
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(error instanceof Error ? error.message + '\n' : 'Unknown error\n');
  process.exitCode = 1;
});
