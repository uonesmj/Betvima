/**
 * Read-only sportsbook decimal display. Never use this value for payout,
 * betslip stake, price acceptance, or any persisted odds data.
 */
export function formatBetsApiOdds(value: string | number | null | undefined): string {
  if (value == null || value === '') return '—';
  const decimal = Number(value);
  if (!Number.isFinite(decimal) || decimal <= 1 || decimal > 100_000) return '—';
  // Use a sportsbook-like 2-decimal screen quote, with unnecessary zeros removed.
  // Internal source price remains unchanged at full precision.
  if (decimal < 1.01) return decimal.toFixed(4).replace(/0+$/, '');
  return decimal.toFixed(2).replace(/\.?0+$/, '');
}
