import { createHash } from 'node:crypto';
import type { Db } from '@/lib/ports/db';
import { getUsdIrtRate } from '@/server/providers/arzhaam/client';
import { SOFTAGGREGATOR_MIN_BET_MINOR, type SignedCallback } from './contract';
import {
  casinoLocalMinorToUsd, casinoUsdToLocalMinor, exactCasinoRefund,
  validateCasinoFxSnapshot, type CasinoCurrency, type CasinoFxSnapshot,
} from './fx';
import { casinoCountryPermitted } from './jurisdiction';
import { CASINO_SUPPORT_APPROVAL_SQL, casinoManualReviewRequired } from '@/server/kyc/casino-support';
import { pilotCasinoDebitPermitted } from './pilot-limits';

type FiatCurrency = Extract<CasinoCurrency, 'IRR' | 'IRT'>;
type BalanceResult = { error: 0 | 1 | 2; balance: number };
type Wallet = { balance_minor: string; locked_minor: string; is_frozen: boolean };
type Profile = {
  status: string; age_verified: boolean; support_approved: boolean; currency: string;
  country: string | null;
  self_excluded: boolean; restricted: boolean;
  max_stake_per_bet_minor: string | null; max_stake_per_day_minor: string | null;
  loss_limit_daily_minor: string | null; loss_limit_weekly_minor: string | null;
};
type Round = { wallet_currency: string; rate_irt_per_usd: string; rate_observed_at: string };
type Receipt = { identity_hash: string; response_error: 0 | 1 | 2; response_balance_minor: string };
type OriginalDebit = { call_id: string; wallet_amount_minor: string };

const fail: BalanceResult = { error: 2, balance: 0 };
const validCurrency = (value: string): value is FiatCurrency =>
  value === 'IRT' || value === 'IRR';

function respond(error: 0 | 1 | 2, usdCents: bigint): BalanceResult {
  if (usdCents < 0n || usdCents > BigInt(Number.MAX_SAFE_INTEGER)) return fail;
  return { error, balance: Number(usdCents) };
}
function usable(row: Wallet | null): bigint {
  return row && !row.is_frozen
    ? BigInt(row.balance_minor) - BigInt(row.locked_minor) : 0n;
}
function allowed(profile: Profile): boolean {
  return profile.status === 'active' && profile.age_verified &&
    (!casinoManualReviewRequired() || profile.support_approved === true) &&
    casinoCountryPermitted(profile.country) && !profile.self_excluded && !profile.restricted;
}

async function readProfile(db: Db, userId: string, walletCurrency?: FiatCurrency): Promise<Profile | null> {
  return db.queryOne<Profile>([
    "select p.status::text as status, coalesce(p.age_verified,false) as age_verified,",
    CASINO_SUPPORT_APPROVAL_SQL + " as support_approved,",
    "p.preferred_currency as currency, p.jurisdiction as country,", 
    "coalesce(l.self_excluded_until > now(), false) as self_excluded,",
    "exists(select 1 from nova.user_restrictions r where r.user_id = p.id",
    "and r.is_active and r.kind in ('self_exclusion','cooling_off','account_restriction')",
    "and r.effective_from <= now() and (r.effective_to is null or r.effective_to > now())) as restricted,",
    "l.max_stake_per_bet_minor::text, l.max_stake_per_day_minor::text,",
    "l.loss_limit_daily_minor::text, l.loss_limit_weekly_minor::text",
    "from nova.profiles p left join nova.user_limits l",
    "on l.user_id = p.id and l.currency = coalesce($2::text, p.preferred_currency)",
    "where p.id = $1",
  ].join(' '), [userId, walletCurrency ?? null]);
}

async function readWallet(db: Db, userId: string, currency: FiatCurrency, locked: boolean): Promise<Wallet | null> {
  return db.queryOne<Wallet>(
    'select balance_minor::text,locked_minor::text,is_frozen from nova.wallets ' +
    'where user_id=$1 and currency=$2' + (locked ? ' for update' : ''),
    [userId, currency],
  );
}

async function quote(): Promise<CasinoFxSnapshot> {
  const raw = await getUsdIrtRate();
  const snapshot: CasinoFxSnapshot = {
    source: 'arzhaam', rateIrtPerUsd: raw.value,
    observedAt: raw.timestamp ?? '', fetchedAt: new Date().toISOString(),
  };
  validateCasinoFxSnapshot(snapshot);
  return snapshot;
}

/** Non-mutating balance conversion: provider sees USD cents, native wallet stays fiat. */
export async function fiatCasinoBalance(db: Db, userId: string, boundCurrency: FiatCurrency): Promise<BalanceResult> {
  const p = await readProfile(db, userId);
  if (!p || !allowed(p)) return fail;
  const [w, fx] = await Promise.all([readWallet(db, userId, boundCurrency, false), quote()]);
  return respond(0, casinoLocalMinorToUsd(usable(w), boundCurrency, fx.rateIrtPerUsd));
}

