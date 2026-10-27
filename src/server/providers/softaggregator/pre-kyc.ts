import type { Db } from '@/lib/ports/db';
import { casinoCountryPermitted } from './jurisdiction';

/**
 * Lifetime provider-denominated stake ceiling for a strictly optional,
 * jurisdiction-approved *provisional* casino onboarding path.
 * This is turnover, not net losses, available balance or a daily allowance.
 * The feature is OFF unless an operator explicitly enables it for individually
 * authorized countries. Age, current signed geo-location, self-exclusion,
 * account state and real-money feature/pilot gates remain mandatory.
 */
export const CASINO_PRE_KYC_LIFETIME_STAKE_USD_MINOR = 100n;

type KycPolicyProfile = { kyc_status: string; country: string | null };

export function casinoPreKycPermitted(profile: KycPolicyProfile): boolean {
  // A rejected/expired identity check may never be treated as a fresh applicant.
  if (profile.kyc_status !== 'not_started' && profile.kyc_status !== 'pending') return false;
  // Separate positive compliance attestation: this is not permission to waive
  // age verification, sanctions/geolocation, or legally mandated KYC.
  return process.env.SOFTAGGREGATOR_PRE_KYC_ENABLED === 'true' &&
    process.env.SOFTAGGREGATOR_PRE_KYC_LEGAL_APPROVAL === 'true' &&
    casinoCountryPermitted(profile.country) &&
    casinoCountryPermitted(profile.country, process.env.SOFTAGGREGATOR_PRE_KYC_ALLOWED_COUNTRIES);
}

export function casinoKycPermitted(profile: KycPolicyProfile): boolean {
  return profile.kyc_status === 'verified' || casinoPreKycPermitted(profile);
}

/**
 * The amount is summed from the supplier's durable receipts in USD cents,
 * regardless of whether the customer's native wallet is USD, IRT or IRR.
 * Refunds do not replenish the lifetime limit; payouts cannot replenish it.
 */
export async function casinoPreKycRemaining(
  db: Pick<Db, 'queryOne'>, userId: string,
): Promise<bigint> {
  const row = await db.queryOne<{ total_minor: string }>(
    "select coalesce(sum(amount_minor),0)::text as total_minor " +
    "from nova.softaggregator_callback_receipts " +
    "where user_id=$1 and action='debit' and rollback=false and response_error=0",
    [userId],
  );
  if (!row || !/^\d+$/.test(row.total_minor)) throw new Error('CASINO_PRE_KYC_USAGE_UNAVAILABLE');
  const remaining = CASINO_PRE_KYC_LIFETIME_STAKE_USD_MINOR - BigInt(row.total_minor);
  return remaining > 0n ? remaining : 0n;
}

/**
 * Acquire inside the SAME DB transaction that inserts the financial receipt.
 * All USD/fiat cash debit callbacks must use this user-wide lock before
 * calculating remaining stake; otherwise parallel game sessions could
 * independently spend the same final cents.
 */
export async function lockCasinoPreKycDebit(
  db: Pick<Db, 'query'>, userId: string,
): Promise<void> {
  await db.query('select pg_advisory_xact_lock(hashtext($1))', ['casino-pre-kyc:' + userId]);
}

export async function casinoPreKycAllowsDebit(
  db: Pick<Db, 'queryOne'>, userId: string, profile: KycPolicyProfile, amountUsdMinor: bigint,
): Promise<boolean> {
  if (profile.kyc_status === 'verified') return true;
  if (!casinoPreKycPermitted(profile) || amountUsdMinor <= 0n) return false;
  return amountUsdMinor <= await casinoPreKycRemaining(db, userId);
}
