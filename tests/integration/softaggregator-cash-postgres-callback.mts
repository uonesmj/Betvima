/**
 * Synthetic full-stack HTTP / application / PostgreSQL finance test.
 * NEVER connect this test to Production. All accounts and amounts are fake.
 *
 * Independent HMAC query signing -> Next.js GET route -> authorization ->
 * actual PostgresDb transactions -> actual SQL financial audit trigger ->
 * native USD wallet ledger, idempotency and signed rollback receipt.
 */
import assert from 'node:assert/strict';
import { createHash, createHmac } from 'node:crypto';
import pg from 'pg';
const { Client } = pg;
import { GET } from '../../src/app/api/webhooks/softaggregator/route';
import { closeDb } from '../../src/server/db';
import { compareCasinoHistory, type SignedReceipt } from '../../src/server/providers/softaggregator/reconcile';

const uid = '00000000-0000-4000-8000-000000000002';
const username = 'bv_' + uid.replaceAll('-', '');
const salt = 'synthetic-hmac-SOFTAGGREGATOR-STAGING-ONLY';
const edgeSecret = 'isolated-CI-independent-edge-signature-secret-2026';
const roundId = 'isolated-round-1';
const gameId = 'synthetic-provider/game-1';

async function signed(action: 'debit' | 'credit' | 'balance',
  id: string, amount: number, rollback = false, badSignature = false,
  badEdgeSignature = false, providerRoundId = roundId) {
  const timestamp = String(Math.floor(Date.now()/1000));
  const query = new URLSearchParams({
    action, username, currency:'USD',
    timestamp, key: createHash('md5').update(timestamp+salt).digest('hex'),
    ...(action === 'balance' ? {} : {
      call_id:id,amount:String(amount),round_id:providerRoundId,game_id:gameId,rb:rollback?'1':'0',
    }),
  });
  // Supplier signs decoded query values; the independent trusted edge signs
  // percent-encoded canonical values. Both proofs are mandatory.
  const sorted = [...query.entries()].sort(([a],[b]) => a < b ? -1 : a > b ? 1 : 0);
  const canonical = sorted.map(([k,v])=>k+'='+v).join('&');
  const signature = createHmac('sha256',salt).update(canonical).digest('hex');
  const edgeSignature = createHmac('sha256',edgeSecret)
    .update(new URLSearchParams(sorted).toString()).digest('hex');
  const response = await GET(new Request(
    'https://betvima.example/api/webhooks/softaggregator?'+query.toString(),
    { headers: {
      'X-Signature':badSignature?'0'.repeat(64):signature,
      'X-BetVima-Edge-Signature':badEdgeSignature?'0'.repeat(64):edgeSignature,
    } },
  ));
  assert.equal(response.status,200);
  const body = await response.json() as {error:number;balance:number};
  assert(Number.isSafeInteger(body.balance));
  return body;
}

