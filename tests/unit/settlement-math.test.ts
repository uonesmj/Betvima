import { describe, expect, it } from 'vitest';
import { computeBetPayout, multiplierToDecimal, payoutFromBet } from '@/domain/bet-settlement-math';
import { money } from '@/domain/money';

const legs = (...items: [string, 'WON' | 'LOST' | 'VOID' | 'HALF_WON' | 'HALF_LOST' | 'PENDING' | 'MANUAL_REVIEW', bigint][]) =>
  items.map(([selectionId, grade, odds]) => ({ selectionId, grade, odds }));

describe('settlement math: singles', () => {
  it('pays stake * odds on a win', () => {
    const result = computeBetPayout({ stake: money(100_000n, 'IRT'), legs: legs(['s1', 'WON', 25_000n]) });
    expect(result.payout.amount).toBe(250_000n);
    expect(result.status).toBe('settled');
    expect(result.creditType).toBe('win_credit');
    expect(result.netUserResult.amount).toBe(150_000n);
  });

  it('pays nothing on a loss', () => {
    const result = computeBetPayout({ stake: money(100_000n, 'IRT'), legs: legs(['s1', 'LOST', 25_000n]) });
    expect(result.payout.amount).toBe(0n);
    expect(result.creditType).toBe('none');
    expect(result.netUserResult.amount).toBe(-100_000n);
  });

  it('refunds the stake in full when the bet is void', () => {
    const result = computeBetPayout({ stake: money(100_000n, 'IRT'), legs: legs(['s1', 'VOID', 25_000n]) });
    expect(result.payout.amount).toBe(100_000n);
    expect(result.status).toBe('void');
    expect(result.allVoid).toBe(true);
    expect(result.creditType).toBe('void_refund');
    expect(result.netUserResult.amount).toBe(0n);
  });

  it('applies half-won / half-lost as exact fractions of the stake', () => {
    const halfWon = computeBetPayout({ stake: money(100_000n, 'IRT'), legs: legs(['s1', 'HALF_WON', 20_000n]) });
    // half the stake at 2.00 + half at 1.00 = 150,000
    expect(halfWon.payout.amount).toBe(150_000n);
    expect(halfWon.status).toBe('partially_settled');

    const halfLost = computeBetPayout({ stake: money(100_000n, 'IRT'), legs: legs(['s1', 'HALF_LOST', 20_000n]) });
    expect(halfLost.payout.amount).toBe(50_000n);
    expect(halfLost.status).toBe('partially_settled');
  });

  it('rounds exactly once, half-up', () => {
    const result = computeBetPayout({ stake: money(1n, 'IRT'), legs: legs(['s1', 'WON', 15_000n]) });
    expect(result.payout.amount).toBe(2n);   // 1 * 1.5 = 1.5 -> 2
  });
});

describe('settlement math: accumulators', () => {
  it('multiplies winning legs', () => {
    const result = computeBetPayout({ stake: money(100_000n, 'IRT'), legs: legs(['s1', 'WON', 28_000n], ['s2', 'WON', 18_000n]) });
    expect(result.payout.amount).toBe(504_000n);
    expect(multiplierToDecimal(result.multiplierNum, result.multiplierDen)).toBe('5.04');
  });

  it('removes void legs and recomputes the remaining odds', () => {
    const result = computeBetPayout({ stake: money(100_000n, 'IRT'), legs: legs(['s1', 'WON', 20_000n], ['s2', 'VOID', 50_000n]) });
    expect(result.payout.amount).toBe(200_000n);   // only the 2.00 leg counts
    expect(result.status).toBe('settled');
  });

  it('loses the whole accumulator when any leg loses', () => {
    const result = computeBetPayout({
      stake: money(100_000n, 'IRT'),
      legs: legs(['s1', 'WON', 20_000n], ['s2', 'LOST', 30_000n], ['s3', 'WON', 40_000n]),
    });
    expect(result.payout.amount).toBe(0n);
    expect(result.netUserResult.amount).toBe(-100_000n);
  });

  it('refunds the full stake when every leg is void', () => {
    const result = computeBetPayout({ stake: money(100_000n, 'IRT'), legs: legs(['s1', 'VOID', 20_000n], ['s2', 'VOID', 30_000n]) });
    expect(result.payout.amount).toBe(100_000n);
    expect(result.status).toBe('void');
  });

  it('refuses to settle a bet with pending or ambiguous legs', () => {
    expect(() => computeBetPayout({ stake: money(100_000n, 'IRT'), legs: legs(['s1', 'PENDING', 20_000n]) }))
      .toThrowError(/pending legs/);
    const review = computeBetPayout({ stake: money(100_000n, 'IRT'), legs: legs(['s1', 'MANUAL_REVIEW', 20_000n]) });
    expect(review.status).toBe('manual_review');
    expect(review.requiresManualReview).toBe(true);
    expect(review.payout.amount).toBe(0n);
  });

  it('never uses client-supplied odds (payoutFromBet reads placement odds)', () => {
    const result = payoutFromBet(money(50_000n, 'IRT'), [
      { selectionId: 's1', oddsAtPlacement: 30_000n, grade: 'WON' },
    ]);
    expect(result.payout.amount).toBe(150_000n);
  });
});
