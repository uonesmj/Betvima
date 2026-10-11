/**
 * NOVA - BETSLIP DOMAIN RULES (pure)
 *
 * UI CONTRACT (enforced in tests, see tests/unit/betslip.test.ts):
 *   - Selecting an odd toggles the slip. Nothing else does.
 *   - Clicking a match card / team / league / score / market title NEVER opens the BetSlip.
 *   - Closing the BetSlip stays closed: `betslipUserClosed` suppresses auto-open until the
 *     user explicitly opens it again or adds a selection.
 *   - A betslip selection always carries the odds the user SAW (oddsSeen) so the server can
 *     detect movement; the server's odds are authoritative at all times.
 */
import { compare, money, roundDiv, sub, type Money } from './money';
import {
  accumulatorNumerator, accumulatorDenominator, oddsToDisplayString, ODDS_SCALE, type OddsScaled,
} from './odds';
import { DomainError } from './errors';
import type {
  BetSlipMode, BetSlipSelectionRequest, MatchStatus, Market, MarketStatus, Selection,
  SelectionStatus, OddsChangeReport, OddsAdjustment,
} from './types';

export interface BetSlipItem extends BetSlipSelectionRequest {
  /** Client-side display cache only. Never authoritative. */
  label: string;
  marketLabel: string;
  matchLabel: string;
  sportSlug: string;
  matchStatus: MatchStatus | null;
  marketStatus: MarketStatus | null;
  selectionStatus: SelectionStatus | null;
  addedAt: number;
}

export const BETSLIP_LIMITS = {
  /** Accumulator leg cap - keeps payout math and UI comprehensible. */
  MAX_SELECTIONS: 20,
  MIN_SELECTIONS_MULTIPLE: 2,
  /** Quick-stake ladder; values are display-only, the server re-validates against risk rules. */
  QUICK_STAKES_MINOR: [10_000n, 50_000n, 100_000n, 500_000n, 1_000_000n] as const,
} as const;

/* ------------------------------------------------------------------ *
 * Selection toggling                                                 *
 * ------------------------------------------------------------------ */

export type ToggleResult =
  | { action: 'ADDED'; items: BetSlipItem[] }
  | { action: 'REMOVED'; items: BetSlipItem[] }
  | { action: 'REPLACED'; items: BetSlipItem[] } // same market, different selection
  | { action: 'REJECTED'; items: BetSlipItem[]; reason: string };

export function toggleSelection(items: readonly BetSlipItem[], incoming: BetSlipItem): ToggleResult {
  const existingIndex = items.findIndex((i) => i.selectionId === incoming.selectionId);
  if (existingIndex >= 0) {
    return { action: 'REMOVED', items: items.filter((_, idx) => idx !== existingIndex) };
  }
  // One selection per market: adding another selection from the same market replaces it.
  const sameMarketIndex = items.findIndex((i) => i.marketId === incoming.marketId);
  if (sameMarketIndex >= 0) {
    const next = items.slice();
    next[sameMarketIndex] = incoming;
    return { action: 'REPLACED', items: next };
  }
  if (items.length >= BETSLIP_LIMITS.MAX_SELECTIONS) {
    return { action: 'REJECTED', items: items.slice(), reason: `MAX_SELECTIONS_${BETSLIP_LIMITS.MAX_SELECTIONS}` };
  }
  return { action: 'ADDED', items: [...items, incoming] };
}

/** Correlated/duplicate-leg guards. Multi-leg conflicts are business rules, not UI rules. */
export function findConflicts(items: readonly BetSlipItem[]): { selectionId: string; reason: string }[] {
  const conflicts: { selectionId: string; reason: string }[] = [];
  const seenSelection = new Set<string>();
  const seenMarket = new Map<string, string>();
  for (const item of items) {
    if (seenSelection.has(item.selectionId)) conflicts.push({ selectionId: item.selectionId, reason: 'DUPLICATE_SELECTION' });
    seenSelection.add(item.selectionId);
    const prev = seenMarket.get(item.marketId);
    if (prev && prev !== item.selectionId) conflicts.push({ selectionId: item.selectionId, reason: 'CONFLICTING_SELECTION_SAME_MARKET' });
    seenMarket.set(item.marketId, item.selectionId);
  }
  return conflicts;
}

/**
 * Correlation guard: two selections on the SAME match inside one accumulator are
 * refused when they belong to correlated market groups (a bookmaker cannot price
 * 1X2 + Double Chance as independent legs). This is a business rule owned by the
 * domain, never by a component.
 */
const CORRELATION_GROUPS: Record<string, string> = {
  '1X2': 'RESULT',
  DOUBLE_CHANCE: 'RESULT',
  DRAW_NO_BET: 'RESULT',
  OVER_UNDER: 'TOTALS',
  TEAM_TOTAL_GOALS: 'TOTALS',
  BTTS: 'BTTS',
  CORRECT_SCORE: 'RESULT',
  HT_FT: 'RESULT',
  HALF_TIME: 'PERIOD_RESULT',
  HANDICAP: 'HANDICAP',
  ASIAN_HANDICAP: 'HANDICAP',
};

