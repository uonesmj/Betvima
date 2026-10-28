/**
 * Read-only admin USD projections.
 *
 * Admin lists must never call a live FX vendor: their availability is independent
 * of Arzhaam/Navasan and a quote cannot be silently substituted or invented.
 * Original money amounts and currencies are preserved in API responses.
 *
 * Non-USD, nonzero amounts cannot be reported as USD without a verified
 * conversion. Return null (unavailable), NOT 0 and NOT the original amount.
 */
export type AdminUsdRates = { source: 'stored-usd-only' };

/** Retained as an async API to avoid changing read-only callers. No I/O. */
export async function getAdminUsdRates(_currencies: readonly string[]): Promise<AdminUsdRates> {
  return { source: 'stored-usd-only' };
}

export function convertAdminAmountToUsd(
  amountMinor: bigint,
  currency: string,
  _rates?: AdminUsdRates,
): bigint | null {
  if (currency.trim().toUpperCase() === 'USD' || amountMinor === 0n) return amountMinor;
  return null;
}

/** Propagate unavailable conversion instead of displaying a partial USD total. */
export function addAdminUsdAmounts(a: bigint | null, b: bigint | null): bigint | null {
  return a === null || b === null ? null : a + b;
}

export function sumAdminUsdAmounts(
  amounts: readonly { amountMinor: bigint; currency: string }[],
): bigint | null {
  return amounts.reduce<bigint | null>(
    (sum, entry) => addAdminUsdAmounts(sum, convertAdminAmountToUsd(entry.amountMinor, entry.currency)),
    0n,
  );
}
