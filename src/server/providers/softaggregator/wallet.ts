import { createHash } from 'node:crypto';
import { getDb } from '@/server/db';
import type { Db } from '@/lib/ports/db';
import { callbackResponse, type SignedCallback, userIdFromUsername } from './contract';
import { casinoRealMoneyUserAllowed } from './client';
import { fiatCasinoBalance, settleFiatCasinoCallback } from './fiat-wallet';
import { casinoFinancialSchemaReady } from './financial-readiness';
import { casinoCountryPermitted } from './jurisdiction';
import { bindCasinoPlayerWallet, readCasinoPlayerWallet } from './player-wallet-binding';

export type CasinoBalanceResponse = { error: 0 | 1 | 2; balance: number };
type ProfileRow = {
  status: string; age_verified: boolean; kyc_status: string; country: string | null; currency: string;
  self_excluded: boolean; restricted: boolean;
  max_stake_per_bet_minor: string | null; max_stake_per_day_minor: string | null;
  loss_limit_daily_minor: string | null; loss_limit_weekly_minor: string | null;
};
type WalletRow = { balance_minor: string; locked_minor: string; is_frozen: boolean };
type ReceiptRow = { identity_hash: string; response_error: 0 | 1 | 2; response_balance_minor: string };

async function getProfile(db: Db, userId: string): Promise<ProfileRow | null> {
  const sql = [
    "select p.status::text as status, p.age_verified, p.kyc_status::text as kyc_status,", 
    "p.jurisdiction as country, p.preferred_currency as currency,", 
    "coalesce(l.self_excluded_until > now(), false) as self_excluded,",
    "exists (select 1 from nova.user_restrictions r where r.user_id = p.id and r.is_active",
    "and r.kind in ('self_exclusion', 'cooling_off', 'account_restriction')",
    "and r.effective_from <= now() and (r.effective_to is null or r.effective_to > now())) as restricted,",
    "l.max_stake_per_bet_minor::text, l.max_stake_per_day_minor::text,",
    "l.loss_limit_daily_minor::text, l.loss_limit_weekly_minor::text",
    "from nova.profiles p left join nova.user_limits l on l.user_id = p.id and l.currency = 'USD'",
    "where p.id = $1",
  ].join(' ');
  return db.queryOne<ProfileRow>(sql, [userId]);
}
function accountCanBet(p: ProfileRow): boolean {
  return p.status === 'active' && p.age_verified === true && p.kyc_status === 'verified' &&
    casinoCountryPermitted(p.country) && !p.self_excluded && !p.restricted;
}
export async function casinoPlayerMayLaunch(userId: string): Promise<{ country: string; walletCurrency: string }> {
  if (!casinoRealMoneyUserAllowed(userId)) throw new Error('CASINO_REAL_MONEY_DISABLED');
  const db = getDb();
  if (!(await casinoFinancialSchemaReady(db))) throw new Error('CASINO_FINANCIAL_SCHEMA_MISSING');
  const p = await getProfile(db, userId);
  if (!p || !accountCanBet(p)) throw new Error('CASINO_PLAYER_NOT_ELIGIBLE');
  if (!p.country || !/^[A-Z]{2}$/.test(p.country)) throw new Error('CASINO_COUNTRY_REQUIRED');
  if (!["USD", "IRT", "IRR"].includes(p.currency)) throw new Error('CASINO_WALLET_CURRENCY_UNSUPPORTED');
  const wallet = await db.queryOne<WalletRow>(
    "select balance_minor::text, locked_minor::text, is_frozen from nova.wallets where user_id = $1 and currency = $2",
    [userId, p.currency],
  );
  if (!wallet || wallet.is_frozen) throw new Error('CASINO_WALLET_UNAVAILABLE');
  const nativeCurrency = await bindCasinoPlayerWallet(db, userId, p.currency);
  return { country: p.country, walletCurrency: nativeCurrency };
}
async function walletRow(db: Db, userId: string, locked: boolean): Promise<WalletRow | null> {
  return db.queryOne<WalletRow>(
    "select balance_minor::text, locked_minor::text, is_frozen from nova.wallets where user_id = $1 and currency = 'USD'" +
      (locked ? ' for update' : ''),
    [userId],
  );
}
function available(row: WalletRow | null): bigint {
  if (!row || row.is_frozen) return 0n;
  return BigInt(row.balance_minor) - BigInt(row.locked_minor);
}
function safeResponse(error: 0 | 1 | 2, value: bigint): CasinoBalanceResponse {
  if (value < 0n || value > BigInt(Number.MAX_SAFE_INTEGER)) return { error: 2, balance: 0 };
  return callbackResponse(error, value);
}
async function limitAllows(db: Db, userId: string, amount: bigint, p: ProfileRow): Promise<boolean> {
  if (p.max_stake_per_bet_minor !== null && amount > BigInt(p.max_stake_per_bet_minor)) return false;
  const sql = [
    "select coalesce(sum(case when type = 'bet_debit' and created_at >= date_trunc('day', now() at time zone 'UTC') at time zone 'UTC'",
    "then -amount_minor else 0 end),0)::text as day_stake,",
    "coalesce(sum(case when created_at >= date_trunc('day', now() at time zone 'UTC') at time zone 'UTC'",
    "and type in ('bet_debit','win_credit','bet_refund','void_refund') then -amount_minor else 0 end),0)::text as day_loss,",
    "coalesce(sum(case when created_at >= date_trunc('week', now() at time zone 'UTC') at time zone 'UTC'",
    "and type in ('bet_debit','win_credit','bet_refund','void_refund') then -amount_minor else 0 end),0)::text as week_loss",
    "from nova.wallet_transactions where user_id = $1 and currency = 'USD'",
  ].join(' ');
  const usage = await db.queryOne<{ day_stake: string; day_loss: string; week_loss: string }>(sql, [userId]);
  if (!usage) return false;
  if (p.max_stake_per_day_minor !== null &&
      BigInt(usage.day_stake) + amount > BigInt(p.max_stake_per_day_minor)) return false;
  if (p.loss_limit_daily_minor !== null &&
      BigInt(usage.day_loss) + amount > BigInt(p.loss_limit_daily_minor)) return false;
  if (p.loss_limit_weekly_minor !== null &&
      BigInt(usage.week_loss) + amount > BigInt(p.loss_limit_weekly_minor)) return false;
  return true;
}
export async function settleCasinoCallback(event: SignedCallback): Promise<CasinoBalanceResponse> {
  const userId = userIdFromUsername(event.username);
  if (!userId || !casinoRealMoneyUserAllowed(userId)) return { error: 2, balance: 0 };
  const db = getDb();
  // Every signed callback must independently fail closed on incomplete DB
  // migrations, even if a client/game session was opened before deployment.
  if (!(await casinoFinancialSchemaReady(db))) return { error: 2, balance: 0 };
  const currency = await readCasinoPlayerWallet(db, userId);
  // Never determine the first callback's wallet from a changeable user
  // preference. All real-money sessions bind the original wallet BEFORE
  // getGame; no binding means no cash is allowed to move.
  if (!currency) return { error: 2, balance: 0 };
  // Pre-existing rounds are independently immutable. A conflict is an error.
  const originalRound = event.roundId && event.gameId
    ? await db.queryOne<{ wallet_currency: string }>(
      'select wallet_currency from nova.softaggregator_round_fx ' +
      'where user_id=$1 and round_id=$2 and game_id=$3',
      [userId, event.roundId, event.gameId],
    )
    : null;
  if (originalRound && originalRound.wallet_currency !== currency)
    return { error: 2, balance: 0 };
  if (currency === 'IRT' || currency === 'IRR') {
    return event.action === 'balance'
      ? fiatCasinoBalance(db, userId, currency)
      : settleFiatCasinoCallback(db, userId, event, currency);
  }
  if (currency !== 'USD') return { error: 2, balance: 0 };
  if (event.action === 'balance') {
    const p = await getProfile(db, userId);
    if (!p || !accountCanBet(p)) return { error: 2, balance: 0 };
    return safeResponse(0, available(await walletRow(db, userId, false)));
  }
  if (!event.callId || !event.identityHash || !event.amountMinor || !event.roundId || !event.gameId) return { error: 2, balance: 0 };
  return db.transaction(async (tx) => {
    // Serialize concurrent retries independently from the per-wallet financial lock.
    await tx.query('select pg_advisory_xact_lock(hashtext($1), hashtext($2))', [
      'softaggregator-callback', event.callId!,
    ]);
    const existing = await tx.queryOne<ReceiptRow>(
      'select identity_hash, response_error, response_balance_minor::text from nova.softaggregator_callback_receipts where call_id = $1',
      [event.callId!],
    );
    if (existing) {
      if (existing.identity_hash !== event.identityHash) return { error: 2, balance: 0 };
      return safeResponse(existing.response_error, BigInt(existing.response_balance_minor));
    }
    // Lock the immutable round before wallet accounting; matching orders
    // prevent a concurrent credit from silently changing wallet currency.
    await tx.query('select pg_advisory_xact_lock(hashtext($1),hashtext($2))', [
      'softaggregator-round:' + userId, event.roundId! + ':' + event.gameId!,
    ]);
    const round = await tx.queryOne<{ wallet_currency: string }>(
      'select wallet_currency from nova.softaggregator_round_fx ' +
      'where user_id=$1 and round_id=$2 and game_id=$3 for update',
      [userId, event.roundId!, event.gameId!],
    );
    if (round && round.wallet_currency !== 'USD') return { error: 2, balance: 0 };
    if (!round) {
      await tx.query(
        'insert into nova.softaggregator_round_fx ' +
        '(user_id,round_id,game_id,wallet_currency,rate_source) ' +
        "values ($1,$2,$3,'USD','native_usd')",
        [userId, event.roundId!, event.gameId!],
      );
    }
    // Follow the same advisory-lock ordering as post_wallet_entry before locking wallet row.
    await tx.query('select pg_advisory_xact_lock(hashtext($1))', ['wallet:' + userId + ':USD']);
    const p = await getProfile(tx, userId);
    if (!p) return { error: 2, balance: 0 };
    await tx.query(
      "insert into nova.wallets(user_id,currency,balance_minor) values ($1,'USD',0) on conflict (user_id,currency) do nothing",
      [userId],
    );
    const w = await walletRow(tx, userId, true);
    if (!w) throw new Error('CASINO_WALLET_NOT_FOUND');
    const before = available(w);
    const isDebit = event.action === 'debit';
    let error: 0 | 1 | 2 = 0;
    let resultBalance = before;
    let entryId: string | null = null;
    let originalDebitCallId: string | null = null;
    let originalCreditCallId: string | null = null;
    // A rollback is the exact reverse of a previously posted movement.
    // Provider supports rb=1 on BOTH credit (refund bet) and debit (reverse win).
    if (event.rollback && event.action === 'credit') {
      const original = await tx.queryOne<{ call_id: string; wallet_amount_minor: string }>(
        "select r.call_id,r.wallet_amount_minor::text from nova.softaggregator_callback_receipts r " +
        "where r.user_id=$1 and r.action='debit' and r.round_id=$2 and r.game_id=$3 " +
        "and r.amount_minor=$4 and r.response_error=0 and r.rollback=false " +
        "and not exists(select 1 from nova.softaggregator_callback_receipts x " +
        "where x.original_debit_call_id=r.call_id and x.response_error=0) " +
        "order by r.created_at,r.call_id limit 1 for update",
        [userId, event.roundId, event.gameId, event.amountMinor!.toString()],
      );
      if (!original || BigInt(original.wallet_amount_minor) !== event.amountMinor)
        return { error: 2, balance: 0 };
      originalDebitCallId = original.call_id;
    } else if (event.rollback && event.action === 'debit') {
      const original = await tx.queryOne<{ call_id: string; wallet_amount_minor: string }>(
        "select r.call_id,r.wallet_amount_minor::text from nova.softaggregator_callback_receipts r " +
        "where r.user_id=$1 and r.action='credit' and r.round_id=$2 and r.game_id=$3 " +
        "and r.amount_minor=$4 and r.response_error=0 and r.rollback=false " +
        "and not exists(select 1 from nova.softaggregator_callback_receipts x " +
        "where x.original_credit_call_id=r.call_id and x.response_error=0) " +
        "order by r.created_at,r.call_id limit 1 for update",
        [userId, event.roundId, event.gameId, event.amountMinor!.toString()],
      );
      if (!original || BigInt(original.wallet_amount_minor) !== event.amountMinor)
        return { error: 2, balance: 0 };
      originalCreditCallId = original.call_id;
    }
    if (w.is_frozen) {
      error = 2;
    } else if (isDebit &&
      (before < event.amountMinor! ||
        (!event.rollback && (!accountCanBet(p) || p.currency !== currency || event.amountMinor! < 20n ||
          !(await limitAllows(tx, userId, event.amountMinor!, p)))))) {
      error = 1;
    } else {
      const signedAmount = isDebit ? -event.amountMinor! : event.amountMinor!;
      const posted = await tx.rpc<{ transaction_id: string; balance_after_minor: string }>('post_wallet_entry', {
        p_user_id: userId,
        p_type: event.rollback
          ? (isDebit ? 'reversal' : 'bet_refund')
          : (isDebit ? 'bet_debit' : 'win_credit'),
        p_amount_minor: signedAmount.toString(),
        p_currency: 'USD',
        p_idempotency_key: 'sa:' + createHash('sha256').update(event.callId!).digest('hex'),
        p_reference: 'softaggregator:' + event.callId!,
        p_metadata: { source: 'softaggregator', game_id: event.gameId, round_id: event.roundId, rollback: event.rollback },
        p_balance_floor: isDebit ? w.locked_minor : null,
      });
      entryId = posted.transaction_id;
      resultBalance = BigInt(posted.balance_after_minor) - BigInt(w.locked_minor);
    }
    // The receipt and the ledger mutation commit together.
    await tx.query(
      'insert into nova.softaggregator_callback_receipts ' +
      '(call_id,identity_hash,user_id,action,amount_minor,response_error,response_balance_minor,' +
      'ledger_transaction_id,wallet_currency,wallet_amount_minor,round_id,game_id,rollback,' +
      'original_debit_call_id,original_credit_call_id) ' +
      'values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)',
      [event.callId!, event.identityHash!, userId, event.action,
        event.amountMinor!.toString(), error, resultBalance.toString(), entryId,
        'USD', entryId ? event.amountMinor!.toString() : '0',
        event.roundId!, event.gameId!, event.rollback,
        error === 0 ? originalDebitCallId : null,
        error === 0 ? originalCreditCallId : null],
    );
    return safeResponse(error, resultBalance);
  });
}
