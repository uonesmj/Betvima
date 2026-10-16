import { describe, expect, it } from 'vitest';
import { casinoCountryPermitted } from '@/server/providers/softaggregator/jurisdiction';

describe('SoftAggregator lawful-jurisdiction configuration', () => {
  it('defaults to disabled for missing or unrecognized country policies', () => {
    expect(casinoCountryPermitted('DE', undefined)).toBe(false);
    expect(casinoCountryPermitted(null, 'DE')).toBe(false);
    expect(casinoCountryPermitted('de', 'DE')).toBe(false);
    expect(casinoCountryPermitted('FR', 'DE,BR')).toBe(false);
  });

  it('matches only explicit two-letter countries (not provider availability)', () => {
    expect(casinoCountryPermitted('DE', 'DE,BR')).toBe(true);
    expect(casinoCountryPermitted('BR', 'DE, BR')).toBe(true);
    expect(casinoCountryPermitted('GB', 'DE,BR')).toBe(false);
  });

  it('rejects wildcard, empty entries, duplicates, and malformed configuration', () => {
    for (const policy of ['*', 'DE,', ',DE', 'DE,DE', 'DE;BR', 'de', 'DE,FR,xx']) {
      expect(casinoCountryPermitted('DE', policy)).toBe(false);
    }
  });
});