async function main(){
  // The ONLY valid target is GitHub Actions' ephemeral PG17 service.
  if(process.env.GITHUB_ACTIONS!=='true' ||
     process.env.PGHOST!=='127.0.0.1' || process.env.PGDATABASE!=='postgres' ||
     process.env.PGSSLMODE!=='disable' ||
     process.env.SUPABASE_DB_URL || process.env.DATABASE_URL ||
     process.env.SOFTAGGREGATOR_API_PASSWORD || process.env.SOFTAGGREGATOR_API_LOGIN)

    throw new Error('CASINO_CASH_TEST_REQUIRES_EPHEMERAL_CI_DATABASE');
  Object.assign(process.env, {
    SOFTAGGREGATOR_ENABLED:'true',
    SOFTAGGREGATOR_REAL_MONEY_ENABLED:'true',
    SOFTAGGREGATOR_FINANCIAL_SCHEMA_READY:'true',
    SOFTAGGREGATOR_TEST_USER_ID:uid,
    SOFTAGGREGATOR_SALT_KEY:salt,
    SOFTAGGREGATOR_EDGE_HMAC_SECRET:edgeSecret,
    SOFTAGGREGATOR_CALLBACK_EDGE_READY:'true',
    SOFTAGGREGATOR_ALLOWED_COUNTRIES:'TR',
    DB_DRIVER:'postgres',
  });
  const sql = new Client();
  await sql.connect();
  try {
    const count = async (filter='') => {
      const r = await sql.query(
        "select count(*)::int as n from nova.wallet_transactions where user_id=$1 "+filter,[uid]);
      return r.rows[0].n as number;
    };
    const balance = async () => {
      const r = await sql.query(
        'select balance_minor::int as n from nova.wallets where user_id=$1 and currency=$2',
        [uid,'USD']);
      return r.rows[0].n as number;
    };
    assert.deepEqual(await signed('balance','',0), {error:0,balance:1000});
    assert.deepEqual(await signed('debit','real-pg-debit-1',20,false,true),
      {error:2,balance:0},'supplier HMAC tampering must fail before DB');
    assert.deepEqual(await signed('debit','synthetic-edge-tamper',20,false,false,true),
      {error:2,balance:0},'independent edge HMAC tampering must fail before DB');
    assert.equal(await count(),1);

    assert.deepEqual(await signed('debit','real-pg-debit-1',20),
      {error:0,balance:980});
    assert.equal(await count(),2);
    assert.deepEqual(await signed('debit','real-pg-debit-1',20),
      {error:0,balance:980},'exact replay must return original balance');
    assert.equal(await count(),2);

    // Changing amount while preserving call_id but with a freshly valid HMAC
    // must NOT bypass our canonical-identity deduplication.
    assert.deepEqual(await signed('debit','real-pg-debit-1',21),
      {error:2,balance:0});
    assert.equal(await count(),2);

    assert.deepEqual(await signed('credit','real-pg-win-1',40),
      {error:0,balance:1020});
    assert.deepEqual(await signed('credit','real-pg-free-spin',7),
      {error:0,balance:1027},'free-spin credit without debit must be accepted');

    assert.deepEqual(await signed('credit','real-pg-refund-1',20,true),
      {error:0,balance:1047},'rollback returns original USD stake');
    assert.deepEqual(await signed('credit','real-pg-refund-2',20,true),
      {error:2,balance:0},'second rollback must be rejected');
    assert.deepEqual(await signed('debit','real-pg-win-reversal-1',40,true),
      {error:0,balance:1007},'rollback debits original win once');
    assert.deepEqual(await signed('debit','real-pg-win-reversal-2',40,true),
      {error:2,balance:0},'duplicate win reversal must be rejected');

    assert.deepEqual(await signed('debit','real-pg-insufficient',999999),
      {error:1,balance:1007},'oversize stake cannot overdraw');
    assert.equal(await balance(),1007);

    // Parallel signed retries for same call ID have only one ledger posting.
    const parallel = await Promise.all(
      Array.from({length:5},()=>signed('debit','real-pg-parallel',20)));
    assert(parallel.every(r=>r.error===0 && r.balance===987),
      'all concurrent exact retries must report original settled balance');
    assert.equal(await balance(),987);

    await sql.query("update nova.profiles set kyc_status='pending' where id=$1",[uid]);
    assert.deepEqual(await signed('debit','real-pg-kyc-denied',20),
      {error:1,balance:987},'new betting must block unverified KYC');
    assert.deepEqual(await signed('credit','real-pg-owed-credit',30),
      {error:0,balance:1017},'legitimate existing winnings must still settle');

    const duplicateCount = await sql.query(
      "select count(*)::int as n from nova.softaggregator_callback_receipts "+
      "where user_id=$1 and call_id='real-pg-parallel'",[uid]);
    assert.equal(duplicateCount.rows[0].n,1);

    const audit = await sql.query(
      'select count(*)::int as n from nova.softaggregator_callback_receipts r '+
      'join nova.wallet_transactions t on r.ledger_transaction_id=t.id '+
      'where r.user_id=$1 and r.response_error=0 and '+
      '(t.user_id<>r.user_id or t.currency<>r.wallet_currency or '+
      't.amount_minor<>case when r.action=\'debit\' then -r.wallet_amount_minor '+
      'else r.wallet_amount_minor end)',[uid]);
    assert.equal(audit.rows[0].n,0);
    const ledgerTotal = await sql.query(
      "select sum(amount_minor)::bigint as total from nova.wallet_transactions "+
      "where user_id=$1 and status='posted'",[uid]);
    assert.equal(Number(ledgerTotal.rows[0].total),await balance(),
      'available wallet matches append-only ledger total');
    // Distinct signed call IDs against the SAME native wallet must also
    // serialize: four overlapping stakes cannot each spend the same funds.
    // Re-enable only the ephemeral synthetic account for this test; the
    // protected Production environment remains outside this test runner.
    await sql.query("update nova.profiles set kyc_status='verified' where id=$1", [uid]);
    // Prepare a low synthetic wallet balance with a legitimate non-casino
    // fixture ledger entry. No live funds or external accounts are touched.
    const balanceBeforeFixtureSpend = await balance();
    assert(balanceBeforeFixtureSpend > 70);
    await sql.query(
      "select nova.post_wallet_entry(p_user_id=>$1::uuid,p_type=>'withdrawal'," +
      "p_amount_minor=>$2::bigint,p_currency=>'USD'," +
      "p_idempotency_key=>'synthetic-wallet-reduction'," +
      "p_reference=>'isolated-fixture-only')",
      [uid, String(70 - balanceBeforeFixtureSpend)],
    );
    const beforeOverdraft = await balance();
    assert.equal(beforeOverdraft, 70);
    const stake = 42;
    assert(stake >= 20 && stake <= 100 && stake < beforeOverdraft);
    const competing = await Promise.all(Array.from({length:4}, (_, index) =>
      signed('debit', 'isolated-competing-stake-' + index, stake)));
    const approved = competing.filter((x) => x.error === 0);
    const denied = competing.filter((x) => x.error === 1);
    assert.equal(approved.length, 1, 'at most one of four competing wagers can spend the funds');
    assert.equal(denied.length, 3, 'other competing wagers must fail insufficient-funds');
    assert.equal(await balance(), beforeOverdraft - stake,
      'wallet must never overdraw when distinct signed wagers race');
    const duplicate = await signed('debit', 'isolated-competing-stake-0', stake);
    assert.deepEqual(duplicate, competing[0], 'replayed result must stay identical after concurrency');
    const afterOverdraft = await sql.query(
      "select coalesce(sum(amount_minor),0)::bigint as total from nova.wallet_transactions " +
      "where user_id=$1 and status='posted'", [uid]);
    assert.equal(Number(afterOverdraft.rows[0].total), await balance(),
      'all concurrent outcomes must reconcile with the append-only ledger');

    // A provider reversal of a previously paid win is a real debit. It must
    // undo the earlier win's contribution to daily net-loss calculations.
    // Otherwise a player can exceed an approved loss limit after a reversed win.
    const lossBefore = await sql.query(
      "select coalesce(sum(case when type in " +
      "('bet_debit','win_credit','bet_refund','void_refund') " +
      "or (type='reversal' and reference like 'softaggregator:%') " +
      "then -amount_minor else 0 end),0)::bigint as used " +
      "from nova.wallet_transactions where user_id=$1 and currency='USD' " +
      "and created_at >= date_trunc('day',now() at time zone 'UTC') at time zone 'UTC'",
      [uid]);
    const netLoss = BigInt(lossBefore.rows[0].used);
    assert(netLoss > 0n, 'test requires a positive net loss after reversed winning');
    const currentBalance = await balance();
    assert(currentBalance >= 20, 'test player must have enough cash to expose bypass');
    await sql.query(
      'insert into nova.user_limits(user_id,currency,loss_limit_daily_minor) ' +
      "values($1,'USD',$2)",
      [uid,(netLoss + 19n).toString()]);
    assert.deepEqual(await signed('debit','isolated-reversed-win-loss-limit',20),
      {error:1,balance:currentBalance},
      'a reversed supplier win must count toward daily net-loss before authorizing a bet');
    assert.equal(await balance(),currentBalance,'denied stake must not mutate available cash');

    // Demonstrate read-only history matching against SUCCESSFUL, COMMITTED
    // signed receipts in PostgreSQL. The supplier-like round is synthetic:
    // actual SoftAggregator history can only be verified in a separate pilot.
    await sql.query('delete from nova.user_limits where user_id=$1', [uid]);
    const beforeCleanRound = await balance();
    assert.deepEqual(await signed('debit','synthetic-reconcile-debit',20,
      false,false,false,'isolated-clean-reconcile'),
      {error:0,balance:beforeCleanRound-20});
    assert.deepEqual(await signed('credit','synthetic-reconcile-credit',25,
      false,false,false,'isolated-clean-reconcile'),
      {error:0,balance:beforeCleanRound+5});
    const syntheticRows = await sql.query<SignedReceipt>(
      'select round_id,game_id,action,rollback,amount_minor::text ' +
      'from nova.softaggregator_callback_receipts where user_id=$1 ' +
      'and round_id=$2 and response_error=0',
      [uid,'isolated-clean-reconcile']);
    assert.equal(syntheticRows.rows.length,2);
    const cleanHistory = {
      round_id:'isolated-clean-reconcile',gameid:gameId,
      bet:20,win:25,ended_at:'synthetic-complete',rolled_back:false,
    };
    assert.equal(compareCasinoHistory([cleanHistory],syntheticRows.rows)[0]?.status,'matched');
    assert.equal(compareCasinoHistory([{...cleanHistory,win:26}],syntheticRows.rows)[0]?.status,'mismatch');
    const finalLedger = await sql.query(
      "select coalesce(sum(amount_minor),0)::bigint as total from nova.wallet_transactions " +
      "where user_id=$1 and status='posted'", [uid]);
    assert.equal(Number(finalLedger.rows[0].total),await balance());

    process.stdout.write('CASINO_INTEGRATED_SIGNED_CALLBACK_POSTGRES_PASS; synthetic USD, no production funds\n');
  } finally {
    await sql.end();
    await closeDb();
  }
}

main().catch((e:unknown)=>{
  process.stderr.write('CASINO_INTEGRATED_TEST_FAILURE: '+
    (e instanceof Error? e.message:'unknown')+'\n');
  process.exitCode=1;
});
