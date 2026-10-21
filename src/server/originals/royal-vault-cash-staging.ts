import { randomUUID } from 'node:crypto';
import type { Db } from '@/lib/ports/db';
import { ROYAL_VAULT_MATH_VERSION } from '@/lib/originals/royal-vault';
import { secureRoyalDemoSpin } from './royal-vault-demo';
import { quoteRoyalSettlement } from './royal-vault-accounting';

/**
 * ISOLATED POSTGRES STAGING ONLY. No HTTP route imports this module.
 *
 * This is a draft USD atomic round contract, NOT certified for real money,
 * NOT enabled for BetVima production, and NOT a regulatory authorization.
 * Operator approval, independently tested RNG, ledger and game certification,
 * jurisdiction checks, backup restoration and signed releases are still gates.
 *
 * The staging database must have the pending 0219 proposal installed by an
 * independent reviewer. No migration is applied automatically.
 */
export type StagingRoyalInput = Readonly<{
  userId: string;             // Must originate from authenticated session.
  clientRequestId: string;    // Idempotency key per spin.
  stakeMinor: bigint;         // USD cents; client payouts are not accepted.
  verifiedGeoCountry: string; // Must originate from signed edge verification.
}>;

export type StagingRoyalReceipt = Readonly<{
  roundId: string;
  clientRequestId: string;
  currency: 'USD';
  stakeMinor: string;
  payoutMinor: string;
  balanceAfterMinor: string;
  mathVersion: typeof ROYAL_VAULT_MATH_VERSION;
  grid: unknown;
  wins: unknown;
  replay: boolean;
}>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Wallet = { balance_minor: string; locked_minor: string; is_frozen: boolean };
type Profile = {
  status: string; age_verified: boolean; kyc_status: string; kyc_document_approved: boolean;
  currency: string; country: string | null; self_excluded: boolean; restricted: boolean;
  max_stake_per_bet_minor: string | null; max_stake_per_day_minor: string | null;
  loss_limit_daily_minor: string | null; loss_limit_weekly_minor: string | null;
  max_payout_per_bet_minor: string | null;
};
/** PostgreSQL jsonb_build_object(bigint) may decode to a JS number. */
function safePostedMinor(value: unknown): string {
  if (typeof value === 'string' && /^(0|[1-9][0-9]*)$/.test(value)) {
    return value;
  }
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) {
    return String(value);
  }
  throw new Error('ORIGINALS_STAGE_POSTED_BALANCE_UNSAFE');
}

type Existing = {
  round_id: string; client_request_id: string; wallet_currency: string;
  stake_minor: string; payout_minor: string; balance_after_minor: string;
  math_version: string; result_grid: unknown; result_line_wins: unknown;
};

export function validateStagingRoyalInput(input: StagingRoyalInput): void {
  if (!UUID.test(input.userId) || !UUID.test(input.clientRequestId))
    throw new Error('ORIGINALS_STAGE_ID_INVALID');
  if (typeof input.stakeMinor !== 'bigint' || input.stakeMinor < 10n ||
      input.stakeMinor > 2_000n || input.stakeMinor % 5n !== 0n)
    throw new Error('ORIGINALS_STAGE_STAKE_INVALID');
  if (typeof input.verifiedGeoCountry !== 'string' || !/^[A-Z]{2}$/.test(input.verifiedGeoCountry))
    throw new Error('ORIGINALS_STAGE_GEO_INVALID');
}

function eligible(profile: Profile | null, country: string): boolean {
  return !!profile && profile.status === 'active' &&
    profile.age_verified === true && profile.kyc_status === 'verified' &&
    profile.kyc_document_approved === true && profile.currency === 'USD' &&
    profile.country === country && !profile.self_excluded && !profile.restricted;
}

