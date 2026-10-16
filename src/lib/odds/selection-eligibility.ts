/**
 * Client-side display gate only. Never overrides the server's authoritative
 * live quote, freshness, suspension, price-version or wallet checks.
 */
export function isDisplayBettableSelection(input: {
  matchBettingAvailable: boolean;
  marketStatus: string;
  selectionStatus: string;
  oddsScaled: string;
}): boolean {
  if (!input.matchBettingAvailable ||
      !['open', 'active'].includes(input.marketStatus) ||
      !['open', 'active'].includes(input.selectionStatus) ||
      !/^\d{1,18}$/.test(input.oddsScaled)) {
    return false;
  }
  try {
    // Values are basis-points scaled: 10,000 = 1.00, not a valid wager price.
    return BigInt(input.oddsScaled) > 10_000n;
  } catch {
    return false;
  }
}
