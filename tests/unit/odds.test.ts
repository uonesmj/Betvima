import { describe, expect, it } from 'vitest';
import {
  accumulatorOddsScaled, classifyMovement, detectOddsAnomalies, hasRejecting, hasSuspending,
  impliedProbabilityBps, isSaneOdds, oddsFromDecimalString, oddsMovementBps, oddsToDecimalString,
  overroundBps, ODDS_SCALE,
} from '@/domain/odds';
import { potentialPayout, payoutRational } from '@/domain/betslip';
import { money } from '@/domain/money';

describe('odds: representation', () => {
  it('parses and serialises scaled integers exactly', () => {
    expect(oddsFromDecimalString('2.5')).toBe(25_000n);
    expect(oddsFromDecimalString('1.01')).toBe(10_100n);
    expect(oddsFromDecimalString('1000.00')).toBe(10_000_000n);
    expect(oddsToDecimalString(25_000n)).toBe('2.5');
    expect(oddsToDecimalString(10_100n)).toBe('1.01');
    expect(() => oddsFromDecimalString('1.23456')).toThrowError(/INVALID_ODDS_FORMAT/);
    expect(ODDS_SCALE).toBe(10_000n);
  });

  it('bounds plausible odds', () => {
    expect(isSaneOdds(10_000n)).toBe(false);
    expect(isSaneOdds(10_100n)).toBe(true);
    expect(isSaneOdds(10_000_000n)).toBe(true);
    expect(isSaneOdds(10_000_001n)).toBe(false);
  });

  it('derives implied probability and overround', () => {
    expect(impliedProbabilityBps(20_000n)).toBe(5_000n);
    // 2.00 / 4.00 / 4.00 implies 50% + 25% + 25% = 100% -> zero overround
    expect(overroundBps([20_000n, 40_000n, 40_000n])).toBe(0n);
    // 2.00 / 3.00 / 3.00 implies 50% + 33.3% + 33.3% = 116.6% -> positive margin
    expect(overroundBps([20_000n, 30_000n, 30_000n])).toBe(1_666n);
  });
});

describe('odds: accumulator pricing (single rounding, exact rational)', () => {
  it('prices a single at stake * odds', () => {
    expect(potentialPayout(money(100_000n, 'IRT'), [25_000n]).amount).toBe(250_000n);
    expect(potentialPayout(money(50_000n, 'IRT'), [30_000n]).amount).toBe(150_000n);
  });

  it('prices accumulators with one rounding at the end (no drift)', () => {
    // 100,000 * 2.8 * 1.8 = 504,000
    expect(potentialPayout(money(100_000n, 'IRT'), [28_000n, 18_000n]).amount).toBe(504_000n);
    // 100,000 * 2.5 * 2.5 = 625,000
    expect(potentialPayout(money(100_000n, 'IRT'), [25_000n, 25_000n]).amount).toBe(625_000n);
    const { num, den } = payoutRational([28_000n, 18_000n]);
    expect(num).toBe(504_000_000n);
    expect(den).toBe(100_000_000n);
  });

  it('computes combined odds for display', () => {
    expect(accumulatorOddsScaled([25_000n])).toBe(25_000n);
    expect(accumulatorOddsScaled([25_000n, 20_000n])).toBe(50_000n);
    expect(accumulatorOddsScaled([20_000n, 30_000n, 20_000n])).toBe(120_000n);
  });
});

describe('odds: movement + anomaly detection', () => {
  it('classifies movement direction and magnitude', () => {
    expect(oddsMovementBps(20_000n, 25_000n)).toBe(2_500n);
    expect(classifyMovement(20_000n, 20_400n)).toBe('INCREASED');
    expect(classifyMovement(20_000n, 19_600n)).toBe('DECREASED');
    expect(classifyMovement(20_000n, 20_000n)).toBe('UNCHANGED');
    expect(classifyMovement(20_000n, 40_000n)).toBe('SIGNIFICANT');
  });

  it('rejects impossible values and suspends suspicious jumps / stale ticks', () => {
    const now = new Date('2026-01-01T12:00:00Z');
    const base = { providerTimestamp: now, ingestedAt: now, maxAgeSeconds: 45 };

    expect(detectOddsAnomalies({ ...base, odds: 0n })[0]?.code).toBe('NEGATIVE_OR_ZERO');
    expect(hasRejecting(detectOddsAnomalies({ ...base, odds: 5n }))).toBe(true);

    const jump = detectOddsAnomalies({ ...base, odds: 100_000n, previousOdds: 20_000n });
    expect(jump.map((a) => a.code)).toContain('ABNORMAL_JUMP');
    expect(hasSuspending(jump)).toBe(true);

    const stale = detectOddsAnomalies({
      odds: 25_000n, providerTimestamp: new Date(now.getTime() - 10 * 60_000), ingestedAt: now, maxAgeSeconds: 45,
    });
    expect(stale.map((a) => a.code)).toContain('STALE_TIMESTAMP');

    const future = detectOddsAnomalies({
      odds: 25_000n, providerTimestamp: new Date(now.getTime() + 10 * 60_000), ingestedAt: now, maxAgeSeconds: 45,
    });
    expect(future.map((a) => a.code)).toContain('FUTURE_TIMESTAMP');
  });
});