/** Fail closed even if someone accidentally imports this into a live route. */
export async function originalsStagingDatabaseReady(db: Pick<Db, 'kind' | 'queryOne'>): Promise<boolean> {
  if (db.kind !== 'postgres' ||
      process.env.BETVIMA_ORIGINALS_FINANCIAL_STAGE !== 'isolated-staging-only' ||
      process.env.BETVIMA_ORIGINALS_LICENSE_REVIEW_COMPLETE !== 'true' ||
      !process.env.BETVIMA_ORIGINALS_STAGING_DB_NAME?.startsWith('betvima_originals_staging_')) {
    return false;
  }
  try {
    const info = await db.queryOne<{
      db_name: string; ready: boolean;
    }>(`select current_database()::text as db_name, (
        to_regclass('nova.originals_rounds') is not null
        and exists (
          select 1 from pg_class
          where oid=to_regclass('nova.originals_rounds')
            and relrowsecurity and relforcerowsecurity
        )
        and exists (
          select 1 from pg_trigger
          where tgrelid=to_regclass('nova.originals_rounds')
            and tgname='originals_rounds_immutable' and tgenabled <> 'D'
        )
        and exists (
          select 1 from pg_trigger
          where tgrelid=to_regclass('nova.originals_rounds')
            and tgname='originals_pair_integrity' and tgenabled <> 'D'
        )
        and not exists (
          select 1 from (values ('anon'),('authenticated')) p(role_name)
          where has_table_privilege(p.role_name,to_regclass('nova.originals_rounds'),'INSERT,UPDATE,DELETE')
        )
      ) as ready`);
    return !!info?.ready && info.db_name === process.env.BETVIMA_ORIGINALS_STAGING_DB_NAME;
  } catch {
    return false;
  }
}

function replayReceipt(input: StagingRoyalInput, existing: Existing): StagingRoyalReceipt {
  if (existing.client_request_id !== input.clientRequestId ||
      existing.wallet_currency !== 'USD' ||
      existing.math_version !== ROYAL_VAULT_MATH_VERSION ||
      BigInt(existing.stake_minor) !== input.stakeMinor) {
    throw new Error('ORIGINALS_STAGE_REPLAY_CONFLICT');
  }
  return {
    roundId: existing.round_id, clientRequestId: existing.client_request_id,
    currency: 'USD', stakeMinor: existing.stake_minor,
    payoutMinor: existing.payout_minor, balanceAfterMinor: existing.balance_after_minor,
    mathVersion: ROYAL_VAULT_MATH_VERSION,
    grid: existing.result_grid, wins: existing.result_line_wins,
    replay: true,
  };
}

/**
 * This stages ONE atomic ledger+round transaction in a dedicated DB.
 * Never run against production or with a real customer's funds.
 * No client may set result_grid, payoutMinor, player ID or country.
 */
