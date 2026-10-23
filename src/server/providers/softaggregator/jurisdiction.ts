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
/** Historical supplier-reported restricted territories (2026-10-23), informational only.
 * This provider list supersedes the earlier EU-wide restriction.
 * Operator licensing and local legal requirements are independent.
 */
export const SOFTAGGREGATOR_RESTRICTED_COUNTRIES = Object.freeze([
  'IT', 'ES', 'FR', 'MT', 'NL', 'LV', 'LT', 'IE',
] as const);

/** Operator-confirmed intended territories. Deployment and legal verification remain separate. */
export const BETVIMA_CASINO_APPROVED_COUNTRIES = Object.freeze([
  'IR', 'TR', 'AF', 'GE', 'AZ', 'TJ',
] as const);

const operatorApprovedCountries: ReadonlySet<string> =
  new Set(BETVIMA_CASINO_APPROVED_COUNTRIES);

const providerRestrictedCountries: ReadonlySet<string> =
  new Set(SOFTAGGREGATOR_RESTRICTED_COUNTRIES);

export function casinoCountryRestrictedByProvider(country: string | null): boolean {
  // Missing or malformed countries are handled by the fail-closed allowlist below.
  return typeof country === 'string' && providerRestrictedCountries.has(country);
}

export function casinoCountryPermitted(
  country: string | null,
  configured: string | undefined = process.env.SOFTAGGREGATOR_ALLOWED_COUNTRIES,
): boolean {
  if (typeof country !== 'string' || !/^[A-Z]{2}$/.test(country)) return false;
  // Supplier game-level restrictions are enforced by SoftAggregator, not
  // duplicated as a potentially stale local country blacklist. This gate
  // independently checks the operator's authorized real-money territories.
  if (!operatorApprovedCountries.has(country)) return false;
  if (!configured || configured.length > 255) return false;
  const entries = configured.split(',').map((value) => value.trim());
  if (!entries.length || entries.length > 30 ||
      entries.some((entry) => !/^[A-Z]{2}$/.test(entry)) ||
      new Set(entries).size !== entries.length) return false;
  return entries.includes(country);
}
