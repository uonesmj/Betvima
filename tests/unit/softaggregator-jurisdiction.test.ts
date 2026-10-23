import { explicitCasinoCountryList } from '@/server/providers/softaggregator/release-audit';
import { describe, expect, it } from 'vitest';
import {
  casinoCountryPermitted,
  casinoCountryRestrictedByProvider,
  SOFTAGGREGATOR_EU_RESTRICTED_COUNTRIES,
} from '@/server/providers/softaggregator/jurisdiction';

describe('SoftAggregator jurisdiction and EU provider restriction', () => {
  it('fails closed when the country or policy is missing or malformed', () => {
    expect(casinoCountryPermitted('GB', '')).toBe(false);
    expect(casinoCountryPermitted(null, 'GB')).toBe(false);
    expect(casinoCountryPermitted('gb', 'GB')).toBe(false);
    expect(casinoCountryPermitted('GB', '*')).toBe(false);
    for (const policy of ['GB,', ',GB', 'GB,GB', 'GB;BR', 'gb', 'GB,FR,xx']) {
      expect(casinoCountryPermitted('GB', policy)).toBe(false);
    }
  });

  it('rejects all 27 EU member states even when mistakenly allowlisted', () => {
    expect(SOFTAGGREGATOR_EU_RESTRICTED_COUNTRIES).toHaveLength(27);
    expect(new Set(SOFTAGGREGATOR_EU_RESTRICTED_COUNTRIES).size).toBe(27);
    for (const country of SOFTAGGREGATOR_EU_RESTRICTED_COUNTRIES) {
      expect(casinoCountryRestrictedByProvider(country)).toBe(true);
      expect(casinoCountryPermitted(country, country)).toBe(false);
      expect(casinoCountryPermitted(country, country + ',GB')).toBe(false);
    }
  });

  it('does not automatically permit non-EU countries', () => {
    expect(casinoCountryRestrictedByProvider('GB')).toBe(false);
    expect(casinoCountryPermitted('GB', 'GB,BR')).toBe(true);
    expect(casinoCountryPermitted('BR', 'GB,BR')).toBe(true);
    expect(casinoCountryPermitted('TR', 'GB,BR')).toBe(false);
    expect(casinoCountryPermitted('GB', 'DE,GB')).toBe(true);
  });
});

describe('Casino readiness country-list audit', () => {
  it('rejects EU countries in an otherwise valid operator allowlist', () => {
    expect(explicitCasinoCountryList('DE')).toBe(false);
    expect(explicitCasinoCountryList('TR,DE')).toBe(false);
    expect(explicitCasinoCountryList('FR,GB')).toBe(false);
  });
  it('requires an explicit unique non-EU country list', () => {
    expect(explicitCasinoCountryList('TR,GE,AZ')).toBe(true);
    expect(explicitCasinoCountryList('')).toBe(false);
    expect(explicitCasinoCountryList('*')).toBe(false);
    expect(explicitCasinoCountryList('TR,TR')).toBe(false);
  });
});
