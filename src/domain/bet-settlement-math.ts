/**
 * NOVA - BET SETTLEMENT MATH (pure, deterministic)
 *
 * Single source of truth for turning graded legs into a payout. Used by:
 *   - src/domain/settlement-engine.ts (server worker)
 *   - SQL nova.settle_bet (must match this exact formula - see docs/SETTLEMENT.md)
 *   - tests/unit/settlement-math.test.ts (exhaustive table)
 *
 * FORMULA (exact rational arithmetic; ONE rounding at the very end)
 *   multiplier = Π f(leg)
 *      WON        -> f = odds_i                     (num = odds_i, den = ODDS_SCALE)
 *      HALF_WON   -> f = (odds_i + 1) / 2           (half stake at full odds, half at 1.00)
 *      VOID       -> f = 1                          (leg removed, stake portion returned)
 *      HALF_LOST  -> f = 1/2                        (half stake lost, half returned at 1.00)
 *      LOST       -> payout = 0 (the whole accumulator is lost)
 *   payout = roundDiv(stake * Π num, Π den, HALF_UP)
 *
 * A fully-void single therefore returns exactly the stake (multiplier 1),
 * and a void leg in an accumulator recomputes the odds from the remaining legs.
 */
import { money, roundDiv, type Money } from './money';
import { ODDS_SCALE, type OddsScaled } from './odds';
import type { BetStatus, LegGrade } from './types';
import { DomainError } from './errors';

export interface GradedLegInput {
  selectionId: string;
  grade: LegGrade;
  odds: OddsScaled;
}

export interface PayoutComputation {
  /** Amount to credit to the wallet (0 = nothing to credit). */
  payout: Money;
  multiplierNum: bigint;
  multiplierDen: bigint;
  /** Wallet transaction type the settlement engine must post. */
  creditType: 'win_credit' | 'void_refund' | 'none';
  /** Net user result (payout - stake), signed. Basis for affiliate commission. */
  netUserResult: Money;
  /** Bet-level status derived from the legs. */
  status: BetStatus;
  /** Any leg requiring an operator decision. */
  requiresManualReview: boolean;
  manualReviewReason: string | null;
  /** True when every leg is void: the bet is a pure stake refund. */
  allVoid: boolean;
}

export function multiply(num: bigint, den: bigint, next: { num: bigint; den: bigint }): { num: bigint; den: bigint } {
  return { num: num * next.num, den: den * next.den };
}

export function legFactor(grade: LegGrade, odds: OddsScaled): { num: bigint; den: bigint } | null {
  switch (grade) {
    case 'WON':
      return { num: odds, den: ODDS_SCALE };
    case 'HALF_WON':
      return { num: odds + ODDS_SCALE, den: 2n * ODDS_SCALE };
    case 'VOID':
      return { num: 1n, den: 1n };
    case 'HALF_LOST':
      return { num: 1n, den: 2n };
    case 'LOST':
      return null; // terminal
    default:
      return null;
  }
}

/**
 * Compute the payout and derived status.
 * Throws on an empty leg list or an adverse grade mix - the caller must reject those.
 */
export function computeBetPayout(input: {
  stake: Money;
  legs: readonly GradedLegInput[];
}): PayoutComputation {
  const { stake, legs } = input;
  if (legs.length === 0) throw new DomainError('BETSLIP_EMPTY', 'A bet must have at least one leg');
  if (stake.amount <= 0n) throw new DomainError('VALIDATION_ERROR', 'Stake must be positive');

  const currency = stake.currency;
  const pendingLegs = legs.filter((l) => l.grade === 'PENDING');
  const reviewLegs = legs.filter((l) => l.grade === 'MANUAL_REVIEW');
  if (pendingLegs.length > 0) {
    throw new DomainError('INVALID_STATE_TRANSITION', 'Cannot settle a bet with pending legs');
  }
  if (reviewLegs.length > 0) {
    // Partial settlement of the resolved legs is intentionally NOT automatic: a manual
    // review must produce an operator decision before money moves (docs/SETTLEMENT.md).
    return {
      payout: money(0n, currency),
      multiplierNum: 0n,
      multiplierDen: 1n,
      creditType: 'none',
      netUserResult: money(0n, currency),
      status: 'manual_review',
      requiresManualReview: true,
      manualReviewReason: `LEGS_REQUIRE_REVIEW:${reviewLegs.map((l) => l.selectionId).join(',')}`,
      allVoid: false,
    };
  }

  const lostLegs = legs.filter((l) => l.grade === 'LOST');
  const voidLegs = legs.filter((l) => l.grade === 'VOID');
  const allVoid = voidLegs.length === legs.length;

  if (lostLegs.length > 0) {
    const payout = money(0n, currency);
    return {
      payout,
      multiplierNum: 0n,
      multiplierDen: 1n,
      creditType: 'none',
      netUserResult: money(-stake.amount, currency),
      status: voidLegs.length > 0 ? 'settled' : 'settled',
      requiresManualReview: false,
      manualReviewReason: null,
      allVoid: false,
    };
  }

  let num = 1n;
  let den = 1n;
  for (const leg of legs) {
    // LOST already handled above.
    const factor = legFactor(leg.grade === 'PENDING' ? 'VOID' : leg.grade, leg.odds);
    if (!factor) throw new DomainError('INVALID_STATE_TRANSITION', `Unexpected grade mixture for leg ${leg.selectionId}`);
    num *= factor.num;
    den *= factor.den;
  }

  const payoutMinor = roundDiv(stake.amount * num, den, 'HALF_UP');
  const payout = money(payoutMinor, currency);
  const netUserResult = money(payoutMinor - stake.amount, currency);

  let status: BetStatus;
  if (allVoid) status = 'void';
  else if (legs.some((l) => l.grade === 'HALF_WON' || l.grade === 'HALF_LOST')) status = 'partially_settled';
  else status = 'settled';

  const creditType: PayoutComputation['creditType'] =
    payoutMinor === 0n ? 'none' : allVoid ? 'void_refund' : 'win_credit';

  return {
    payout,
    multiplierNum: num,
    multiplierDen: den,
    creditType,
    netUserResult,
    status,
    requiresManualReview: false,
    manualReviewReason: null,
    allVoid,
  };
}

/**
 * Payout of a bet given the authoritative legs' odds at placement.
 * Never uses client-submitted odds or payouts (rules 24/25).
 */
export function payoutFromBet(
  stake: Money,
  legs: readonly { oddsAtPlacement: OddsScaled; grade: LegGrade; selectionId: string }[],
): PayoutComputation {
  return computeBetPayout({ stake, legs: legs.map((l) => ({ selectionId: l.selectionId, grade: l.grade, odds: l.oddsAtPlacement })) });
}

/** Accumulated multiplier as a rounded decimal, for display/audit only. */
export function multiplierToDecimal(num: bigint, den: bigint): string {
  const scaled = roundDiv(num * 10_000n, den, 'HALF_UP');
  const int = scaled / 10_000n;
  const frac = (scaled % 10_000n).toString().padStart(4, '0').replace(/0+$/, '');
  return frac.length ? `${int}.${frac}` : `${int}.0`;
}
