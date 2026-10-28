import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  convertAdminAmountToUsd,
  getAdminUsdRates,
  sumAdminUsdAmounts,
} from '@/server/utils/admin-usd';

describe('admin read-only money views must not depend on live exchange-rate providers', () => {
  it('never contacts Arzhaam or Navasan for report/list projections', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    try {
      await expect(getAdminUsdRates(['IRR', 'IRT', 'EUR', 'GBP', 'USD'])).resolves.toEqual({
        source: 'stored-usd-only',
      });
      expect(fetchSpy).not.toHaveBeenCalled();
      const source = readFileSync('src/server/utils/admin-usd.ts', 'utf8');
      expect(source).not.toMatch(/from ['"]@\/server\/providers\/(arzhaam|navasan)/);
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('never invents USD for non-USD nonzero amounts, including negative liabilities', () => {
    expect(convertAdminAmountToUsd(125n, 'USD')).toBe(125n);
    expect(convertAdminAmountToUsd(0n, 'IRR')).toBe(0n);
    for (const currency of ['IRR', 'IRT', 'EUR', 'GBP', 'XYZ']) {
      expect(convertAdminAmountToUsd(100n, currency)).toBeNull();
      expect(convertAdminAmountToUsd(-100n, currency)).toBeNull();
    }
  });

  it('preserves exact USD totals and never shows partial USD totals for mixed currencies', () => {
    expect(sumAdminUsdAmounts([
      { currency: 'USD', amountMinor: 100n },
      { currency: 'USD', amountMinor: -20n },
    ])).toBe(80n);
    expect(sumAdminUsdAmounts([
      { currency: 'USD', amountMinor: 100n },
      { currency: 'IRT', amountMinor: 0n },
    ])).toBe(100n);
    expect(sumAdminUsdAmounts([
      { currency: 'USD', amountMinor: 100n },
      { currency: 'IRT', amountMinor: 500n },
    ])).toBeNull();
  });
});
