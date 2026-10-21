import { describe, expect, it } from 'vitest';
import { parseOriginalsWalletSnapshot } from '@/lib/originals/wallet-readonly';

describe('Royal Vault real wallet read-only integration', () => {
  const valid = { wallet: { currency: 'USD', availableMinor: '1245' }, integrity: 'ok' };
  it('formats USD minor units correctly without mutating the response', () => {
    const result = parseOriginalsWalletSnapshot(valid, 'USD', 'en');
    expect(result).toEqual({ currency: 'USD', availableMinor: '1245', availableFormatted: '12.45 USD' });
    expect(Object.isFrozen(result)).toBe(true);
    expect(valid.wallet.availableMinor).toBe('1245');
  });
  it('preserves integer minor units for IRR', () => {
    expect(parseOriginalsWalletSnapshot(
      { wallet: { currency: 'IRR', availableMinor: '15200000' }, integrity: 'ok' },
      'IRR',
      'fa',
    ).availableFormatted).toBe('15,200,000 IRR');
  });
  it('fails closed on bad integrity, wrong currency or invalid amounts', () => {
    const cases = [
      { ...valid, integrity: 'mismatch' },
      { ...valid, wallet: { currency: 'IRR', availableMinor: '1245' } },
      { ...valid, wallet: { currency: 'USD', availableMinor: '-1' } },
      { ...valid, wallet: { currency: 'USD', availableMinor: '1.0' } },
      { ...valid, wallet: { currency: 'USD', availableMinor: 1245 } },
      { ...valid, wallet: { currency: 'USD', availableMinor: '1e6' } },
      null,
      {},
    ];
    for (const bad of cases) {
      expect(() => parseOriginalsWalletSnapshot(bad, 'USD', 'en')).toThrow();
    }
  });
  it('accepts a zero balance without requiring or implying a financial transaction', () => {
    const result = parseOriginalsWalletSnapshot(
      { wallet: { currency: 'USD', availableMinor: '0' }, integrity: 'ok' },
      'USD',
      'en',
    );
    expect(result.availableFormatted).toBe('0 USD');
  });
});
