import { describe, expect, it } from 'vitest';
import { parseOriginalsWalletSnapshot } from '@/lib/originals/wallet-readonly';

describe('Royal Vault real wallet read-only integration', () => {
  const valid = {
    ok: true,
    data: { wallet: { currency: 'USD', availableMinor: '1245' }, integrity: 'ok' },
  };

  it('reads the actual {ok,data} API envelope and formats USD minor units correctly', () => {
    const result = parseOriginalsWalletSnapshot(valid, 'USD', 'en');
    expect(result).toEqual({ currency: 'USD', availableMinor: '1245', availableFormatted: '12.45 USD' });
    expect(Object.isFrozen(result)).toBe(true);
    expect(valid.data.wallet.availableMinor).toBe('1245');
  });

  it('preserves integer minor units for IRR', () => {
    expect(parseOriginalsWalletSnapshot({
      ok: true,
      data: { wallet: { currency: 'IRR', availableMinor: '15200000' }, integrity: 'ok' },
    }, 'IRR', 'fa').availableFormatted).toBe('15,200,000 IRR');
  });

  it('fails closed on bad integrity, wrong currency, missing envelope or invalid amounts', () => {
    const cases: unknown[] = [
      { ...valid, data: { ...valid.data, integrity: 'mismatch' } },
      { ...valid, ok: false },
      { wallet: valid.data.wallet, integrity: 'ok' }, // Never mistake raw data for a valid API response.
      { ...valid, data: { wallet: { currency: 'IRR', availableMinor: '1245' }, integrity: 'ok' } },
      { ...valid, data: { wallet: { currency: 'USD', availableMinor: '-1' }, integrity: 'ok' } },
      { ...valid, data: { wallet: { currency: 'USD', availableMinor: '1.0' }, integrity: 'ok' } },
      { ...valid, data: { wallet: { currency: 'USD', availableMinor: 1245 }, integrity: 'ok' } },
      { ...valid, data: { wallet: { currency: 'USD', availableMinor: '1e6' }, integrity: 'ok' } },
      { ...valid, data: { wallet: { currency: 'USD', availableMinor: '01' }, integrity: 'ok' } },
      null, {},
    ];
    for (const bad of cases) {
      expect(() => parseOriginalsWalletSnapshot(bad, 'USD', 'en')).toThrow();
    }
  });

  it('accepts a zero balance without requiring or implying a financial transaction', () => {
    const result = parseOriginalsWalletSnapshot({
      ok: true,
      data: { wallet: { currency: 'USD', availableMinor: '0' }, integrity: 'ok' },
    }, 'USD', 'en');
    expect(result.availableFormatted).toBe('0 USD');
  });
});