export function findCorrelatedLegs(
  items: readonly BetSlipItem[],
  marketTypes: Record<string, string>,
): { matchId: string; reason: string }[] {
  const perMatchGroups = new Map<string, Map<string, string[]>>();
  for (const item of items) {
    const type = marketTypes[item.marketId];
    if (!type) continue;
    const group = CORRELATION_GROUPS[type];
    if (!group) continue;
    const groups = perMatchGroups.get(item.matchId) ?? new Map<string, string[]>();
    const ids = groups.get(group) ?? [];
    ids.push(item.selectionId);
    groups.set(group, ids);
    perMatchGroups.set(item.matchId, groups);
  }
  const out: { matchId: string; reason: string }[] = [];
  for (const [matchId, groups] of perMatchGroups) {
    for (const [group, selectionIds] of groups) {
      if (selectionIds.length > 1) {
        out.push({ matchId, reason: `CORRELATED_LEGS:${group}` });
      }
    }
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Pricing                                                            *
 * ------------------------------------------------------------------ */

/**
 * Combined odds for the slip, exact rational, single rounding on payout.
 * singles -> mode SINGLE; 2+ -> MULTIPLE.
 */
export function resolveMode(mode: BetSlipMode, legCount: number): BetSlipMode {
  if (legCount === 0) throw new DomainError('BETSLIP_EMPTY');
  if (mode === 'SYSTEM') throw new DomainError('VALIDATION_ERROR', 'System bets are not enabled on this deployment');
  if (legCount === 1) return 'SINGLE';
  return 'MULTIPLE';
}

/**
 * Retention as an exact rational.
 *   num = Π odds_scaled          (integer)
 *   den = ODDS_SCALE^(n-1)       (combined-odds denominator, keeps the result)
 * Payout uses ODDS_SCALE^n because every factor is a scaled integer:
 *   payout = round(stake * Π odds_scaled / ODDS_SCALE^n)
 * Using one denominator for both is a classic sportsbook pricing bug - they are
 * deliberately kept separate here.
 */
export function combinedRetention(items: readonly { oddsSeen: OddsScaled }[]): { num: bigint; den: bigint } {
  return {
    num: accumulatorNumerator(items.map((i) => i.oddsSeen)),
    den: accumulatorDenominator(items.length),
  };
}

/** Exact payout rational: Π odds_scaled / ODDS_SCALE^n. */
export function payoutRational(oddsList: readonly OddsScaled[]): { num: bigint; den: bigint } {
  return {
    num: accumulatorNumerator(oddsList),
    den: ODDS_SCALE ** BigInt(oddsList.length),
  };
}

/** Potential payout = stake * combined odds, rounded ONCE (HALF_UP) at the end. */
export function potentialPayout(stake: Money, oddsList: readonly OddsScaled[]): Money {
  const { num, den } = payoutRational(oddsList);
  return money(roundDiv(stake.amount * num, den, 'HALF_UP'), stake.currency);
}

export function combinedOddsDisplay(oddsList: readonly OddsScaled[]): string {
  if (oddsList.length === 0) return '0.00';
  const num = accumulatorNumerator(oddsList);
  const den = accumulatorDenominator(oddsList.length);
  const scaled = (num + den / 2n) / den;
  return oddsToDisplayString(scaled, 2);
}

/* ------------------------------------------------------------------ *
 * Stake validation                                                   *
 * ------------------------------------------------------------------ */

export interface StakeValidationInput {
  stake: Money;
  wallet: Money;
  minStake: Money;
  maxStake: Money;
  /** Potential payout ceiling across the whole slip (risk rule max_payout). */
  maxPayout?: Money | null;
  potentialPayout: Money;
  hasBetSlipItems: boolean;
}

export interface StakeValidationResult {
  ok: boolean;
  code: string | null;
  message: string | null;
  /** Stake after applying a LIMIT decision (never silently applied by the client). */
  suggestedStake: Money | null;
}

export function validateStake(input: StakeValidationInput): StakeValidationResult {
  const { stake, wallet, minStake, maxStake, maxPayout, potentialPayout: payout, hasBetSlipItems } = input;
  if (!hasBetSlipItems) return { ok: false, code: 'BETSLIP_EMPTY', message: 'Add at least one selection', suggestedStake: null };
  if (stake.amount <= 0n) return { ok: false, code: 'VALIDATION_ERROR', message: 'Stake must be greater than zero', suggestedStake: null };
  if (compare(stake, minStake) < 0) {
    return { ok: false, code: 'STAKE_BELOW_MINIMUM', message: `Minimum stake is ${minStake.amount}`, suggestedStake: minStake };
  }
  if (compare(stake, maxStake) > 0) {
    return { ok: false, code: 'STAKE_ABOVE_MAXIMUM', message: `Maximum stake is ${maxStake.amount}`, suggestedStake: maxStake };
  }
  if (maxPayout && compare(payout, maxPayout) > 0) {
    return { ok: false, code: 'PAYOUT_ABOVE_MAXIMUM', message: 'Potential payout exceeds the maximum allowed', suggestedStake: null };
  }
  if (sub(wallet, stake).amount < 0n) {
    return { ok: false, code: 'INSUFFICIENT_BALANCE', message: 'Insufficient balance', suggestedStake: wallet };
  }
  return { ok: true, code: null, message: null, suggestedStake: stake };
}

/* ------------------------------------------------------------------ *
 * Server-side revalidation -> change report                          *
 * ------------------------------------------------------------------ */

export interface RevalidationInput {
  item: BetSlipSelectionRequest;
  authoritative: { selection: Selection; market: Market; match: { status: MatchStatus; scheduledAt: string } };
  now: Date;
  liveFreshnessSeconds: number;
  prematchFreshnessSeconds: number;
}

const LABEL = (s: Selection, m: Market): string => `${m.name} - ${s.name}`;

/**
 * Compares the odds the user saw with the authoritative odds and returns every blocking
 * condition. The client NEVER overwrites odds silently: it must render OLD -> NEW and ask.
 */
export function revalidateSelection(input: RevalidationInput): OddsChangeReport[] {
  const { item, authoritative, now, liveFreshnessSeconds, prematchFreshnessSeconds } = input;
  const { selection, market, match } = authoritative;
  const reports: OddsChangeReport[] = [];
  const base = { selectionId: selection.id, matchId: selection.matchId, marketId: market.id, label: LABEL(selection, market) };

  if (match.status === 'finished' || match.status === 'cancelled' || match.status === 'abandoned') {
    reports.push({ ...base, kind: 'MATCH_FINISHED', previousOdds: item.oddsSeen, currentOdds: null, direction: null, message: 'This match is no longer available for betting' });
  }
  if (match.status === 'postponed' || match.status === 'interrupted') {
    reports.push({ ...base, kind: 'MATCH_POSTPONED', previousOdds: item.oddsSeen, currentOdds: null, direction: null, message: 'This match has been suspended' });
  }
  if (market.status === 'closed' || market.status === 'settled' || market.status === 'void') {
    reports.push({ ...base, kind: 'MARKET_CLOSED', previousOdds: item.oddsSeen, currentOdds: null, direction: null, message: 'This market is closed' });
  } else if (market.status === 'suspended') {
    reports.push({ ...base, kind: 'MARKET_SUSPENDED', previousOdds: item.oddsSeen, currentOdds: null, direction: null, message: 'This market is temporarily suspended' });
  }
  if (selection.status === 'suspended' || selection.status === 'closed' || selection.status === 'settled') {
    reports.push({ ...base, kind: 'SELECTION_SUSPENDED', previousOdds: item.oddsSeen, currentOdds: null, direction: null, message: 'This selection is suspended' });
  }
  const freshnessLimit = market.isLive ? liveFreshnessSeconds : prematchFreshnessSeconds;
  const updatedAt = selection.oddsUpdatedAt ? new Date(selection.oddsUpdatedAt) : null;
  if (!updatedAt) {
    reports.push({ ...base, kind: 'ODDS_MISSING' as never, previousOdds: item.oddsSeen, currentOdds: null, direction: null, message: 'No authoritative odds available for this selection' });
  } else if (now.getTime() - updatedAt.getTime() > freshnessLimit * 1000) {
    reports.push({ ...base, kind: 'STALE_ODDS', previousOdds: item.oddsSeen, currentOdds: selection.odds, direction: null, message: 'Odds feed is stale for this selection' });
  }

  if (selection.oddsVersion !== item.oddsVersionSeen || selection.odds !== item.oddsSeen) {
    const direction = selection.odds > item.oddsSeen ? 'INCREASED' : selection.odds < item.oddsSeen ? 'DECREASED' : 'UNCHANGED';
    reports.push({
      ...base,
      kind: 'ODDS_CHANGED',
      previousOdds: item.oddsSeen,
      currentOdds: selection.odds,
      direction,
      message: `Odds changed from ${oddsToDisplayString(item.oddsSeen)} to ${oddsToDisplayString(selection.odds)}`,
    });
  }
  return reports;
}

export function isBlocking(report: OddsChangeReport): boolean {
  return report.kind !== 'ODDS_CHANGED';
}

export function toAdjustment(item: BetSlipSelectionRequest, current: OddsScaled): OddsAdjustment {
  return {
    selectionId: item.selectionId,
    previousOdds: item.oddsSeen,
    currentOdds: current,
    direction: current > item.oddsSeen ? 'INCREASED' : 'DECREASED',
  };
}

/** Quick-stake helper used by both desktop rail and mobile bottom sheet. */
export function quickStakeValues(currency: string, balance: Money): Money[] {
  const values = BETSLIP_LIMITS.QUICK_STAKES_MINOR.map((v) => money(v, currency));
  const withBalance = compare(balance, money(0n, currency)) > 0 ? [...values, balance] : values;
  return withBalance;
}

export { ODDS_SCALE };
