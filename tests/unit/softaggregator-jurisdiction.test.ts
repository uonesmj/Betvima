import { explicitCasinoCountryList } from '@/server/providers/softaggregator/release-audit';
import { describe, expect, it } from 'vitest';
import {
  casinoCountryPermitted,
  casinoCountryRestrictedByProvider,
  SOFTAGGREGATOR_RESTRICTED_COUNTRIES,
  BETVIMA_CASINO_APPROVED_COUNTRIES,
} from '@/server/providers/softaggregator/jurisdiction';

describe('SoftAggregator supplier country restrictions', () => {
  it('fails closed on missing, malformed or wildcard operator policies', () => {
    expect(casinoCountryPermitted('DE', '')).toBe(false);
    expect(casinoCountryPermitted(null, 'DE')).toBe(false);
    expect(casinoCountryPermitted('de', 'DE')).toBe(false);
    for (const policy of ['*', 'DE,', ',DE', 'DE,DE', 'DE;BR', 'de', 'DE,FR,xx']) {
      expect(casinoCountryPermitted('DE', policy)).toBe(false);
    }
  });

  it('reports the historical supplier list for diagnostics, without using it as a runtime per-game blacklist', () => {
    expect(SOFTAGGREGATOR_RESTRICTED_COUNTRIES).toEqual([
      'IT', 'ES', 'FR', 'MT', 'NL', 'LV', 'LT', 'IE',
    ]);
    for (const country of SOFTAGGREGATOR_RESTRICTED_COUNTRIES) {
      expect(casinoCountryRestrictedByProvider(country)).toBe(true);
      expect(casinoCountryPermitted(country, country)).toBe(false);
      expect(casinoCountryPermitted(country, country + ',DE')).toBe(false);
    }
  });

  it('does not treat other EU countries as supplier-restricted', () => {
    for (const country of ['DE', 'AT', 'BE', 'PT', 'SE']) {
      expect(casinoCountryRestrictedByProvider(country)).toBe(false);
      expect(casinoCountryPermitted(country, country)).toBe(false);
    }
  });

  it('allows only the six operator-confirmed countries when explicitly configured', () => {
    expect(BETVIMA_CASINO_APPROVED_COUNTRIES).toEqual(['IR','TR','AF','GE','AZ','TJ']);
    const config = 'IR,TR,AF,GE,AZ,TJ';
    for (const country of BETVIMA_CASINO_APPROVED_COUNTRIES) {
      expect(casinoCountryPermitted(country, config)).toBe(true);
    }
    expect(casinoCountryPermitted('DE', config)).toBe(false);
    expect(casinoCountryPermitted('GB', config)).toBe(false);
  });

  it('still requires explicit operator approval for any other country', () => {
    expect(casinoCountryPermitted('DE', 'DE,TR,GE,AZ')).toBe(false);
    expect(casinoCountryPermitted('TR', 'TR,GE,AZ')).toBe(true);
  });
});

describe('Casino readiness operator country list', () => {
  it('does not accept countries outside the operator authorization, independently of supplier rules', () => {
    expect(explicitCasinoCountryList('IT')).toBe(false);
    expect(explicitCasinoCountryList('TR,FR')).toBe(false);
  });
  it('accepts only explicitly configured operator territories', () => {
    expect(explicitCasinoCountryList('TR,GE,AZ')).toBe(true);
    expect(explicitCasinoCountryList('DE,TR,GE,AZ')).toBe(false);
    expect(explicitCasinoCountryList('')).toBe(false);
    expect(explicitCasinoCountryList('*')).toBe(false);
    expect(explicitCasinoCountryList('TR,TR')).toBe(false);
  });
});
