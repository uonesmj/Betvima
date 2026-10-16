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
import { readCompleteCasinoHistory, type CasinoHistoryPage } from '../src/server/providers/softaggregator/history-pages';
import {
  compareCasinoHistory,
  type SignedReceipt,
} from '../src/server/providers/softaggregator/reconcile';

async function run(): Promise<void> {
  const userId = (process.env.SOFTAGGREGATOR_RECONCILE_USER_ID ?? '').trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
    throw new Error('CASINO_RECONCILE_USER_ID_REQUIRED');
  }
  const db = getDb();
  if (!(await casinoFinancialSchemaReady(db))) throw new Error('CASINO_SCHEMA_NOT_READY');
  const rounds = await readCompleteCasinoHistory((limit, offset) =>
    callSoftAggregator<CasinoHistoryPage>('getPlayerHistory', {
      user_username: playerUsername(userId), limit, offset,
    }));
  if (!rounds.length) throw new Error('CASINO_NO_PROVIDER_ROUNDS_TO_RECONCILE');

  // Query ALL successful receipts, not just the provider rounds on the first
  // page. Extra receipts with no matching supplier round are audit failures.
  const receipts = await db.query<SignedReceipt>(`
    select round_id,game_id,action,rollback,amount_minor::text
    from nova.softaggregator_callback_receipts
    where user_id=$1 and response_error=0
  `, [userId]);
  const summary = compareCasinoHistory(rounds, receipts);
  const keys = new Set(rounds.map((round) =>
    JSON.stringify([round.round_id, round.gameid])));
  const orphanReceiptCount = receipts.filter((receipt) =>
    !keys.has(JSON.stringify([receipt.round_id, receipt.game_id]))).length;

  // The receipt must reference the exact authoritative wallet journal row.
  // A correct provider USD total alone cannot detect money credited to the
  // wrong native fiat wallet or a duplicated local debit.
  const integrity = await db.queryOne<{ mismatches: number }>(`
    select count(*)::integer as mismatches
    from nova.softaggregator_callback_receipts r
    left join nova.wallet_transactions t on t.id=r.ledger_transaction_id
    left join nova.softaggregator_round_fx fx
      on fx.user_id=r.user_id and fx.round_id=r.round_id and fx.game_id=r.game_id
    where r.user_id=$1 and r.response_error=0 and (
      t.id is null
      or t.user_id is distinct from r.user_id
      or t.currency is distinct from r.wallet_currency
      or fx.wallet_currency is distinct from r.wallet_currency
      or t.reference is distinct from ('softaggregator:' || r.call_id)
      or t.amount_minor is distinct from
        (case when r.action='debit' then -r.wallet_amount_minor else r.wallet_amount_minor end)
      or t.type::text is distinct from
        (case when r.rollback and r.action='debit' then 'reversal'
              when r.rollback and r.action='credit' then 'bet_refund'
              when r.action='debit' then 'bet_debit' else 'win_credit' end)
    )
  `, [userId]);
  if (!integrity || !Number.isSafeInteger(integrity.mismatches))
    throw new Error('CASINO_LEDGER_AUDIT_UNAVAILABLE');
  const counts = {
    matched: summary.filter((x) => x.status === 'matched').length,
    mismatch: summary.filter((x) => x.status === 'mismatch').length,
    missing: summary.filter((x) => x.status === 'missing').length,
    skipped: summary.filter((x) => x.status === 'skipped').length,
  };
  console.log(JSON.stringify({
    readOnly: true, providerRounds: summary.length, counts,
    orphanReceiptCount, mismatchedLedgerRows: integrity.mismatches,
  }));
  if (counts.mismatch || counts.missing || counts.skipped || !counts.matched ||
      orphanReceiptCount || integrity.mismatches) {
    // Do not include game URLs, user ID, vendor credentials, wallet identifiers.
    throw new Error('CASINO_RECONCILIATION_NOT_PASSED');
  }
}

run().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : 'CASINO_RECONCILIATION_ERROR');
  process.exitCode = 1;
});
