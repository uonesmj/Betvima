import { beforeEach, describe, expect, it, vi } from 'vitest';

const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('@/server/db', () => ({ getDb: () => ({ query }) }));

import { readManualFixtures } from '@/server/manual-fixtures';

describe('manually-entered upcoming fixtures', () => {
  beforeEach(() => query.mockReset());

  it('exposes catalogue-only records without a price, market, or provider event identifier', async () => {
    query.mockResolvedValue([{
      id: '11111111-1111-4111-8111-111111111111',
      sport: 'football',
      league: 'Test League',
      home: 'Home FC',
      away: 'Away FC',
      scheduled_at: '2026-12-01T14:00:00Z',
    }]);

    const result = await readManualFixtures('football', 25);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'manual:11111111-1111-4111-8111-111111111111',
      betsApiEventId: null,
      sportKey: 'football',
      leagueName: 'Test League',
      isBettingAvailable: false,
      isLive: false,
      marketsCount: 0,
      topMarkets: [],
    });
    expect(result[0].participants.map(p => p.name)).toEqual(['Home FC', 'Away FC']);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("where status='scheduled'"),
      ['football'],
    );
  });

  it('limits catalogue reads without interpolating arbitrary user-supplied counts', async () => {
    query.mockResolvedValue([]);
    await readManualFixtures('football', 1000);
    const sql = query.mock.calls[0]?.[0] as string;
    expect(sql).toMatch(/limit 40$/);
    expect(query.mock.calls[0]?.[1]).toEqual(['football']);
  });

  it('does not fail the public fixtures feed when the private manual catalogue is unavailable', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      query.mockRejectedValue(new Error('database temporarily unavailable'));
      expect(await readManualFixtures('football')).toEqual([]);
      expect(warning).toHaveBeenCalled();
    } finally {
      warning.mockRestore();
    }
  });
});