async function limitsAllow(db: Db, userId: string, currency: FiatCurrency, amount: bigint, p: Profile): Promise<boolean> {
  if (amount < 1n || (p.max_stake_per_bet_minor !== null &&
      amount > BigInt(p.max_stake_per_bet_minor))) return false;
  const usage = await db.queryOne<{ day_stake: string; day_loss: string; week_loss: string }>([
    "select coalesce(sum(case when type='bet_debit' and created_at >= date_trunc('day',now() at time zone 'UTC') at time zone 'UTC'",
    "then -amount_minor else 0 end),0)::text as day_stake,",
    "coalesce(sum(case when created_at >= date_trunc('day',now() at time zone 'UTC') at time zone 'UTC'",
    "and (type in ('bet_debit','win_credit','bet_refund','void_refund') or (type='reversal' and reference like 'softaggregator:%')) then -amount_minor else 0 end),0)::text as day_loss,",
    "coalesce(sum(case when created_at >= date_trunc('week',now() at time zone 'UTC') at time zone 'UTC'",
    "and (type in ('bet_debit','win_credit','bet_refund','void_refund') or (type='reversal' and reference like 'softaggregator:%')) then -amount_minor else 0 end),0)::text as week_loss",
    "from nova.wallet_transactions where user_id=$1 and currency=$2",
  ].join(' '), [userId, currency]);
  if (!usage) return false;
  if (p.max_stake_per_day_minor !== null &&
      BigInt(usage.day_stake) + amount > BigInt(p.max_stake_per_day_minor)) return false;
  if (p.loss_limit_daily_minor !== null &&
      BigInt(usage.day_loss) + amount > BigInt(p.loss_limit_daily_minor)) return false;
  if (p.loss_limit_weekly_minor !== null &&
      BigInt(usage.week_loss) + amount > BigInt(p.loss_limit_weekly_minor)) return false;
  return true;
}

