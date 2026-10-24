import type { Db } from '@/lib/ports/db';

/**
 * Real-money casino pilot only. These caps are denominated in USD cents,
 * irrespective of the player's underlying wallet currency.
 *
 * A single approved pilot ID is already mandatory for any live launch or
 * callback. Limits here deliberately do NOT modify nova.user_limits because
 * that table also governs regular sportsbook wagers.
 *
 * Never constrain a win payment or a rollback with wager caps.
 */
export const CASINO_PILOT_CAPS = Object.freeze({
  stakePerBetMinor: 100n,       // $1 per spin/bet
  dailyStakeMinor: 500n,       // $5 wagered per UTC day
  dailyNetLossMinor: 300n,     // $3 net loss per UTC day
  weeklyNetLossMinor: 500n,    // $5 net loss per UTC week
});

type Usage = {
  daily_stake: string;
  daily_net_loss: string;
  weekly_net_loss: string;
};

export async function pilotCasinoDebitPermitted(
  db: Pick<Db, 'queryOne'>, userId: string, amountMinor: bigint,
): Promise<boolean> {
  const pilot = (process.env.SOFTAGGREGATOR_TEST_USER_ID ?? '').trim().toLowerCase();
  // Fail closed for non-pilot accounts whenever the real-money flag is on.
  // Other layers also enforce the single-user allowlist, but this independent
  // debit guard must never silently waive wagering caps if routing changes.
  // With cash disabled, isolated wallet tests may still exercise the engine.
  if (!pilot || pilot !== userId.toLowerCase()) {
    return process.env.SOFTAGGREGATOR_REAL_MONEY_ENABLED !== 'true';
  }
  if (amountMinor < 1n || amountMinor > CASINO_PILOT_CAPS.stakePerBetMinor) return false;

  try {
    // Only vendor-approved, successful, immutable callbacks count.
    // Account-wide sportsbook limits and transactions stay untouched.
    // This read happens INSIDE the serialized, wallet-locked transaction.
    const usage = await db.queryOne<Usage>(`
      select
        coalesce(sum(case
          when action='debit' and rollback=false
           and created_at >= date_trunc('day',now() at time zone 'UTC') at time zone 'UTC'
          then amount_minor else 0 end),0)::text as daily_stake,
        coalesce(sum(case
          when created_at >= date_trunc('day',now() at time zone 'UTC') at time zone 'UTC'
          then case when action='debit' then amount_minor else -amount_minor end
          else 0 end),0)::text as daily_net_loss,
        coalesce(sum(case
          when created_at >= date_trunc('week',now() at time zone 'UTC') at time zone 'UTC'
          then case when action='debit' then amount_minor else -amount_minor end
          else 0 end),0)::text as weekly_net_loss
      from nova.softaggregator_callback_receipts
      where user_id=$1 and response_error=0
        and action in ('debit','credit')
    `, [userId]);
    if (!usage) return false;
    return BigInt(usage.daily_stake) + amountMinor <= CASINO_PILOT_CAPS.dailyStakeMinor &&
      BigInt(usage.daily_net_loss) + amountMinor <= CASINO_PILOT_CAPS.dailyNetLossMinor &&
      BigInt(usage.weekly_net_loss) + amountMinor <= CASINO_PILOT_CAPS.weeklyNetLossMinor;
  } catch {
    // A DB/reporting outage must deny a new wager rather than relax limits.
    return false;
  }
}
