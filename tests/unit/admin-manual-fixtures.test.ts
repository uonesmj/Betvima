import { beforeEach, describe, expect, it, vi } from 'vitest';

const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('@/server/db', () => ({ getDb: () => ({ query }) }));

import { readManualFixtures } from '@/server/manual-fixtures';

describe('manually-entered upcoming fixtures', () => {
  beforeEach(() => query.mockReset());

  it('exposes catalogue-only records without a price, market, or provider event identifier', async () => {
    query.mockResolvedValueOnce([{
      id: '11111111-1111-4111-8111-111111111111',
      sport: 'football',
      league: 'Test League',
      home: 'Home FC',
      away: 'Away FC',
      scheduled_at: '2026-12-01T14:00:00Z',
    }]).mockResolvedValueOnce([]);

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
    expect(result[0]?.participants.map(p => p.name)).toEqual(['Home FC', 'Away FC']);
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
      query.mockResolvedValue(null); // Malformed read result must degrade safely.
      expect(await readManualFixtures('football')).toEqual([]);
      expect(warning).toHaveBeenCalled();
    } finally {
      warning.mockRestore();
    }
  });

  it('keeps manual odds preview suspended and separate from wager-grade identities',async()=>{
    query.mockResolvedValueOnce([{
      id:'11111111-1111-4111-8111-111111111111',sport:'football',league:'Iran',
      home:'Esteghlal',away:'Persepolis',scheduled_at:'2026-12-01T14:00:00Z',
    }]).mockResolvedValueOnce([{
      fixture_id:'11111111-1111-4111-8111-111111111111',
      id:'22222222-2222-4222-8222-222222222222',
      market_key:'h2h',title:'Fulltime',version:2,
      selections:[{label:'1',decimal:'2.10'},{label:'X',decimal:'3.25'},{label:'2',decimal:'4.00'}],
    }]);
    const games=await readManualFixtures('football');
    expect(games[0]?.marketsCount).toBe(1);
    expect(games[0]?.isBettingAvailable).toBe(false);
    expect(games[0]?.topMarkets[0]?.id.startsWith('manual-preview:')).toBe(true);
    expect(games[0]?.topMarkets[0]?.status).toBe('suspended');
    expect(games[0]?.topMarkets[0]?.selections.map(s=>s.oddsScaled))
      .toEqual(['21000','32500','40000']);
    expect(games[0]?.topMarkets[0]?.selections.every(s=>s.status==='suspended')).toBe(true);
  });
  it('preserves fixtures while market-preview table is being deployed',async()=>{
    const warning=vi.spyOn(console,'warn').mockImplementation(()=>{});
    try {
      query.mockResolvedValueOnce([{
        id:'11111111-1111-4111-8111-111111111111',
        sport:'football',league:'Test',home:'Home',away:'Away',
        scheduled_at:'2026-12-01T14:00:00Z',
      }]).mockRejectedValueOnce(new Error('relation does not exist'));
      const games=await readManualFixtures('football');
      expect(games).toHaveLength(1);
      expect(games[0]?.topMarkets).toEqual([]);
    }finally{warning.mockRestore();}
  });
});
