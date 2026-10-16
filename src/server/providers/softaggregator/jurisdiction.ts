/**
 * An operator must independently configure jurisdictions for which BetVima
 * has established real-money casino authorization. SoftAggregator's game
 * country filter is NOT a substitute for an operator gambling licence or
 * server-verified player location.
 *
 * Fail closed for unset, wildcard, malformed and ambiguous configuration.
 * This is a *second* gate beside the one-player pilot allowlist; it does not
 * enable any player or override production feature flags.
 */
export function casinoCountryPermitted(
  country: string | null,
  configured: string | undefined = process.env.SOFTAGGREGATOR_ALLOWED_COUNTRIES,
): boolean {
  if (typeof country !== 'string' || !/^[A-Z]{2}$/.test(country)) return false;
  if (!configured || configured.length > 255) return false;
  const entries = configured.split(',').map((value) => value.trim());
  if (!entries.length || entries.length > 30 ||
      entries.some((entry) => !/^[A-Z]{2}$/.test(entry)) ||
      new Set(entries).size !== entries.length) return false;
  return entries.includes(country);
}
