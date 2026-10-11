/**
 * MANDATORY AFFILIATE EXAMPLES (spec §29, §81, §99) - TypeScript engine.
 * These must agree byte-for-byte with the SQL implementation
 * (tests/sql/04_affiliate_test.sql exercises the same numbers through the database).
 */
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CONFIG, calculatePeriodSettlement, computeCommission, computeParentOverride,
  payableBalance, resolveEffectiveConfig, userResultMinor, type CommissionConfig,
} from '@/domain/affiliate-commission';

const modelA: CommissionConfig = {
  ...DEFAULT_CONFIG, model: 'PROFIT_LOSS_35', allowNegativeBalance: true, negativeFloorMinor: 0n, currency: 'IRT',
};
const modelB: CommissionConfig = {
  ...DEFAULT_CONFIG, model: 'NON_NEGATIVE_35', allowNegativeBalance: false, negativeFloorMinor: 0n, currency: 'IRT',
};

describe('commission sign convention', () => {
  it('computes the signed user result', () => {
    expect(userResultMinor(0n, 10_000_000n)).toBe(-10_000_000n);            // user lost 10M
    expect(userResultMinor(30_000_000n, 10_000_000n)).toBe(20_000_000n);    // user won 20M
  });

  it('MODEL A: user loses 10,000,000 at 35% -> affiliate +3,500,000', () => {
    const entry = computeCommission({ sourceAmountMinor: userResultMinor(0n, 10_000_000n), rateBps: 3500n, config: modelA });
    expect(entry.amountMinor).toBe(3_500_000n);
    expect(entry.type).toBe('user_loss_commission');
    expect(entry.direction).toBe('credit');
  });

  it('MODEL A: user wins 20,000,000 at 35% -> affiliate -7,000,000', () => {
    const entry = computeCommission({ sourceAmountMinor: userResultMinor(30_000_000n, 10_000_000n), rateBps: 3500n, config: modelA });
    expect(entry.amountMinor).toBe(-7_000_000n);
    expect(entry.type).toBe('user_win_debit');
    expect(entry.direction).toBe('debit');
  });

  it('produces no entry for a void bet (user result 0)', () => {
    const entry = computeCommission({ sourceAmountMinor: userResultMinor(10_000_000n, 10_000_000n), rateBps: 3500n, config: modelA });
    expect(entry.amountMinor).toBe(0n);
  });

  it('caps child + parent commission to the configured total cap', () => {
    const capped: CommissionConfig = { ...modelB, netCapBps: 4000n };
    const child = computeCommission({ sourceAmountMinor: -10_000_000n, rateBps: 3500n, parentBps: 1000n, config: capped });
    const parent = computeParentOverride({ sourceAmountMinor: -10_000_000n, childRateBps: 3500n, parentOverrideBps: 1000n, config: capped });
    expect(child.capApplied).toBe(true);
    expect(child.amountMinor + parent.amountMinor).toBe(4_000_000n); // exactly 40% of 10,000,000
  });
});

describe('MODEL A - variable profit/loss with negative carry-forward', () => {
  it('preserves a negative balance: +3.5M then -7M -> -3.5M', () => {
    const raw = 3_500_000n + -7_000_000n;
    const balance = payableBalance({ rawMinor: raw, model: 'PROFIT_LOSS_35', allowNegativeBalance: true, negativeFloorMinor: 0n });
    expect(balance.payableMinor).toBe(-3_500_000n);
    expect(balance.floorApplied).toBe(false);
    expect(balance.suppressedMinor).toBe(0n);
  });

  it('next period +10,000,000 -> payable 6,500,000 (spec §99)', () => {
    const calc = calculatePeriodSettlement({
      entries: [{ amountMinor: 10_000_000n, type: 'user_loss_commission', currency: 'IRT' }],
      openingCarryMinor: -3_500_000n,
      config: modelA,
    });
    expect(calc.periodNetMinor).toBe(10_000_000n);
    expect(calc.closingPayableMinor).toBe(6_500_000n);
    expect(calc.payoutMinor).toBe(6_500_000n);
    expect(calc.nextCarryMinor).toBe(0n);
  });

  it('carries a deficit forward instead of paying', () => {
    const calc = calculatePeriodSettlement({
      entries: [{ amountMinor: -7_000_000n, type: 'user_win_debit', currency: 'IRT' }],
      openingCarryMinor: 3_500_000n,
      config: modelA,
    });
    expect(calc.closingPayableMinor).toBe(-3_500_000n);
    expect(calc.payoutMinor).toBe(0n);
    expect(calc.belowMinimumPayout).toBe(true);
    expect(calc.nextCarryMinor).toBe(-3_500_000n);
  });
});