/** Requires installed, validated financial schema; never infer supplier, geo or legal sign-off from schema alone. */
export async function settleFiatCasinoCallback(
  db: Db, userId: string, event: SignedCallback, boundCurrency: FiatCurrency,
): Promise<BalanceResult> {
  if (event.action === 'balance') return fiatCasinoBalance(db, userId, boundCurrency);
  if (!event.callId || !event.identityHash || !event.amountMinor ||
      !event.roundId || !event.gameId) return fail;

  // A previously recorded round is always settled using its original FX.
  const prior = await db.queryOne<Round>(
    'select wallet_currency,rate_irt_per_usd::text,rate_observed_at::text ' +
    'from nova.softaggregator_round_fx where user_id=$1 and round_id=$2 and game_id=$3',
    [userId, event.roundId, event.gameId],
  );
  const freshFx = prior ? null : await quote();

  return db.transaction(async (tx) => {
    await tx.query('select pg_advisory_xact_lock(hashtext($1),hashtext($2))',
      ['softaggregator-callback', event.callId!]);
    const existing = await tx.queryOne<Receipt>(
      'select identity_hash,response_error,response_balance_minor::text ' +
      'from nova.softaggregator_callback_receipts where call_id=$1', [event.callId!]);
    if (existing) {
      return existing.identity_hash === event.identityHash
        ? respond(existing.response_error, BigInt(existing.response_balance_minor)) : fail;
    }

    // Serialize all callbacks for the round before acquiring the wallet lock.
    await tx.query('select pg_advisory_xact_lock(hashtext($1),hashtext($2))',
      ['softaggregator-round:' + userId, event.roundId! + ':' + event.gameId!]);
    const profile = await readProfile(tx, userId);
    if (!profile) return fail;
    let round = await tx.queryOne<Round>(
      'select wallet_currency,rate_irt_per_usd::text,rate_observed_at::text ' +
      'from nova.softaggregator_round_fx where user_id=$1 and round_id=$2 and game_id=$3 for update',
      [userId, event.roundId!, event.gameId!],
    );
    let currency: FiatCurrency;
    if (round) {
      if (round.wallet_currency !== boundCurrency) return fail;
      currency = boundCurrency;
    } else {
      if (!freshFx) return fail;
      currency = boundCurrency;
      validateCasinoFxSnapshot(freshFx);
      await tx.query(
        'insert into nova.softaggregator_round_fx ' +
        '(user_id,round_id,game_id,wallet_currency,rate_irt_per_usd,rate_source,rate_observed_at) ' +
        "values ($1,$2,$3,$4,$5,'arzhaam',$6)",
        [userId, event.roundId!, event.gameId!, currency,
          freshFx.rateIrtPerUsd, freshFx.observedAt],
      );
      round = { wallet_currency: currency, rate_irt_per_usd: freshFx.rateIrtPerUsd,
        rate_observed_at: freshFx.observedAt };
    }

    // Limits must be read for the frozen round currency, not a potentially
    // changed preferred_currency. Never let a preference switch bypass limits.
    const roundCurrencyProfile = await readProfile(tx, userId, currency);
    if (!roundCurrencyProfile) return fail;

    await tx.query('select pg_advisory_xact_lock(hashtext($1))',
      ['wallet:' + userId + ':' + currency]);
    await tx.query('insert into nova.wallets(user_id,currency,balance_minor) ' +
      'values($1,$2,0) on conflict(user_id,currency) do nothing', [userId, currency]);
    const w = await readWallet(tx, userId, currency, true);
    if (!w) return fail;
    const before = usable(w);
    const rate = round.rate_irt_per_usd;
    const isDebit = event.action === 'debit';
    let local = casinoUsdToLocalMinor(event.amountMinor!, currency, rate, isDebit ? 'up' : 'down');
    let originalDebitId: string | null = null;
    let originalCreditId: string | null = null;

    if (event.rollback && !isDebit) {
      const original = await tx.queryOne<OriginalDebit>([
        "select r.call_id,r.wallet_amount_minor::text from nova.softaggregator_callback_receipts r",
        "where r.user_id=$1 and r.round_id=$2 and r.game_id=$3 and r.action='debit'",
        "and r.rollback=false and r.response_error=0 and r.amount_minor=$4",
        "and not exists(select 1 from nova.softaggregator_callback_receipts t",
        "where t.original_debit_call_id=r.call_id and t.response_error=0)",
        "order by r.created_at,r.call_id limit 1 for update",
      ].join(' '), [userId, event.roundId!, event.gameId!, event.amountMinor!.toString()]);
      if (!original) return fail;
      originalDebitId = original.call_id;
      local = exactCasinoRefund(BigInt(original.wallet_amount_minor), event.amountMinor!, event.amountMinor!);
    } else if (event.rollback && isDebit) {
      // The provider can also reverse a previously credited win. Reclaim the
      // exact original local-currency credit, never re-rate and never twice.
      const original = await tx.queryOne<OriginalDebit>([
        "select r.call_id,r.wallet_amount_minor::text from nova.softaggregator_callback_receipts r",
        "where r.user_id=$1 and r.round_id=$2 and r.game_id=$3 and r.action='credit'",
        "and r.rollback=false and r.response_error=0 and r.amount_minor=$4",
        "and not exists(select 1 from nova.softaggregator_callback_receipts t",
        "where t.original_credit_call_id=r.call_id and t.response_error=0)",
        "order by r.created_at,r.call_id limit 1 for update",
      ].join(' '), [userId, event.roundId!, event.gameId!, event.amountMinor!.toString()]);
      if (!original || BigInt(original.wallet_amount_minor) <= 0n) return fail;
      originalCreditId = original.call_id;
      local = BigInt(original.wallet_amount_minor);
    }

    let error: 0 | 1 | 2 = 0;
    let after = before;
    let transactionId: string | null = null;
    if (w.is_frozen) {
      error = 2;
    } else if (isDebit && (local > before ||
      (!event.rollback && (!allowed(roundCurrencyProfile) ||
         !(await pilotCasinoDebitPermitted(tx, userId, event.amountMinor!)) ||
         roundCurrencyProfile.currency !== currency || event.amountMinor! < SOFTAGGREGATOR_MIN_BET_MINOR ||
        !(await limitsAllow(tx, userId, currency, local, roundCurrencyProfile)))))) {
      error = 1;
    } else if (local < 1n) {
      error = 2;
    } else {
      const posted = await tx.rpc<{ transaction_id: string; balance_after_minor: string }>('post_wallet_entry', {
        p_user_id: userId,
        p_type: event.rollback
          ? (isDebit ? 'reversal' : 'bet_refund')
          : (isDebit ? 'bet_debit' : 'win_credit'),
        p_amount_minor: (isDebit ? -local : local).toString(),
        p_currency: currency,
        p_idempotency_key: 'sa:' + createHash('sha256').update(event.callId!).digest('hex'),
        p_reference: 'softaggregator:' + event.callId!,
        p_metadata: {
          source: 'softaggregator', game_id: event.gameId, round_id: event.roundId,
          supplier_usd_minor: event.amountMinor!.toString(), rate_irt_per_usd: rate,
          rate_observed_at: round.rate_observed_at, rollback: event.rollback,
          original_debit_call_id: originalDebitId,
          original_credit_call_id: originalCreditId,
        },
        p_balance_floor: isDebit ? w.locked_minor : null,
      });
      transactionId = posted.transaction_id;
      after = BigInt(posted.balance_after_minor) - BigInt(w.locked_minor);
    }

    const usdBalance = casinoLocalMinorToUsd(after, currency, rate);
    await tx.query(
      'insert into nova.softaggregator_callback_receipts ' +
      '(call_id,identity_hash,user_id,action,amount_minor,response_error,response_balance_minor,' +
      'ledger_transaction_id,wallet_currency,wallet_amount_minor,round_id,game_id,rollback,' +
      'original_debit_call_id,original_credit_call_id) ' +
      'values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)',
      [event.callId!, event.identityHash!, userId, event.action, event.amountMinor!.toString(),
        error, usdBalance.toString(), transactionId, currency,
        transactionId ? local.toString() : '0', event.roundId!, event.gameId!,
        event.rollback, error === 0 ? originalDebitId : null,
        error === 0 ? originalCreditId : null],
    );
    return respond(error, usdBalance);
  });
}
