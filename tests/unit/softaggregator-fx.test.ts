import { describe, expect, it } from 'vitest';
import {
  parseIrtUsdRate, casinoUsdToLocalMinor,
  casinoLocalMinorToUsd, exactCasinoRefund, validateCasinoFxSnapshot,
} from '@/server/providers/softaggregator/fx';

describe('SoftAggregator USD cents with native IRT/IRR wallets', () => {
  const rate = '250000.00000000'; // IRT per USD

  it('keeps game balance in USD and does not confuse toman with rial', () => {
    expect(casinoUsdToLocalMinor(100n, 'USD', rate, 'up')).toBe(100n);
    expect(casinoUsdToLocalMinor(100n, 'IRT', rate, 'up')).toBe(250000n);
    expect(casinoUsdToLocalMinor(100n, 'IRR', rate, 'up')).toBe(2500000n);
    expect(casinoLocalMinorToUsd(250000n, 'IRT', rate)).toBe(100n);
    expect(casinoLocalMinorToUsd(2500000n, 'IRR', rate)).toBe(100n);
  });

  it('rounds debit upward and win credits downward without floating errors', () => {
    const fractional = '250001.23456789';
    const debit = casinoUsdToLocalMinor(1n, 'IRT', fractional, 'up');
    const credit = casinoUsdToLocalMinor(1n, 'IRT', fractional, 'down');
    expect(debit).toBe(2501n);
    expect(credit).toBe(2500n);
    expect(casinoLocalMinorToUsd(debit, 'IRT', fractional)).toBe(1n);
  });

  it('refuses a new FX rate for a rollback; original amount must be recovered', () => {
    expect(exactCasinoRefund(50001n, 20n, 20n)).toBe(50001n);
    expect(() => exactCasinoRefund(50001n, 20n, 19n)).toThrow('ORIGINAL_DEBIT_REQUIRED');
  });

  it('rejects absent, forged, negative and implausible FX data', () => {
    for (const bad of ['0', '9', '1e6', '-25', '250000.123456789', '10000001', '']) {
      expect(() => parseIrtUsdRate(bad)).toThrow();
    }
    expect(() => casinoUsdToLocalMinor(-1n, 'IRT', rate, 'up')).toThrow();
    expect(() => casinoLocalMinorToUsd(-1n, 'IRR', rate)).toThrow();
  });

  it('requires a recent source timestamp for a rate quote', () => {
    const now = Date.parse('2026-10-16T10:00:00Z');
    const good = {
      source: 'arzhaam' as const,
      rateIrtPerUsd: rate,
      observedAt: '2026-10-16T09:59:30Z',
      fetchedAt: '2026-10-16T09:59:55Z',
    };
    expect(validateCasinoFxSnapshot(good, now)).toBe(parseIrtUsdRate(rate));
    expect(() => validateCasinoFxSnapshot({ ...good, observedAt: '2026-10-16T09:54:00Z' }, now)).toThrow();
    expect(() => validateCasinoFxSnapshot({ ...good, fetchedAt: '2026-10-16T10:02:00Z' }, now)).toThrow();
  });

  it('has a stable exact value across a USD game win and a local wallet credit', () => {
    const rate = '300000.00000000';
    const stake = casinoUsdToLocalMinor(4000n, 'IRT', rate, 'up');
    const win = casinoUsdToLocalMinor(8000n, 'IRT', rate, 'down');
    expect(stake).toBe(12_000_000n);
    expect(win).toBe(24_000_000n);
    expect(win - stake).toBe(12_000_000n);
  });
});
