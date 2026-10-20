import { describe, expect, it } from 'vitest';
import { resolveBetsapiHourlyBudget } from '@/providers/betsapi-hourly-budget';
import {
  betsapiLivePollIntervalMs,
  betsapiLiveCoveragePlan,
  selectBetsapiLiveCandidates,
  BETSAPI_EXPLORATION_INTERVAL_MS,
  BETSAPI_EMPTY_PRICE_ROTATE_AFTER,
  BETSAPI_EMPTY_PRICE_COOLDOWN_MS,
  betsapiNoQuoteProbe,
} from '@/workers/betsapi-live-trial-budget';

describe('BetsAPI trial live polling', () => {
  it('reserves request headroom and never polls the provider every five seconds', () => {
    expect(betsapiLivePollIntervalMs('200')).toBe(30_000);
    expect(betsapiLivePollIntervalMs('120')).toBe(Math.ceil(3_600_000 / 70));
    expect(betsapiLivePollIntervalMs('80')).toBe(120_000);
    expect(betsapiLivePollIntervalMs(undefined)).toBe(30_000);
    expect(betsapiLivePollIntervalMs('3000')).toBe(25_000);
  });

  it('never raises trial coverage without explicit verified quota configuration', () => {
    expect(betsapiLiveCoveragePlan(undefined)).toMatchObject({
      pricedSlots: 1, intervalMs: 30_000, hourlyBudget: 200,
    });
    expect(betsapiLiveCoveragePlan('200')).toMatchObject({
      pricedSlots: 1, intervalMs: 30_000, explorationIntervalMs: 180_000,
    });
    expect(betsapiLiveCoveragePlan('599').pricedSlots).toBe(1);
    expect(betsapiLiveCoveragePlan('600')).toMatchObject({
      pricedSlots: 2, intervalMs: 25_000,
    });
    expect(betsapiLiveCoveragePlan('1800')).toMatchObject({
      pricedSlots: 8, intervalMs: 25_000, explorationIntervalMs: 60_000,
    });
    expect(betsapiLiveCoveragePlan('199999').pricedSlots).toBe(16);
    expect(betsapiLiveCoveragePlan('999999999').hourlyBudget).toBe(199_999);
  });

  it('keeps an already priced cohort sticky across DB recency reordering', () => {
    const priced = [
      { provider_id: '1:oldest', has_betsapi_market: true },
      { provider_id: '1:current-2', has_betsapi_market: true },
      { provider_id: '1:current-1', has_betsapi_market: true },
      { provider_id: '1:next', has_betsapi_market: true },
      { provider_id: '1:unpriced', has_betsapi_market: false },
    ];
    const sticky = ['1:current-1', '1:current-2'];
    expect(selectBetsapiLiveCandidates(
      priced, 0, false, '1:current-1', new Set(), sticky, 2,
    )).toEqual({
      candidates: [priced[2], priced[1]], explored: false,
    });
    expect(selectBetsapiLiveCandidates(
      priced, 0, false, '1:current-1', new Set(['1:current-1']), sticky, 2,
    )).toEqual({
      candidates: [priced[1], priced[0]], explored: false,
    });
    expect(selectBetsapiLiveCandidates(
      priced, 0, true, '1:current-1', new Set(), sticky, 2,
    )).toEqual({
      candidates: [priced[2], priced[1], priced[4]], explored: true,
    });
  });

  it('explores until a higher-tier cohort fills without exceeding one new event per tick', () => {
    const fixtures = [
      { provider_id: '1:priced', has_betsapi_market: true },
      { provider_id: '1:unpriced-a', has_betsapi_market: false },
      { provider_id: '1:unpriced-b', has_betsapi_market: false },
    ];
    expect(selectBetsapiLiveCandidates(
      fixtures, 1, false, null, new Set(), [], 8,
    )).toEqual({
      candidates: [fixtures[0], fixtures[2]], explored: true,
    });
  });

  it('refreshes priced fixtures before repeatedly querying unpriced fixtures', () => {
    const rows = [
      { id: 'empty-a', has_betsapi_market: false },
      { id: 'priced-a', has_betsapi_market: true },
      { id: 'empty-b', has_betsapi_market: false },
    ];
    expect(selectBetsapiLiveCandidates(rows, 0, false)).toEqual({
      candidates: [rows[1]], explored: false,
    });
    expect(selectBetsapiLiveCandidates(rows, 0, true)).toEqual({
      candidates: [rows[1], rows[0]], explored: true,
    });
    expect(selectBetsapiLiveCandidates(rows, 1, true)).toEqual({
      candidates: [rows[1], rows[2]], explored: true,
    });
    expect(selectBetsapiLiveCandidates(rows, 2, true)).toEqual({
      candidates: [rows[1], rows[0]], explored: true,
    });
    expect(BETSAPI_EXPLORATION_INTERVAL_MS).toBeGreaterThan(60_000);
  });

  it('keeps a previously priced fixture fresh even as older price rows reorder', () => {
    const ordered = [
      { provider_id: '1:a', has_betsapi_market: true },
      { provider_id: '1:b', has_betsapi_market: true },
      { provider_id: '1:c', has_betsapi_market: false },
    ];
    expect(selectBetsapiLiveCandidates(ordered, 0, false, '1:b')).toEqual({
      candidates: [ordered[1]], explored: false,
    });
    expect(selectBetsapiLiveCandidates(ordered, 0, true, '1:b')).toEqual({
      candidates: [ordered[1], ordered[2]], explored: true,
    });
    expect(selectBetsapiLiveCandidates(ordered, 0, false, '1:gone')).toEqual({
      candidates: [ordered[0]], explored: false,
    });
  });

  it('excludes a repeatedly empty priced match and probes other valid fixtures', () => {
    const rows = [
      { provider_id: '1:111', has_betsapi_market: true },
      { provider_id: '1:222', has_betsapi_market: true },
      { provider_id: '1:333', has_betsapi_market: false },
    ];
    const excluded = new Set(['1:111']);
    expect(selectBetsapiLiveCandidates(rows, 0, false, '1:111', excluded)).toEqual({
      candidates: [rows[1]], explored: false,
    });
    expect(selectBetsapiLiveCandidates(rows, 0, true, '1:111', excluded)).toEqual({
      candidates: [rows[1], rows[2]], explored: true,
    });
    expect(selectBetsapiLiveCandidates(rows, 0, false, '1:111', new Set())).toEqual({
      candidates: [rows[0]], explored: false,
    });
  });

  it('never fabricates a fresh quote after empty provider bundles', () => {
    const before = betsapiNoQuoteProbe(0, 0, 100_000);
    expect(before).toEqual({ emptyCount: 1, cooldownUntil: null });
    const second = betsapiNoQuoteProbe(1, 0, 100_000);
    expect(second.cooldownUntil).toBeNull();
    const last = betsapiNoQuoteProbe(2, 0, 100_000);
    expect(BETSAPI_EMPTY_PRICE_ROTATE_AFTER).toBe(3);
    expect(last.cooldownUntil).toBe(100_000 + BETSAPI_EMPTY_PRICE_COOLDOWN_MS);
    expect(betsapiNoQuoteProbe(2, 3, 100_000)).toEqual({
      emptyCount: 0, cooldownUntil: null,
    });
  });

  it('round-robins unpriced fixtures when nothing is priceable', () => {
    const rows = [
      { id: 'a', has_betsapi_market: false },
      { id: 'b', has_betsapi_market: false },
      { id: 'c', has_betsapi_market: false },
    ];
    expect([0, 1, 2].map(i =>
      selectBetsapiLiveCandidates(rows, i, false).candidates[0]?.id
    )).toEqual(['a', 'b', 'c']);
    expect(selectBetsapiLiveCandidates([], 0, true)).toEqual({
      candidates: [], explored: false,
    });
  });
});

describe('BetsAPI shared per-process request cap', () => {
  it('matches the worker planner and defaults to the conservative trial budget', () => {
    const cases: Array<[string | undefined, number]> = [
      [undefined, 200], ['', 200], ['200', 200], ['50', 50],
      ['600', 600], ['1800', 1800], ['199999', 199999],
      ['999999999', 199999], ['invalid', 200], ['-5', 200],
      ['125.5', 200],
    ];
    for (const [raw, expected] of cases) {
      expect(resolveBetsapiHourlyBudget(raw)).toBe(expected);
      expect(betsapiLiveCoveragePlan(raw).hourlyBudget).toBe(expected);
    }
  });
});
