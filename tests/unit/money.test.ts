import { describe, expect, it } from 'vitest';
import {
  add, applyBps, clampAtZero, compare, formatMinorUnits, money, mulRatio, parseMoneyToMinorUnits,
  roundDiv, sub, sum, toTransport, fromTransport, formatMoneyShort,
} from '@/domain/money';

describe('money: representation', () => {
  it('stores money as bigint minor units and never accepts a JS number', () => {
    expect(parseMoneyToMinorUnits('10000000', 'IRT')).toBe(10_000_000n);
    expect(parseMoneyToMinorUnits('1234.56', 'EUR')).toBe(123_456n);
    expect(parseMoneyToMinorUnits('1,234.5', 'USD')).toBe(123_450n);
    // @ts-expect-error deliberate misuse: floating point must be rejected at runtime
    expect(() => parseMoneyToMinorUnits(10.5, 'IRT')).toThrowError(/MONEY_MUST_BE_STRING/);
  });

  it('rejects precision beyond the currency minor units', () => {
    expect(() => parseMoneyToMinorUnits('10.123', 'EUR')).toThrowError(/PRECISION_EXCEEDED/);
    expect(() => parseMoneyToMinorUnits('abc', 'IRT')).toThrowError(/INVALID_MONEY_FORMAT/);
    expect(() => parseMoneyToMinorUnits('10', 'XXX')).toThrowError(/UNKNOWN_CURRENCY/);
  });

  it('formats without floating point drift', () => {
    expect(formatMinorUnits(10_000_000n, 'IRT')).toBe('10000000');
    expect(formatMinorUnits(-123_45n, 'EUR')).toBe('-123.45');
    expect(toTransport(money(123_45n, 'EUR'))).toEqual({ amount: '123.45', currency: 'EUR' });
    expect(fromTransport({ amount: '123.45', currency: 'EUR' }).amount).toBe(12_345n);
  });

  it('prints short human amounts', () => {
    expect(formatMoneyShort(money(3_500_000n, 'IRT'))).toContain('3.50M');
  });
});

describe('money: rounding policy (HALF_UP away from zero, deterministic)', () => {
  it('rounds halves away from zero symmetrically', () => {
    expect(roundDiv(5n, 2n)).toBe(3n);
    expect(roundDiv(-5n, 2n)).toBe(-3n);
    expect(roundDiv(4n, 2n)).toBe(2n);
    expect(roundDiv(-4n, 2n)).toBe(-2n);
    expect(roundDiv(7n, 3n)).toBe(2n);
    expect(roundDiv(-7n, 3n)).toBe(-2n);
    expect(roundDiv(1n, 3n)).toBe(0n);
    expect(() => roundDiv(1n, 0n)).toThrowError(/DIVISION_BY_ZERO/);
  });

  it('is the only rounding used for stakes, payouts and commissions', () => {
    expect(applyBps(money(10_000_000n, 'IRT'), 3500n).amount).toBe(3_500_000n);
    expect(applyBps(money(20_000_000n, 'IRT'), 3500n).amount).toBe(7_000_000n);
    expect(applyBps(money(1n, 'IRT'), 3_500n).amount).toBe(0n);       // 0.35 -> 0
    expect(applyBps(money(2n, 'IRT'), 3_500n).amount).toBe(1n);       // 0.70 -> 1
    expect(mulRatio(money(100n, 'EUR'), 1n, 3n).amount).toBe(33n);
  });
});

describe('money: arithmetic safety', () => {
  it('refuses to mix currencies', () => {
    expect(() => add(money(1n, 'IRT'), money(1n, 'EUR'))).toThrowError(/CURRENCY_MISMATCH/);
    expect(() => compare(money(1n, 'IRT'), money(1n, 'USD'))).toThrowError(/CURRENCY_MISMATCH/);
  });

  it('computes sums with an explicit currency and clamps only when asked', () => {
    expect(sum('IRT', [money(1n, 'IRT'), money(2n, 'IRT')]).amount).toBe(3n);
    expect(sub(money(10n, 'IRT'), money(25n, 'IRT')).amount).toBe(-15n);
    expect(clampAtZero(money(-15n, 'IRT')).amount).toBe(0n);
  });
});