describe('MODEL B - non-negative payable balance', () => {
  it('never goes negative: +3.5M then -7M -> payable 0', () => {
    const balance = payableBalance({ rawMinor: -3_500_000n, model: 'NON_NEGATIVE_35', allowNegativeBalance: false, negativeFloorMinor: 0n });
    expect(balance.payableMinor).toBe(0n);
    expect(balance.rawMinor).toBe(-3_500_000n);      // raw events kept for audit
    expect(balance.suppressedMinor).toBe(3_500_000n);
    expect(balance.floorApplied).toBe(true);
  });

  it('stays at zero however much referred users win (100M / 500M / 1B)', () => {
    for (const win of [100_000_000n, 500_000_000n, 1_000_000_000n]) {
      const raw = 3_500_000n - win;
      const balance = payableBalance({ rawMinor: raw, model: 'NON_NEGATIVE_35', allowNegativeBalance: false, negativeFloorMinor: 0n });
      expect(balance.payableMinor).toBe(0n);
      expect(balance.payableMinor >= 0n).toBe(true);
    }
  });

  it('recovers after a suppressed deficit (no permanent carry of negatives)', () => {
    const calc = calculatePeriodSettlement({
      entries: [{ amountMinor: 10_000_000n, type: 'user_loss_commission', currency: 'IRT' }],
      openingCarryMinor: 0n,
      config: modelB,
    });
    expect(calc.closingPayableMinor).toBe(10_000_000n);
    expect(calc.nextCarryMinor).toBe(0n);
  });
});

describe('minimum payout + carry forward', () => {
  it('below minimum (3M < 5M) -> no payout, balance carried', () => {
    const calc = calculatePeriodSettlement({
      entries: [{ amountMinor: 3_000_000n, type: 'user_loss_commission', currency: 'IRT' }],
      openingCarryMinor: 0n,
      config: modelB,
    });
    expect(calc.payoutMinor).toBe(0n);
    expect(calc.belowMinimumPayout).toBe(true);
    expect(calc.nextCarryMinor).toBe(3_000_000n);
  });

  it('carry-forward + new earnings reach the minimum -> payable', () => {
    const calc = calculatePeriodSettlement({
      entries: [{ amountMinor: 3_000_000n, type: 'user_loss_commission', currency: 'IRT' }],
      openingCarryMinor: 3_000_000n,
      config: modelB,
    });
    expect(calc.payoutMinor).toBe(6_000_000n);
    expect(calc.nextCarryMinor).toBe(0n);
  });

  it('honours a maximum payout cap and carries the remainder', () => {
    const capped: CommissionConfig = { ...modelB, maxPayoutMinor: 4_000_000n };
    const calc = calculatePeriodSettlement({
      entries: [{ amountMinor: 10_000_000n, type: 'user_loss_commission', currency: 'IRT' }],
      openingCarryMinor: 0n,
      config: capped,
    });
    expect(calc.payoutMinor).toBe(4_000_000n);
    expect(calc.nextCarryMinor).toBe(6_000_000n);
    expect(calc.cappedByMaximum).toBe(true);
  });

  it('applies the turnover-based bps cap when configured', () => {
    const capped: CommissionConfig = { ...modelB, netCapBps: 2000n };
    const calc = calculatePeriodSettlement({
      entries: [{ amountMinor: 10_000_000n, type: 'user_loss_commission', currency: 'IRT' }],
      openingCarryMinor: 0n,
      config: capped,
      periodTurnoverMinor: 100_000_000n,   // 20% of turnover = 20,000,000 -> no cap hit
    });
    expect(calc.periodNetMinor).toBe(10_000_000n);

    const capped2 = calculatePeriodSettlement({
      entries: [{ amountMinor: 10_000_000n, type: 'user_loss_commission', currency: 'IRT' }],
      openingCarryMinor: 0n,
      config: capped,
      periodTurnoverMinor: 10_000_000n,    // 20% of turnover = 2,000,000 -> capped
    });
    expect(capped2.periodNetMinor).toBe(2_000_000n);
    expect(capped2.cappedByMaximum).toBe(true);
  });
});

describe('configuration specificity ladder', () => {
  it('lets the most specific layer win', () => {
    const { config, source } = resolveEffectiveConfig(modelB, [
      { scope: 'SPORT', config: { rateBps: 3000n } },
      { scope: 'AFFILIATE', config: { rateBps: 2500n } },
    ]);
    expect(source).toBe('AFFILIATE');
    expect(config.rateBps).toBe(2500n);
  });
});
