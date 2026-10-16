import { describe, expect, it } from 'vitest';
import {
  estimateSlipProbability, outcomePercents,
  type ProbabilityMatch, type ProbabilityPick,
} from '@/lib/betslip-probability';

const odds = (id: string, code: string, price: number) => ({
  id, code, name: code, oddsScaled: String(Math.round(price * 10000)), status: 'open',
});
const h2h = (id: string, prices = [2.2, 3.4, 3.2]) => ({
  id, key: 'h2h', status: 'open',
  selections: [odds('home', 'HOME', prices[0]!), odds('draw', 'DRAW', prices[1]!),
    odds('away', 'AWAY', prices[2]!)],
});
const match = (id: string, status = 'scheduled'): ProbabilityMatch => ({
  matchId: id, status,
  markets: [h2h('match-winner'), {
    id: 'dnb', key: 'draw_no_bet', status: 'open',
    selections: [odds('dnb-home', 'HOME', 1.45), odds('dnb-away', 'AWAY', 2.6)],
  }],
});
const pick = (id: string, marketId = 'match-winner', selectionId = 'home'): ProbabilityPick => ({
  matchId: id, marketId, selectionId,
});

describe('market implied bet-slip probability (display only)', () => {
  it('normalizes the bookmaker overround and never invents push in 1X2', () => {
    const result = estimateSlipProbability([pick('m1')], { m1: match('m1') });
    expect(result).not.toBeNull();
    expect(result!.win).toBeGreaterThan(0);
    expect(result!.refund).toBe(0);
    expect(result!.win + result!.lose + result!.refund).toBeCloseTo(1, 10);
    expect(Object.values(outcomePercents(result!)).reduce((a, b) => a + b, 0)).toBe(100);
  });

  it('uses the draw from the matching 1X2 market as DNB refund', () => {
    const result = estimateSlipProbability([pick('m1', 'dnb', 'dnb-home')], { m1: match('m1') });
    const result1x2 = estimateSlipProbability([pick('m1')], { m1: match('m1') });
    expect(result).not.toBeNull();
    expect(result!.refund).toBeGreaterThan(0);
    expect(result!.win).toBeCloseTo(result1x2!.win, 10);
    expect(result!.win + result!.lose + result!.refund).toBeCloseTo(1, 10);
  });

  it('counts void legs as unit odds and refund only if every leg voids', () => {
    const snapshots = { m1: match('m1'), m2: match('m2', 'live') };
    const allDnb = estimateSlipProbability(
      [pick('m1', 'dnb', 'dnb-home'), pick('m2', 'dnb', 'dnb-away')], snapshots,
    );
    const oneNoPush = estimateSlipProbability(
      [pick('m1', 'dnb', 'dnb-home'), pick('m2')], snapshots,
    );
    expect(allDnb!.refund).toBeGreaterThan(0);
    expect(oneNoPush!.refund).toBe(0);
    expect(oneNoPush!.isLive).toBe(true);
    expect(oneNoPush!.win + oneNoPush!.lose + oneNoPush!.refund).toBeCloseTo(1, 10);
  });

  it('fails closed for a missing, suspended or stale outcome', () => {
    expect(estimateSlipProbability([pick('unknown')], {})).toBeNull();
    const disabled = match('m1');
    disabled.markets[0]!.selections[0]!.status = 'suspended';
    expect(estimateSlipProbability([pick('m1')], { m1: disabled })).toBeNull();
    const settled = match('m1', 'finished');
    expect(estimateSlipProbability([pick('m1')], { m1: settled })).toBeNull();
  });

  it('does not guess refunds on unsupported Asian or integer handicaps', () => {
    const m = match('m1');
    m.markets.push({
      id: 'asian', key: 'spreads', status: 'open',
      specifier: '2.0',
      selections: [odds('a', 'HOME', 1.9), odds('b', 'AWAY', 1.9)],
    });
    expect(estimateSlipProbability([pick('m1', 'asian', 'a')], { m1: m })).toBeNull();
  });

  it('responds to updated live market prices without mutating the bet', () => {
    const original = match('m1', 'live');
    const moved = match('m1', 'live');
    moved.markets[0] = h2h('match-winner', [1.5, 4.2, 6.5]);
    const start = estimateSlipProbability([pick('m1')], { m1: original });
    const live = estimateSlipProbability([pick('m1')], { m1: moved });
    expect(live!.isLive).toBe(true);
    expect(live!.win).toBeGreaterThan(start!.win);
    expect(original.markets[0]!.selections[0]!.oddsScaled).toBe('22000');
  });

  it('keeps rounding totals at 100 percent', () => {
    expect(outcomePercents({ win: 1 / 3, lose: 1 / 3, refund: 1 / 3, isLive: false }))
      .toEqual({ win: 34, lose: 33, refund: 33 });
  });
});
