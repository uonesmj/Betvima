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
/** EU member states (ISO 3166-1 alpha-2). A provider restriction is an
 * absolute deny rule, even when an operator accidentally allowlists a state.
 * This list must be reviewed when EU membership or provider terms change.
 */
export const SOFTAGGREGATOR_EU_RESTRICTED_COUNTRIES = Object.freeze([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI',
  'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU',
  'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
] as const);

const euRestrictedCountries: ReadonlySet<string> =
  new Set(SOFTAGGREGATOR_EU_RESTRICTED_COUNTRIES);

export function casinoCountryRestrictedByProvider(country: string | null): boolean {
  // Missing or malformed countries are handled by the fail-closed allowlist below.
  return typeof country === 'string' && euRestrictedCountries.has(country);
}

export function casinoCountryPermitted(
  country: string | null,
  configured: string | undefined = process.env.SOFTAGGREGATOR_ALLOWED_COUNTRIES,
): boolean {
  if (typeof country !== 'string' || !/^[A-Z]{2}$/.test(country)) return false;
  if (casinoCountryRestrictedByProvider(country)) return false;
  if (!configured || configured.length > 255) return false;
  const entries = configured.split(',').map((value) => value.trim());
  if (!entries.length || entries.length > 30 ||
      entries.some((entry) => !/^[A-Z]{2}$/.test(entry)) ||
      new Set(entries).size !== entries.length) return false;
  return entries.includes(country);
}
