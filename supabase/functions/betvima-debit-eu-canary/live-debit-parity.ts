/**
 * INERT / NOT DEPLOYED: pure USD Debit gate sourced from live, operator-supplied
 * 3098 wallet.ts SHA-256 9df555a7e3f04354019435e8e9318675587eb9b401422c0e70e7cc16727ff5af.
 *
 * These helpers deliberately perform NO SQL or writes. Future settlement code
 * must separately verify supplier+trusted-edge signatures and independent
 * bridge Ed25519, actual 3098 single-player allowlist, immutable USD binding,
 * round/callback advisory locks, wallet serialization, and atomic ledger+receipt.
 *
 * Important live-vs-GitHub distinction: live pilot-limits.ts has NO fixed
 * operator caps. We must not silently import GitHub's $1/$5 pilot caps or skip
 * per-user DB limits. Running USD min wager is 10 minor units.
 */

export const LIVE_DEBIT_MIN_BET_MINOR = 10n;
export const LIVE_DEBIT_MAX_CALLBACK_MINOR = 1_000_000_000_000n;

export type LiveDebitProfile = Readonly<{
  status: string;
  age_verified: boolean;
  kyc_status: string;
  kyc_document_approved: boolean;
  currency: string;
  self_excluded: boolean;
  restricted: boolean;
  max_stake_per_bet_minor: string | null;
  max_stake_per_day_minor: string | null;
  loss_limit_daily_minor: string | null;
  loss_limit_weekly_minor: string | null;
}>;
export type LiveWallet = Readonly<{
  balance_minor: string;
  locked_minor: string;
  is_frozen: boolean;
}>;
export type LiveUsage = Readonly<{
  day_stake: string;
  day_loss: string;
  week_loss: string;
}>;
export type DebitGate = Readonly<{
  error: 0 | 1 | 2;
  balance_minor: bigint;
  allowed: boolean;
}>;
const strictInt = (value: string): bigint => {
  if (!/^-?(?:0|[1-9][0-9]*)$/.test(value)) throw new Error('INVALID_MINOR_VALUE');
  return BigInt(value);
};

export function liveAccountCanBet(profile: LiveDebitProfile): boolean {
  return profile.status === 'active' &&
    profile.age_verified === true &&
    profile.kyc_status === 'verified' &&
    profile.kyc_document_approved === true &&
    !profile.self_excluded &&
    !profile.restricted;
}

/** Informational only: NEVER use this to skip the mandatory live SQL usage read. */
export function liveNeedsLimitUsage(profile: LiveDebitProfile): boolean {
  return profile.max_stake_per_day_minor !== null ||
    profile.loss_limit_daily_minor !== null ||
    profile.loss_limit_weekly_minor !== null;
}

/**
 * Equivalent to the live 3098 USD limitAllows() once pilot limit
 * (amount > 0) has been checked. Uses identical wallet transaction
 * aggregates, not callback receipt aggregates.
 */
export function livePersonalLimitsAllow(
  amount: bigint, profile: LiveDebitProfile, usage: LiveUsage | null,
): boolean {
  try {
    if (amount <= 0n) return false;
    if (profile.max_stake_per_bet_minor !== null &&
        amount > strictInt(profile.max_stake_per_bet_minor)) return false;
    // Exact running 3098 behavior: limitAllows() ALWAYS queries
    // wallet_transactions, even if all rolling caps are null. A database
    // outage/null aggregate row must deny a wager, not silently waive checks.
    if (!usage) return false;
    if (profile.max_stake_per_day_minor !== null &&
        strictInt(usage.day_stake) + amount >
          strictInt(profile.max_stake_per_day_minor)) return false;
    if (profile.loss_limit_daily_minor !== null &&
        strictInt(usage.day_loss) + amount >
          strictInt(profile.loss_limit_daily_minor)) return false;
    if (profile.loss_limit_weekly_minor !== null &&
        strictInt(usage.week_loss) + amount >
          strictInt(profile.loss_limit_weekly_minor)) return false;
    return true;
  } catch {
    // Malformed DB numbers or DB aggregation failure never relax limits.
    return false;
  }
}

/**
 * Only evaluates a NEW ordinary USD Debit AFTER the financial transaction
 * has acquired call, round and wallet advisory locks and read the live wallet.
 * No receipt is created here, so this is not a settlement implementation.
 */
export function liveUsdDebitGate(
  amount: bigint,
  boundCurrency: string,
  wallet: LiveWallet,
  profile: LiveDebitProfile | null,
  usage: LiveUsage | null,
): DebitGate {
  let before = 0n;
  try {
    before = strictInt(wallet.balance_minor) - strictInt(wallet.locked_minor);
    if (before < 0n) return { error: 2, balance_minor: 0n, allowed: false };
    // Live wallet.ts returns error=2 for frozen wallet; other Debit
    // eligibility failures are error=1 with the available balance.
    if (wallet.is_frozen) return { error: 2, balance_minor: 0n, allowed: false };
    const allowed = amount >= LIVE_DEBIT_MIN_BET_MINOR &&
      amount <= LIVE_DEBIT_MAX_CALLBACK_MINOR &&
      before >= amount &&
      boundCurrency === 'USD' &&
      !!profile &&
      liveAccountCanBet(profile) &&
      profile.currency === boundCurrency &&
      livePersonalLimitsAllow(amount, profile, usage);
    return { error: allowed ? 0 : 1, balance_minor: before, allowed };
  } catch {
    return { error: 2, balance_minor: 0n, allowed: false };
  }
}
