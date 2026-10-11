/**
 * NOVA - AFFILIATE COMMISSION ENGINE (pure, deterministic)
 *
 * Single source of truth for commission math. Used by:
 *   - src/domain/affiliate-engine.ts (settlement/commission service)
 *   - SQL nova.apply_bet_commission / nova.settle_affiliate_period (same formula)
 *   - tests/unit/affiliate-*.test.ts
 *
 * MANDATORY BEHAVIOURAL EXAMPLES (spec §29, §81, §99)
 * ---------------------------------------------------------------------------
 * MODEL A  (commission_model = PROFIT_LOSS_35, allow_negative_balance = true)
 *   rate 35% | user loses 10,000,000  -> affiliate +3,500,000
 *   rate 35% | user wins  20,000,000  -> affiliate -7,000,000
 *   previous balance +3,500,000, then -7,000,000 -> -3,500,000 carry-forward
 *   next period +10,000,000 -> payable 6,500,000
 *
 * MODEL B  (commission_model = NON_NEGATIVE_35, allow_negative_balance = false)
 *   previous payable +3,500,000, user win impact -7,000,000
 *   -> payable 0  (NEVER -3,500,000)
 *   Raw events are still stored in the affiliate ledger for audit/reporting.
 *   Referred users may collectively win 100M / 500M / 1B: payable stays >= 0.
 */
import { money, roundDiv, type Money } from './money';
import { DomainError } from './errors';
import type { CommissionModel } from './types';

/** Basis-point denominator. 3500 bps = 35%. */
export const BPS_DEN = 10_000n;

export interface CommissionConfig {
  model: CommissionModel;
  rateBps: bigint;
  allowNegativeBalance: boolean;
  negativeFloorMinor: bigint;
  parentOverrideBps: bigint;
  /** Cap on TOTAL net commission (child + parent) expressed in bps of turnover. */
  netCapBps: bigint | null;
  carryForward: boolean;
  minPayoutMinor: bigint;
  maxPayoutMinor: bigint | null;
  currency: string;
}

export const DEFAULT_CONFIG: Omit<CommissionConfig, 'currency'> = {
  model: 'NON_NEGATIVE_35',
  rateBps: 3500n,
  allowNegativeBalance: false,
  negativeFloorMinor: 0n,
  parentOverrideBps: 0n,
  netCapBps: null,
  carryForward: true,
  minPayoutMinor: 5_000_000n,
  maxPayoutMinor: null,
};

/**
 * SIGN CONVENTION (single source of truth, mirrored in the SQL implementation)
 *   sourceAmountMinor / userResultMinor = the USER's result = payout - stake
 *       positive => the user won  (affiliate impact NEGATIVE)
 *       negative => the user lost (affiliate impact POSITIVE)
 *   affiliate ledger amount = -(user result) * rate
 *       user loses 10,000,000 -> +3,500,000 credit at 35%
 *       user wins  20,000,000 -> -7,000,000 debit  at 35%
 */
export function userResultMinor(payoutMinor: bigint, stakeMinor: bigint): bigint {
  return payoutMinor - stakeMinor;
}

export interface CommissionEntry {
  /** Signed affiliate ledger amount (positive = credit, negative = debit). */
  amountMinor: bigint;
  type: 'user_loss_commission' | 'user_win_debit';
  direction: 'credit' | 'debit';
  /** Commission basis points actually applied after any cap proration. */
  appliedRateBps: bigint;
  capApplied: boolean;
  sourceAmountMinor: bigint;
}

/**
 * Child affiliate commission for one settled bet.
 * `sourceAmountMinor` is the signed user result (see userResultMinor).
 */
