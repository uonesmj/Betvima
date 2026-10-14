import { describe, expect, it, vi } from 'vitest';
import { PostgresCatalogRepository } from '@/server/adapters/postgres/catalog';
import type { Db } from '@/lib/ports/db';

describe('catalog live availability', () => {
  it.each(['live', 'in_play', 'paused', 'break', 'halftime', 'extra_time', 'penalties'])('treats %s as live despite an old market flag', async (status) => {
    const query = vi.fn().mockResolvedValue([{ id: 'selection-test', market_id: 'market-test', match_id: 'match-test', is_live: false, match_status: status, scheduled_at: '2026-10-12T10:00:00Z', odds_scaled: '20000' }]);
    const catalog = new PostgresCatalogRepository({ query } as unknown as Db);
    const [selection] = await catalog.getSelectionsForPlacement('match-test', ['selection-test']);
    expect(selection?.isLive).toBe(true);
  });

  it('keeps a genuinely scheduled match in Prematch mode', async () => {
    const query = vi.fn().mockResolvedValue([{ id: 'selection-test', market_id: 'market-test', match_id: 'match-test', is_live: false, match_status: 'scheduled', scheduled_at: '2026-10-12T10:00:00Z', odds_scaled: '20000' }]);
    const catalog = new PostgresCatalogRepository({ query } as unknown as Db);
    const [selection] = await catalog.getSelectionsForPlacement('match-test', ['selection-test']);
    expect(selection?.isLive).toBe(false);
  });

  it('only lists events from The Odds API', async () => {
    const query = vi.fn().mockResolvedValue([]);
    const catalog = new PostgresCatalogRepository({ query } as unknown as Db);
    await catalog.listLiveMatches({ userId: null, role: 'anon' }, 100);
    await catalog.listLiveSportCounts({ userId: null, role: 'anon' });
    expect(query).toHaveBeenCalledTimes(2);
    for (const call of query.mock.calls) {
      expect(call[0]).toContain("m.provider = 'the_odds_api'");
      expect(call[0]).not.toContain("5dollarfootballapi");
    }
  });

  it('does not expose an empty top market after freshness filtering', async () => {
    const query = vi.fn().mockResolvedValueOnce([{ id: 'match-test', status: 'live', sport_slug: 'football', scheduled_at: '2026-10-12T10:00:00Z' }])
      .mockResolvedValueOnce([{ id: 'market-test', match_id: 'match-test', key: 'h2h', status: 'open', selection_id: null }]);
    const catalog = new PostgresCatalogRepository({ query } as unknown as Db);
    const [match] = await catalog.listLiveMatches({ userId: null, role: 'anon' }, 5);
    expect(match?.topMarkets).toBeUndefined();
    // SQL contract: the match state, not only the market flag, selects the
    // existing 45s/300s limits. Real query execution is checked read-only separately.
    expect(query.mock.calls[1]![0]).toContain('fixture.status::text = any($2::text[])');
    expect(query.mock.calls[1]![0]).toContain("interval '45 seconds'");
    expect(query.mock.calls[1]![0]).toContain("interval '300 seconds'");
    expect(query.mock.calls[1]![0]).toContain("sel.provider = 'the_odds_api'");

  });
  it('selects Top Bets from fresh open prematch odds, not stale high-ranked fixtures', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce([{
        id: 'match-test', status: 'scheduled', sport_slug: 'football',
        scheduled_at: '2026-10-15T19:00:00Z', markets_count: 5,
      }])
      .mockResolvedValueOnce([{
        id: 'market-test', match_id: 'match-test', key: 'h2h', status: 'open',
        selection_id: 'selection-test', selection_market_id: 'market-test',
        selection_status: 'open', selection_code: 'home', selection_name: 'Home',
        selection_odds_scaled: '20000', selection_odds_version: 1,
      }]);
    const catalog = new PostgresCatalogRepository({ query } as unknown as Db);
    const result = await catalog.listTopBetMatches({ userId: null, role: 'anon' }, 168, 6);
    expect(result).toHaveLength(1);
    expect(result[0]?.topMarkets?.[0]?.selections[0]?.id).toBe('selection-test');
    const [sql, args] = query.mock.calls[0]!;
    expect(sql).toContain("m.provider = 'the_odds_api'");
    expect(sql).toContain("s.slug <> 'esports'");
    expect(sql).toContain("mk.status = 'open'");
    expect(sql).toContain("sel.status = 'open'");
    expect(sql).toContain("sel.odds_updated_at >= now() - interval '300 seconds'");
    expect(args).toEqual([168, 100]);
  });

  it('excludes a top bet when odds expire between discovery and hydration', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce([{
        id: 'match-test', status: 'scheduled', sport_slug: 'football',
        scheduled_at: '2026-10-15T19:00:00Z',
      }])
      .mockResolvedValueOnce([{ id: 'market-test', match_id: 'match-test', key: 'h2h', status: 'open', selection_id: null }]);
    const catalog = new PostgresCatalogRepository({ query } as unknown as Db);
    const result = await catalog.listTopBetMatches({ userId: null, role: 'anon' }, 168, 6);
    expect(result).toEqual([]);
  });

});
