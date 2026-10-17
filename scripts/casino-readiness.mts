/**
 * Read-only casino cash readiness inventory. No API/player/game launch.
 *
 * Run ONLY from the trusted backend host with its existing DB environment:
 *   npm run casino:readiness
 *
 * Exit 2: manual/external gates remain unverified.
 * Exit 1: schema, accounting or runtime prerequisite fails.
 * Exit 0 is intentionally not issued: an automated probe cannot license
 * a gambling operator or certify a genuine vendor-origin money round.
 *
 * No credentials, customer identifiers or callback URLs are logged.
 */
import { getDb, closeDb } from '../src/server/db/index';
import { casinoFinancialSchemaReady } from '../src/server/providers/softaggregator/financial-readiness';
import {
  assessCasinoReadiness, explicitCasinoCountryList, singlePilotIdConfigured,
} from '../src/server/providers/softaggregator/release-audit';

const EXPECTED: Readonly<Record<string, string>> = {
  '0208_softaggregator_callback_receipts.sql':
    '4439297ff2dd63d34585bc0d5bf71fdd68528627e4e36f77e220c71c0236f073',
  '0209_softaggregator_fx_rounds.sql':
    '86382f5fb33b04184fed47611a80d82ca7d7cb8d2d215c660dc79e26bfd81b45',
  '0210_softaggregator_reverse_win_receipts.sql':
    'ad5fe3ba3506438060185a90e08e3eca4548e3eed00112c7f172c7c3ba8be6b5',
  '0211_softaggregator_player_wallet_binding.sql':
    '7935ceaa0ff82d0b5fd28980bfd9b59a5c50c755c28acaf718b99bfe8197ee83',
  '0212_softaggregator_receipt_ledger_integrity.sql':
    '5dd4f66a4c963be49b3a71307497e0ad11a6029e162abcfce7c5acf54ab4db55',
};

type Migration = {
  filename: string;
  checksum: string;
  baseline: boolean;
};

type Row = {
  wallet_count: number;
  journal_count: number;
  wallet_discrepancies: number;
  receipt_count: number;
  round_count: number;
  player_binding_count: number;
  receipt_ledger_discrepancies: number;
  verified_identity_count: number;
};

async function run() {
  const db = getDb();
  try {
    // Read-only catalog checks, independent from boolean environment flags.
    const schemaReady = await casinoFinancialSchemaReady(db);
    if (!schemaReady) throw Error('CASINO_FINANCIAL_SCHEMA_NOT_READY');
    const migrations = await db.query<Migration>(
      'select filename,checksum,baseline from nova.migrations where filename like $1',
      ['02%_softaggregator_%'],
    );
    const exactMigrations = migrations.filter(m => Object.hasOwn(EXPECTED, m.filename));
    const migrationsValid = exactMigrations.length === Object.keys(EXPECTED).length &&
      exactMigrations.every(m => m.baseline === false &&
        m.checksum === EXPECTED[m.filename]);

    // Aggregate counts only: never expose users, exact wallet amounts or receipts.
    const row = await db.queryOne<Row>(`
      select
        (select count(*)::int from nova.wallets) as wallet_count,
        (select count(*)::int from nova.wallet_transactions) as journal_count,
        (select count(*)::int from nova.wallets w where w.balance_minor <>
          coalesce((select sum(t.amount_minor) from nova.wallet_transactions t
             where t.wallet_id=w.id and t.status='posted'),0)) as wallet_discrepancies,
        (select count(*)::int from nova.softaggregator_callback_receipts) as receipt_count,
        (select count(*)::int from nova.softaggregator_round_fx) as round_count,
        (select count(*)::int from nova.softaggregator_player_wallet_bindings) as player_binding_count,
        (select count(*)::int from nova.profiles p where
          p.status::text='active' and p.age_verified is true
          and p.kyc_status::text='verified') as verified_identity_count,
        (select count(*)::int from nova.softaggregator_callback_receipts r
          left join nova.wallet_transactions t on t.id=r.ledger_transaction_id
          left join nova.softaggregator_round_fx fx
            on fx.user_id=r.user_id and fx.round_id=r.round_id and fx.game_id=r.game_id
          where r.response_error=0 and (
            t.id is null or t.user_id is distinct from r.user_id
            or t.currency is distinct from r.wallet_currency
            or fx.wallet_currency is distinct from r.wallet_currency
            or t.reference is distinct from ('softaggregator:' || r.call_id)
            or t.amount_minor is distinct from
              (case when r.action='debit' then -r.wallet_amount_minor
                    else r.wallet_amount_minor end)
            or t.type::text is distinct from (
              case when r.rollback and r.action='debit' then 'reversal'
                   when r.rollback and r.action='credit' then 'bet_refund'
                   when r.action='debit' then 'bet_debit'
                   else 'win_credit' end)
          )) as receipt_ledger_discrepancies
    `);
    if (!row) throw Error('CASINO_FINANCIAL_COUNTS_UNAVAILABLE');

    // No identification details are printed. A configured pilot UUID is NOT
    // evidence of completed verification of age and identity.
    const pilotId = (process.env.SOFTAGGREGATOR_TEST_USER_ID ?? '').trim();
    const validPilotId = singlePilotIdConfigured(pilotId);
    const pilot = validPilotId
      ? await db.queryOne<{ verified: boolean }>(
        "select exists(select 1 from nova.profiles p where p.id=$1::uuid " +
        "and p.status::text='active' and p.age_verified is true " +
        "and p.kyc_status::text='verified') as verified",
        [pilotId],
      )
      : null;

    const snapshot = {
      schemaReady,
      migrationsValid,
      walletCount: row.wallet_count,
      journalCount: row.journal_count,
      walletDiscrepancies: row.wallet_discrepancies,
      callbackReceipts: row.receipt_count,
      supplierRounds: row.round_count,
      playerBindings: row.player_binding_count,
      receiptLedgerDiscrepancies: row.receipt_ledger_discrepancies,
      verifiedIdentityCount: row.verified_identity_count,
      pilotIdentityVerified: pilot?.verified === true,
      providerApiConfigured: Boolean(
        process.env.SOFTAGGREGATOR_API_LOGIN && process.env.SOFTAGGREGATOR_API_PASSWORD,
      ),
      callbackHmacConfigured: (process.env.SOFTAGGREGATOR_SALT_KEY ?? '').length >= 12 &&
        Buffer.byteLength(process.env.SOFTAGGREGATOR_EDGE_HMAC_SECRET ?? '', 'utf8') >= 32 &&
        process.env.SOFTAGGREGATOR_CALLBACK_EDGE_READY === 'true',
      geoHmacConfigured: Buffer.byteLength(process.env.CASINO_GEO_HMAC_SECRET ?? '') >= 32,
      explicitCountryList: explicitCasinoCountryList(
        process.env.SOFTAGGREGATOR_ALLOWED_COUNTRIES,
      ),
      singlePlayerPilotConfigured: validPilotId,
      realMoneyFlagEnabled: process.env.SOFTAGGREGATOR_REAL_MONEY_ENABLED === 'true',
    };
    const report = assessCasinoReadiness(snapshot);
    process.stdout.write(JSON.stringify(report) + '\n');
    process.exitCode = report.status === 'blocked_technical' ? 1 : 2;
  } finally {
    await closeDb();
  }
}

run().catch(() => {
  // Never include process.env, DB credentials, callback parameters or user IDs.
  console.error(JSON.stringify({
    readOnly: true, publicMoneyApproved: false,
    status: 'blocked_technical', error: 'CASINO_AUDIT_UNAVAILABLE',
  }));
  process.exitCode = 1;
});
