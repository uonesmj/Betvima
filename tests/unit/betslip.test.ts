import { describe, expect, it } from 'vitest';
import {
  BETSLIP_LIMITS, combinedOddsDisplay, findConflicts, findCorrelatedLegs, potentialPayout,
  quickStakeValues, resolveMode, toggleSelection, validateStake, type BetSlipItem,
} from '@/domain/betslip';
import { money } from '@/domain/money';
import { revalidateSelection, isBlocking } from '@/domain/betslip';
import type { Market, MatchStatus, Selection } from '@/domain/types';

const item = (over: Partial<BetSlipItem> = {}): BetSlipItem => ({
  matchId: 'm1', marketId: 'mk1', selectionId: 's1', oddsSeen: 25_000n, oddsVersionSeen: 1,
  label: 'Home', marketLabel: '1X2', matchLabel: 'A vs B', sportSlug: 'football',
  matchStatus: 'scheduled', marketStatus: 'open', selectionStatus: 'open', addedAt: Date.now(),
  ...over,
});

const selection = (over: Partial<Selection> = {}): Selection => ({
  id: 's1', marketId: 'mk1', matchId: 'm1', code: 'HOME', name: 'Home', nameFa: null, line: null,
  participantType: 'HOME', status: 'open', odds: 25_000n, previousOdds: null, oddsVersion: 1,
  oddsUpdatedAt: new Date().toISOString(), provider: 'test', providerTimestamp: null, isStale: false,
  ...over,
});
const market = (over: Partial<Market> = {}): Market => ({
  id: 'mk1', matchId: 'm1', type: '1X2', key: '1X2', name: 'Match Result', nameFa: null, status: 'open',
  specifier: null, period: null, displayOrder: 10, isLive: false, updatedAt: new Date().toISOString(), selections: [],
  ...over,
});

describe('betslip: toggling (UI contract)', () => {
  it('adds a selection, removes it on a second click', () => {
    const added = toggleSelection([], item());
    expect(added.action).toBe('ADDED');
    expect(added.items).toHaveLength(1);
    const removed = toggleSelection(added.items, item());
    expect(removed.action).toBe('REMOVED');
    expect(removed.items).toHaveLength(0);
  });

  it('replaces a selection from the same market (one outcome per market)', () => {
    const result = toggleSelection([item()], item({ selectionId: 's2', label: 'Draw' }));
    expect(result.action).toBe('REPLACED');
    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.selectionId).toBe('s2');
  });

  it('caps the number of selections', () => {
    const many = Array.from({ length: BETSLIP_LIMITS.MAX_SELECTIONS }, (_, i) =>
      item({ marketId: `mk${i}`, selectionId: `s${i}` }));
    const result = toggleSelection(many, item({ marketId: 'mkX', selectionId: 'sX' }));
    expect(result.action).toBe('REJECTED');
    expect(result.items).toHaveLength(BETSLIP_LIMITS.MAX_SELECTIONS);
  });
});

describe('betslip: structural validation', () => {
  it('detects duplicate / conflicting selections', () => {
    expect(findConflicts([item(), item()])).toHaveLength(1);
    expect(findConflicts([item(), item({ selectionId: 's2' })])[0]?.reason).toBe('CONFLICTING_SELECTION_SAME_MARKET');
    expect(findConflicts([item(), item({ marketId: 'mk2', selectionId: 's2' })])).toHaveLength(0);
  });

  it('refuses correlated legs on the same match in one accumulator', () => {
    const items = [
      item({ marketId: 'mk1', selectionId: 's1' }),
      item({ marketId: 'mk2', selectionId: 's2' }),
    ];
    const correlated = findCorrelatedLegs(items, { mk1: '1X2', mk2: 'DOUBLE_CHANCE' });
    expect(correlated[0]?.reason).toContain('CORRELATED_LEGS');
    expect(findCorrelatedLegs(items, { mk1: '1X2', mk2: 'OVER_UNDER' })).toHaveLength(0);
  });

  it('resolves single vs multiple', () => {
    expect(resolveMode('SINGLE', 1)).toBe('SINGLE');
    expect(resolveMode('SINGLE', 3)).toBe('MULTIPLE');
    expect(() => resolveMode('SINGLE', 0)).toThrowError(/BETSLIP_EMPTY/);
    expect(() => resolveMode('SYSTEM', 3)).toThrowError(/System bets are not enabled/);
  });

  it('prices and prints combined odds', () => {
    expect(potentialPayout(money(100_000n, 'IRT'), [25_000n, 20_000n]).amount).toBe(500_000n);
    expect(combinedOddsDisplay([25_000n, 20_000n])).toBe('5.00');
  });

  it('multiplies the full USD stake by odds (not merely quoting the odds as dollars)', () => {
    const stake = money(500n, 'USD'); // $5.00
    const payout = potentialPayout(stake, [46_000n]); // 4.60 decimal odds
    expect(payout.amount).toBe(2_300n); // $23.00 including stake
    expect(payout.amount - stake.amount).toBe(1_800n); // $18.00 net profit
    expect(potentialPayout(money(1_000n, 'USD'), [46_000n]).amount).toBe(4_600n);
  });

  it('rounds accumulator payouts once in minor units, not from rounded display odds', () => {
    const payout = potentialPayout(money(101n, 'USD'), [12_345n, 19_876n]);
    expect(payout.amount).toBe(248n); // $1.01 * 1.2345 * 1.9876 = $2.4779...
  });
});

