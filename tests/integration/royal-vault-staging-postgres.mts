/**
 * REAL PostgreSQL transactions against FAKE balances in a disposable CI
 * database. This test must never connect to a user's Supabase project.
 */
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {PostgresDb} from '../../src/server/db/postgres';
import {
  originalsStagingDatabaseReady,
  settleRoyalVaultStagingRound,
} from '../../src/server/originals/royal-vault-cash-staging';

const {Client} = pg;
const uid='00000000-0000-4000-8000-000000000002';
const competitor='00000000-0000-4000-8000-000000000003';

async function main() {
  // An explicit throw is mandatory if any production secret/hostname exists.
  if (process.env.GITHUB_ACTIONS!=='true' ||
      process.env.PGHOST!=='127.0.0.1' ||
      process.env.PGDATABASE!=='betvima_originals_staging_qa' ||
      process.env.PGSSLMODE!=='disable' ||
      process.env.SUPABASE_DB_URL || process.env.DATABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('ORIGINALS_FINANCIAL_TEST_REQUIRES_DISPOSABLE_POSTGRES_CI');
  }

  Object.assign(process.env,{
    BETVIMA_ORIGINALS_FINANCIAL_STAGE:'isolated-staging-only',
    BETVIMA_ORIGINALS_LICENSE_REVIEW_COMPLETE:'true', // Synthetic CI marker; NOT licence evidence.
    BETVIMA_ORIGINALS_STAGING_DB_NAME:'betvima_originals_staging_qa',
    BETVIMA_ORIGINALS_ALLOWED_COUNTRIES:'DE',
    BETVIMA_ORIGINALS_PILOT_USER_ID:uid,
  });

  const db = new PostgresDb();
  const sql = new Client();
  await sql.connect();
  try {
    assert.equal(await originalsStagingDatabaseReady(db),true);

    const balance = async (userId=uid) => {
      const query=await sql.query<{balance_minor:string}>(
        "select balance_minor::text from nova.wallets where user_id=$1 and currency='USD'",
        [userId]);
      return BigInt(query.rows[0]!.balance_minor);
    };
    const count = async (userId=uid) => {
      const q=await sql.query<{n:number}>(
        'select count(*)::int as n from nova.wallet_transactions where user_id=$1',[userId]);
      return q.rows[0]!.n;
    };

    const firstRequest=randomUUID();
    const before=await balance();
    const first=await settleRoyalVaultStagingRound(db,{
      userId:uid,clientRequestId:firstRequest,stakeMinor:10n,verifiedGeoCountry:'DE',
    });
    assert.equal(first.replay,false);
    assert.equal(first.stakeMinor,'10');
    assert.equal(first.currency,'USD');
    assert.equal(first.mathVersion,'rv-demo-1');
    assert.equal(await balance(),before-10n+BigInt(first.payoutMinor));
    const afterPosts=await count();

    const retry=await settleRoyalVaultStagingRound(db,{
      userId:uid,clientRequestId:firstRequest,stakeMinor:10n,verifiedGeoCountry:'DE',
    });
    assert.equal(retry.replay,true);
    assert.equal(retry.roundId,first.roundId);
    assert.equal(retry.payoutMinor,first.payoutMinor);
    assert.equal(await count(),afterPosts);
    assert.equal(await balance(),before-10n+BigInt(first.payoutMinor));

    await assert.rejects(
      settleRoyalVaultStagingRound(db,{
        userId:uid,clientRequestId:firstRequest,stakeMinor:15n,verifiedGeoCountry:'DE',
      }),
      /ORIGINALS_STAGE_REPLAY_CONFLICT/,
    );
    assert.equal(await count(),afterPosts);

    const round=await sql.query<{n:number}>(
      'select count(*)::int as n from nova.originals_rounds where user_id=$1 and client_request_id=$2',
      [uid,firstRequest]);
    assert.equal(round.rows[0]?.n,1);

    // A stored receipt cannot be rewritten, even by a privileged DB role.
    await assert.rejects(
      sql.query('update nova.originals_rounds set payout_minor=0 where round_id=$1',
        [first.roundId]),/ORIGINALS_ROUND_IMMUTABLE/,
    );

    const ledgerAudit=await sql.query<{bad:number}>(
      `select count(*)::int as bad from nova.originals_rounds r
       join nova.wallet_transactions d on d.id=r.debit_transaction_id
       left join nova.wallet_transactions c on c.id=r.credit_transaction_id
       where d.user_id<>r.user_id or d.currency<>r.wallet_currency
         or d.amount_minor<>-r.stake_minor
         or (r.payout_minor>0 and (c.id is null or c.amount_minor<>r.payout_minor))
         or (r.payout_minor=0 and c.id is not null)`,
    );
    assert.equal(ledgerAudit.rows[0]?.bad,0);

    // Failed eligibility may never change the ledger.
    await sql.query("update nova.profiles set kyc_status='pending' where id=$1",[uid]);
    const beforeDenied=await balance();
    const postsBeforeDenied=await count();
    await assert.rejects(
      settleRoyalVaultStagingRound(db,{
        userId:uid,clientRequestId:randomUUID(),stakeMinor:10n,verifiedGeoCountry:'DE',
      }),
      /ORIGINALS_STAGE_PLAYER_INELIGIBLE/,
    );
    assert.equal(await balance(),beforeDenied);
    assert.equal(await count(),postsBeforeDenied);
    await sql.query("update nova.profiles set kyc_status='verified' where id=$1",[uid]);

    // Four DIFFERENT request IDs against one 10-cent synthetic wallet.
    // Daily stake limit is 10 cents so only one can pass, regardless of winnings.
    process.env.BETVIMA_ORIGINALS_PILOT_USER_ID=competitor;
    const attempts=await Promise.allSettled(Array.from({length:4},() =>
      settleRoyalVaultStagingRound(db,{
        userId:competitor,clientRequestId:randomUUID(),
        stakeMinor:10n,verifiedGeoCountry:'DE',
      })));
    const fulfilled=attempts.filter(x=>x.status==='fulfilled');
    const rejected=attempts.filter(x=>x.status==='rejected');
    assert.equal(fulfilled.length,1,'only one of four parallel spenders must settle');
    assert.equal(rejected.length,3,'limit guard must reject three competitors');
    const competitorRound=await sql.query<{n:number}>(
      'select count(*)::int as n from nova.originals_rounds where user_id=$1',[competitor]);
    assert.equal(competitorRound.rows[0]?.n,1);

    // Reconciled immutable ledger balances, both synthetic wallets.
    for (const player of [uid,competitor]) {
      const q=await sql.query<{total:string}>(
        "select coalesce(sum(amount_minor),0)::text as total from nova.wallet_transactions "+
        "where user_id=$1 and status='posted'",[player]);
      assert.equal(BigInt(q.rows[0]!.total),await balance(player));
    }

    process.stdout.write('ROYAL_VAULT_DISPOSABLE_POSTGRES_ATOMIC_LEDGER_PASS; no production money or users\n');
  } finally {
    await sql.end();
    await db.close();
  }
}

main().catch((error:unknown)=>{
  process.stderr.write('ROYAL_VAULT_STAGING_FINANCIAL_FAIL '+
    (error instanceof Error?error.message:'unknown')+'\n');
  process.exitCode=1;
});