export async function settleRoyalVaultStagingRound(
  db: Db, input: StagingRoyalInput,
): Promise<StagingRoyalReceipt> {
  validateStagingRoyalInput(input);
  if (process.env.BETVIMA_ORIGINALS_PILOT_USER_ID !== input.userId)
    throw new Error('ORIGINALS_STAGE_PLAYER_NOT_ALLOWED');
  const countries = (process.env.BETVIMA_ORIGINALS_ALLOWED_COUNTRIES ?? '')
    .split(',').map((v) => v.trim()).filter(Boolean);
  if (!countries.length || countries.length > 15 ||
      countries.some((v) => !/^[A-Z]{2}$/.test(v)) ||
      !countries.includes(input.verifiedGeoCountry)) {
    throw new Error('ORIGINALS_STAGE_COUNTRY_NOT_ALLOWED');
  }
  if (!await originalsStagingDatabaseReady(db))
    throw new Error('ORIGINALS_STAGE_DATABASE_NOT_READY');

  return db.transaction(async (tx) => {
    // Transaction-level request lock serializes retries across all workers.
    await tx.query('select pg_advisory_xact_lock(hashtext($1), hashtext($2))',
      ['originals-request:' + input.userId, input.clientRequestId]);

    const previous = await tx.queryOne<Existing>(
      'select round_id::text,client_request_id::text,wallet_currency,stake_minor::text,' +
      'payout_minor::text,balance_after_minor::text,math_version,result_grid,result_line_wins ' +
      'from nova.originals_rounds where user_id=$1 and client_request_id=$2',
      [input.userId, input.clientRequestId],
    );
    if (previous) return replayReceipt(input, previous);

    // Follow the exact lock order in nova.post_wallet_entry; serialize bets,
    // admin adjustments and game callbacks against this wallet as well.
    await tx.query('select pg_advisory_xact_lock(hashtext($1))',
      ['wallet:' + input.userId + ':USD']);

    const profile = await tx.queryOne<Profile>([
      'select p.status::text as status,p.age_verified,p.kyc_status::text as kyc_status,',
      'exists(select 1 from nova.kyc_submissions k where k.user_id=p.id',
      "and k.status='verified' and k.legal_age_confirmed and k.reviewed_by is not null) as kyc_document_approved,",
      'p.preferred_currency as currency,p.jurisdiction as country,',
      'coalesce(l.self_excluded_until > now(),false) as self_excluded,',
      'exists(select 1 from nova.user_restrictions r where r.user_id=p.id',
      "and r.is_active and r.kind in ('self_exclusion','cooling_off','account_restriction')",
      'and r.effective_from<=now() and (r.effective_to is null or r.effective_to>now())) as restricted,',
      'l.max_stake_per_bet_minor::text,l.max_stake_per_day_minor::text,',
      'l.loss_limit_daily_minor::text,l.loss_limit_weekly_minor::text,',
      'l.max_payout_per_bet_minor::text',
      "from nova.profiles p left join nova.user_limits l on l.user_id=p.id and l.currency='USD'",
      'where p.id=$1',
    ].join(' '), [input.userId]);
    if (!eligible(profile, input.verifiedGeoCountry))
      throw new Error('ORIGINALS_STAGE_PLAYER_INELIGIBLE');

    const account = await tx.queryOne<Wallet>(
      'select balance_minor::text,locked_minor::text,is_frozen from nova.wallets ' +
      "where user_id=$1 and currency='USD' for update",
      [input.userId],
    );
    if (!account || account.is_frozen ||
        BigInt(account.balance_minor)-BigInt(account.locked_minor) < input.stakeMinor)
      throw new Error('ORIGINALS_STAGE_INSUFFICIENT_AVAILABLE_BALANCE');

    // Daily stake and losses cannot be bypassed by duplicate/concurrent spins.
    // Other bet kinds share the same immutable source ledger.
    const usage = await tx.queryOne<{day_stake:string;day_loss:string;week_loss:string}>([
      'select',
      "coalesce(sum(case when type='bet_debit' and created_at >= date_trunc('day',now() at time zone 'UTC') at time zone 'UTC'",
      'then -amount_minor else 0 end),0)::text as day_stake,',
      "coalesce(sum(case when created_at >= date_trunc('day',now() at time zone 'UTC') at time zone 'UTC'",
      "and type in ('bet_debit','win_credit','bet_refund','void_refund','reversal') then -amount_minor else 0 end),0)::text as day_loss,",
      "coalesce(sum(case when created_at >= date_trunc('week',now() at time zone 'UTC') at time zone 'UTC'",
      "and type in ('bet_debit','win_credit','bet_refund','void_refund','reversal') then -amount_minor else 0 end),0)::text as week_loss",
      "from nova.wallet_transactions where user_id=$1 and currency='USD' and status='posted'",
    ].join(' '), [input.userId]);
    if (!usage) throw new Error('ORIGINALS_STAGE_LIMITS_UNAVAILABLE');
    if ((profile!.max_stake_per_bet_minor !== null &&
         input.stakeMinor > BigInt(profile!.max_stake_per_bet_minor)) ||
        (profile!.max_stake_per_day_minor !== null &&
         BigInt(usage.day_stake) + input.stakeMinor > BigInt(profile!.max_stake_per_day_minor)) ||
        (profile!.loss_limit_daily_minor !== null &&
         BigInt(usage.day_loss) + input.stakeMinor > BigInt(profile!.loss_limit_daily_minor)) ||
        (profile!.loss_limit_weekly_minor !== null &&
         BigInt(usage.week_loss) + input.stakeMinor > BigInt(profile!.loss_limit_weekly_minor)))
      throw new Error('ORIGINALS_STAGE_LIMIT_EXCEEDED');

    // Server controls the RNG. This result is NOT independently RNG-certified.
    const result = secureRoyalDemoSpin(20);
    const settlement = quoteRoyalSettlement(result,input.stakeMinor);
    if ((profile!.max_payout_per_bet_minor !== null &&
        settlement.payoutMinor > BigInt(profile!.max_payout_per_bet_minor)) ||
        settlement.payoutMinor > 50_000n) {
      // Entire SQL transaction aborts; do not change odds/result after drawing.
      throw new Error('ORIGINALS_STAGE_MAX_PAYOUT_UNSUPPORTED');
    }

    const roundId = randomUUID();
    const reference = 'originals:' + roundId;
    const debit = await tx.rpc<{transaction_id:string;balance_after_minor:string}>(
      'post_wallet_entry', {
        p_user_id: input.userId, p_type: 'bet_debit',
        p_amount_minor: (-input.stakeMinor).toString(), p_currency: 'USD',
        p_idempotency_key: 'originals:debit:' + roundId,
        p_reference: reference,
        p_metadata: {source:'originals',game:'royal-vault',math_version:ROYAL_VAULT_MATH_VERSION},
        p_balance_floor: account.locked_minor,
      },
    );
    if (!debit?.transaction_id || typeof debit.transaction_id !== 'string')
      throw new Error('ORIGINALS_STAGE_DEBIT_UNVERIFIED');

    let creditId: string | null = null;
    let balanceAfter = safePostedMinor(debit.balance_after_minor);
    if (settlement.payoutMinor > 0n) {
      const credit = await tx.rpc<{transaction_id:string;balance_after_minor:string}>(
        'post_wallet_entry', {
          p_user_id: input.userId, p_type: 'win_credit',
          p_amount_minor: settlement.payoutMinor.toString(), p_currency: 'USD',
          p_idempotency_key: 'originals:credit:' + roundId,
          p_reference: reference,
          p_metadata: {source:'originals',game:'royal-vault',math_version:ROYAL_VAULT_MATH_VERSION},
        },
      );
      if (!credit?.transaction_id || typeof credit.transaction_id !== 'string')
        throw new Error('ORIGINALS_STAGE_CREDIT_UNVERIFIED');
      creditId = credit.transaction_id;
      balanceAfter = safePostedMinor(credit.balance_after_minor);
    }
    await tx.query(
      'insert into nova.originals_rounds ' +
      '(round_id,user_id,client_request_id,game_id,math_version,wallet_currency,' +
      'stake_minor,payout_minor,balance_after_minor,result_grid,result_line_wins,' +
      'debit_transaction_id,credit_transaction_id) ' +
      "values($1,$2,$3,'royal-vault',$4,'USD',$5,$6,$7,$8::jsonb,$9::jsonb,$10,$11)",
      [roundId,input.userId,input.clientRequestId,ROYAL_VAULT_MATH_VERSION,
        input.stakeMinor.toString(),settlement.payoutMinor.toString(),balanceAfter,
        JSON.stringify(result.grid),JSON.stringify(result.wins),debit.transaction_id,creditId],
    );
    return {
      roundId, clientRequestId:input.clientRequestId, currency:'USD' as const,
      stakeMinor:input.stakeMinor.toString(),
      payoutMinor:settlement.payoutMinor.toString(),
      balanceAfterMinor:balanceAfter,
      mathVersion:ROYAL_VAULT_MATH_VERSION, grid:result.grid,wins:result.wins,
      replay:false,
    };
  });
}