describe('betslip: stake validation', () => {
  const base = {
    stake: money(100_000n, 'IRT'), wallet: money(1_000_000n, 'IRT'),
    minStake: money(10_000n, 'IRT'), maxStake: money(500_000_000n, 'IRT'),
    maxPayout: money(2_000_000_000n, 'IRT'), potentialPayout: money(250_000n, 'IRT'), hasBetSlipItems: true,
  };

  it('accepts a valid stake', () => {
    expect(validateStake(base).ok).toBe(true);
  });

  it('rejects empty slip, zero, below minimum, above maximum and insufficient balance', () => {
    expect(validateStake({ ...base, hasBetSlipItems: false }).code).toBe('BETSLIP_EMPTY');
    expect(validateStake({ ...base, stake: money(0n, 'IRT') }).code).toBe('VALIDATION_ERROR');
    expect(validateStake({ ...base, stake: money(1_000n, 'IRT') }).code).toBe('STAKE_BELOW_MINIMUM');
    expect(validateStake({ ...base, stake: money(600_000_000n, 'IRT') }).code).toBe('STAKE_ABOVE_MAXIMUM');
    expect(validateStake({ ...base, stake: money(2_000_000n, 'IRT') }).code).toBe('INSUFFICIENT_BALANCE');
  });

  it('enforces the maximum payout ceiling', () => {
    const result = validateStake({ ...base, stake: money(500_000_000n, 'IRT'), potentialPayout: money(3_000_000_000n, 'IRT') });
    expect(result.code).toBe('PAYOUT_ABOVE_MAXIMUM');
  });

  it('suggests a corrected stake instead of silently changing it', () => {
    const result = validateStake({ ...base, stake: money(1_000n, 'IRT') });
    expect(result.suggestedStake?.amount).toBe(10_000n);
  });

  it('offers quick stakes, including the full balance', () => {
    const values = quickStakeValues('IRT', money(777_000n, 'IRT'));
    expect(values.some((v) => v.amount === 777_000n)).toBe(true);
  });
});

describe('betslip: server-side revalidation (odds change is never silent)', () => {
  const now = new Date('2026-01-01T12:00:00Z');
  const input = (odds: bigint, version = 1, updated = now.toISOString(), marketOver: Partial<Market> = {}) => ({
    item: item(),
    authoritative: {
      selection: selection({ odds, oddsVersion: version, oddsUpdatedAt: updated }),
      market: market(marketOver),
      match: { status: 'scheduled' as MatchStatus, scheduledAt: new Date(now.getTime() + 3_600_000).toISOString() },
    },
    now,
    liveFreshnessSeconds: 12,
    prematchFreshnessSeconds: 45,
  });

  it('reports an increase with old and new odds', () => {
    const reports = revalidateSelection(input(30_000n, 2));
    const change = reports.find((r) => r.kind === 'ODDS_CHANGED');
    expect(change?.previousOdds).toBe(25_000n);
    expect(change?.currentOdds).toBe(30_000n);
    expect(change?.direction).toBe('INCREASED');
    expect(reports.every((r) => !isBlocking(r))).toBe(true);
  });

  it('reports a decrease', () => {
    const reports = revalidateSelection(input(20_000n, 2));
    expect(reports.find((r) => r.kind === 'ODDS_CHANGED')?.direction).toBe('DECREASED');
  });

  it('blocks suspended / closed / finished states', () => {
    expect(revalidateSelection(input(25_000n, 1, now.toISOString(), { status: 'suspended' }))[0]?.kind).toBe('MARKET_SUSPENDED');
    expect(revalidateSelection(input(25_000n, 1, now.toISOString(), { status: 'closed' }))[0]?.kind).toBe('MARKET_CLOSED');
    const finished = revalidateSelection({
      ...input(25_000n, 1),
      authoritative: { ...input(25_000n, 1).authoritative, match: { status: 'finished', scheduledAt: now.toISOString() } },
    });
    expect(finished.some((r) => r.kind === 'MATCH_FINISHED' && isBlocking(r))).toBe(true);
  });

  it('blocks suspended selections and stale odds', () => {
    const suspended = revalidateSelection({
      ...input(25_000n, 1),
      authoritative: { ...input(25_000n, 1).authoritative, selection: selection({ status: 'suspended' }) },
    });
    expect(suspended.some((r) => r.kind === 'SELECTION_SUSPENDED')).toBe(true);

    const stale = revalidateSelection(input(25_000n, 1, new Date(now.getTime() - 5 * 60_000).toISOString()));
    expect(stale.some((r) => r.kind === 'STALE_ODDS' && isBlocking(r))).toBe(true);
  });
});