export function computeCommission(input: {
  /** Signed USER result (payout - stake). */
  sourceAmountMinor: bigint;
  rateBps: bigint;
  config: CommissionConfig;
  parentBps?: bigint;
}): CommissionEntry {
  const { sourceAmountMinor, rateBps, config } = input;
  if (rateBps < 0n) throw new DomainError('VALIDATION_ERROR', 'Commission rate must be >= 0');
  if (rateBps > BPS_DEN) throw new DomainError('VALIDATION_ERROR', 'Commission rate must be <= 100%');

  if (sourceAmountMinor === 0n) {
    return { amountMinor: 0n, type: 'user_loss_commission', direction: 'credit', appliedRateBps: 0n, capApplied: false, sourceAmountMinor: 0n };
  }

  const totalBps = rateBps + (input.parentBps ?? 0n);
  let appliedBps = rateBps;
  let capApplied = false;
  if (config.netCapBps !== null && totalBps > config.netCapBps) {
    // Parent is prorated first; the child receives exactly the remaining headroom so the
    // combined commission never exceeds the cap and no basis point is silently lost.
    const parentApplied = roundDiv((input.parentBps ?? 0n) * config.netCapBps, totalBps, 'DOWN');
    appliedBps = config.netCapBps > parentApplied ? config.netCapBps - parentApplied : 0n;
    capApplied = true;
  }

  // The affiliate earns what the user loses, and vice versa (sign inverted here, once).
  const amountMinor = roundDiv(-sourceAmountMinor * appliedBps, BPS_DEN, 'HALF_UP');
  return {
    amountMinor,
    type: amountMinor >= 0n ? 'user_loss_commission' : 'user_win_debit',
    direction: amountMinor >= 0n ? 'credit' : 'debit',
    appliedRateBps: appliedBps,
    capApplied,
    sourceAmountMinor,
  };
}

/** Parent override commission for the same settled bet. */
export function computeParentOverride(input: {
  sourceAmountMinor: bigint;
  childRateBps: bigint;
  parentOverrideBps: bigint;
  config: CommissionConfig;
}): CommissionEntry {
  const { config } = input;
  const totalBps = input.childRateBps + input.parentOverrideBps;
  let appliedBps = input.parentOverrideBps;
  let capApplied = false;
  if (config.netCapBps !== null && totalBps > config.netCapBps) {
    appliedBps = totalBps === 0n ? 0n : roundDiv(input.parentOverrideBps * config.netCapBps, totalBps, 'DOWN');
    capApplied = true;
  }
  const amountMinor = roundDiv(-input.sourceAmountMinor * appliedBps, BPS_DEN, 'HALF_UP');
  return {
    amountMinor,
    type: amountMinor >= 0n ? 'user_loss_commission' : 'user_win_debit',
    direction: amountMinor >= 0n ? 'credit' : 'debit',
    appliedRateBps: appliedBps,
    capApplied,
    sourceAmountMinor: input.sourceAmountMinor,
  };
}

/* ------------------------------------------------------------------ *
 * Payable balance (MODEL A vs MODEL B)                               *
 * ------------------------------------------------------------------ */

export interface PayableBalance {
  /** Balance shown to the affiliate; always >= 0 when the model forbids negatives. */
  payableMinor: bigint;
  /** Raw signed ledger sum - always stored, always reported for audit. */
  rawMinor: bigint;
  /** Amount of negative raw balance suppressed by the floor-zero rule (MODEL B). */
  suppressedMinor: bigint;
  floorApplied: boolean;
}

export function payableBalance(input: {
  rawMinor: bigint;
  model: CommissionModel;
  allowNegativeBalance: boolean;
  negativeFloorMinor: bigint;
}): PayableBalance {
  const { rawMinor, allowNegativeBalance, negativeFloorMinor } = input;
  const floor = negativeFloorMinor < 0n ? negativeFloorMinor : 0n;
  if (allowNegativeBalance) {
    return { payableMinor: rawMinor, rawMinor, suppressedMinor: 0n, floorApplied: false };
  }
  // NON-NEGATIVE model: payable NEVER goes below the floor (0 by default).
  if (rawMinor < floor) {
    return { payableMinor: floor, rawMinor, suppressedMinor: floor - rawMinor, floorApplied: true };
  }
  return { payableMinor: rawMinor, rawMinor, suppressedMinor: 0n, floorApplied: false };
}

/* ------------------------------------------------------------------ *
 * Weekly (Friday) settlement                                         *
 * ------------------------------------------------------------------ */

export interface PeriodEntry {
  amountMinor: bigint;
  type: string;
  currency: string;
}

export interface PeriodSettlementCalculation {
  currency: string;
  openingCarryMinor: bigint;
  periodGrossCreditMinor: bigint;
  periodDebitMinor: bigint;
  periodNetMinor: bigint;
  /** After applying carry-forward and the floor-zero rule. */
  closingPayableMinor: bigint;
  /** Payable amount released in this settlement (0 when below minimum payout). */
  payoutMinor: bigint;
  /** Amount carried into the next period (may be negative for MODEL A). */
  nextCarryMinor: bigint;
  belowMinimumPayout: boolean;
  cappedByMaximum: boolean;
  floorApplied: boolean;
  suppressedMinor: bigint;
}

