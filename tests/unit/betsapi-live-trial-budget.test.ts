import { describe, expect, it } from 'vitest';
import {
  betsapiLivePollIntervalMs,
  selectBetsapiLiveCandidates,
  BETSAPI_EXPLORATION_INTERVAL_MS,
} from '@/workers/betsapi-live-trial-budget';

describe('BetsAPI trial live polling', () => {
  it('reserves request headroom and never polls the provider every five seconds', () => {
    expect(betsapiLivePollIntervalMs('200')).toBe(30_000);
    expect(betsapiLivePollIntervalMs('120')).toBe(Math.ceil(3_600_000 / 70));
    expect(betsapiLivePollIntervalMs('80')).toBe(120_000);
    expect(betsapiLivePollIntervalMs(undefined)).toBe(30_000);
    expect(betsapiLivePollIntervalMs('3000')).toBe(30_000);
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
