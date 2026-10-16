/**
 * READ-ONLY provider-to-ledger conformance audit.
 * Usage on a trusted application host with an existing DB connection:
 * SOFTAGGREGATOR_RECONCILE_USER_ID=<test-player-uuid> npm run casino:reconcile
 * No credentials, callback signatures, balances or session URLs are logged.
 * Exits nonzero on missing/mismatched rounds. Does not modify any data.
 */
import { getDb } from '../src/server/db/index';
import { casinoFinancialSchemaReady } from '../src/server/providers/softaggregator/financial-readiness';
import { callSoftAggregator } from '../src/server/providers/softaggregator/client';
import { playerUsername } from '../src/server/providers/softaggregator/contract';
import {
  compareCasinoHistory,
  type ProviderRound, type SignedReceipt,
} from '../src/server/providers/softaggregator/reconcile';

async function run(): Promise<void> {
  const userId = (process.env.SOFTAGGREGATOR_RECONCILE_USER_ID ?? '').trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
    throw new Error('CASINO_RECONCILE_USER_ID_REQUIRED');
  }
  const db = getDb();
  if (!(await casinoFinancialSchemaReady(db))) throw new Error('CASINO_SCHEMA_NOT_READY');
  const result = await callSoftAggregator<{ rounds?: ProviderRound[] }>('getPlayerHistory', {
    user_username: playerUsername(userId), limit: 100, offset: 0,
  });
  if (!Array.isArray(result.rounds) || result.rounds.length === 0) {
    throw new Error('CASINO_NO_PROVIDER_ROUNDS_TO_RECONCILE');
  }
  const ids = result.rounds.map((round) => round.round_id);
  const receipts = await db.query<SignedReceipt>(`
    select round_id,game_id,action,rollback,amount_minor::text
    from nova.softaggregator_callback_receipts
    where user_id=$1 and response_error=0 and round_id=any($2::text[])
  `, [userId, ids]);
  const summary = compareCasinoHistory(result.rounds, receipts);
  const counts = {
    matched: summary.filter((x) => x.status === 'matched').length,
    mismatch: summary.filter((x) => x.status === 'mismatch').length,
    missing: summary.filter((x) => x.status === 'missing').length,
    skipped: summary.filter((x) => x.status === 'skipped').length,
  };
  console.log(JSON.stringify({ readOnly: true, providerRounds: summary.length, counts }));
  if (counts.mismatch || counts.missing || !counts.matched) {
    // Do not include game URLs, user ID, vendor credentials, wallet identifiers.
    throw new Error('CASINO_RECONCILIATION_NOT_PASSED');
  }
}

run().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : 'CASINO_RECONCILIATION_ERROR');
  process.exitCode = 1;
});