/**
 * Settlement calculation for one affiliate/period.
 * Order of operations (docs/AFFILIATE_RULES.md):
 *   snapshot eligible entries -> exclude pending -> net -> carry-forward -> min payout -> floor rule
 */
export function calculatePeriodSettlement(input: {
  entries: readonly PeriodEntry[];
  openingCarryMinor: bigint;
  config: CommissionConfig;
  /** Turnover of referred users in the period - used only for the bps cap. */
  periodTurnoverMinor?: bigint;
}): PeriodSettlementCalculation {
  const { entries, openingCarryMinor, config } = input;
  const currency = config.currency;
  const includePeriodCap = config.netCapBps !== null && input.periodTurnoverMinor !== undefined && input.periodTurnoverMinor > 0n;

  const eligible = entries.filter((e) => e.type !== 'settlement' && e.type !== 'payout' && e.type !== 'carry_forward' && e.type !== 'carry_forward_release');
  const grossCredit = eligible.reduce<bigint>((acc, e) => (e.amountMinor > 0n ? acc + e.amountMinor : acc), 0n);
  const debit = eligible.reduce<bigint>((acc, e) => (e.amountMinor < 0n ? acc + e.amountMinor : acc), 0n);
  let periodNet = grossCredit + debit;

  let cappedByMaximum = false;
  if (includePeriodCap) {
    const cap = roundDiv((input.periodTurnoverMinor as bigint) * (config.netCapBps as bigint), BPS_DEN, 'DOWN');
    if (periodNet > cap) {
      periodNet = cap;
      cappedByMaximum = true;
    }
  }

  const rawAfterCarry = openingCarryMinor + periodNet;
  const floored = payableBalance({
    rawMinor: rawAfterCarry,
    model: config.model,
    allowNegativeBalance: config.allowNegativeBalance,
    negativeFloorMinor: config.negativeFloorMinor,
  });
  const payable = floored.payableMinor;

  const meetsMinimum = payable >= config.minPayoutMinor;
  let payoutMinor = meetsMinimum ? payable : 0n;
  let belowMinimumPayout = !meetsMinimum;
  if (config.maxPayoutMinor !== null && payoutMinor > config.maxPayoutMinor) {
    payoutMinor = config.maxPayoutMinor;
    cappedByMaximum = true;
  }

  // Anything not paid becomes carry-forward. MODEL B never carries a negative balance;
  // the suppressed deficit simply does not persist (raw events remain for audit).
  const nextCarryMinor = config.allowNegativeBalance
    ? rawAfterCarry - payoutMinor
    : payable - payoutMinor;

  return {
    currency,
    openingCarryMinor,
    periodGrossCreditMinor: grossCredit,
    periodDebitMinor: debit,
    periodNetMinor: periodNet,
    closingPayableMinor: payable,
    payoutMinor,
    nextCarryMinor,
    belowMinimumPayout,
    cappedByMaximum,
    floorApplied: floored.floorApplied,
    suppressedMinor: floored.suppressedMinor,
  };
}

/** Money helper for reporting surfaces (keeps bigint out of components). */
export function asMoney(minor: bigint, currency: string): Money {
  return money(minor, currency);
}

/**
 * Specificity ladder (spec §30): GLOBAL -> SPORT -> GROUP -> AFFILIATE -> CAMPAIGN.
 * Layers are applied from least to most specific, so the MOST SPECIFIC valid
 * configuration always wins.
 */
export const CONFIG_SCOPE_APPLICATION_ORDER: readonly string[] = ['GLOBAL', 'SPORT', 'GROUP', 'AFFILIATE', 'CAMPAIGN'];
export const CONFIG_SCOPE_PRECEDENCE: readonly string[] = [...CONFIG_SCOPE_APPLICATION_ORDER].reverse();

export function resolveEffectiveConfig(
  globalCfg: CommissionConfig,
  layers: { scope: string; config: Partial<CommissionConfig> }[],
): { config: CommissionConfig; source: string } {
  let current = globalCfg;
  let source = 'GLOBAL';
  for (const scope of CONFIG_SCOPE_APPLICATION_ORDER) {
    const layer = layers.find((l) => l.scope === scope);
    if (!layer) continue;
    current = { ...current, ...layer.config } as CommissionConfig;
    source = scope;
  }
  return { config: current, source };
}
