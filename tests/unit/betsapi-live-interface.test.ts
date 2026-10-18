import { describe, expect, it, vi } from 'vitest';
import { formatBetsApiOdds } from '@/lib/betsapi-odds-display';
import { betsApiTeamImageUrl, parseExplorerFixture, listBetsApiLeagues, exploreBetsApi } from '@/providers/betsapi-explorer';
import { sourceMatch } from '@/server/betsapi-feed';

describe('BetsAPI mobile sports display', () => {
  it('removes decimal zeros while preserving source precision for settlement', () => {
    expect(formatBetsApiOdds('2.1000')).toBe('2.1');
    expect(formatBetsApiOdds('1.2500')).toBe('1.25');
    expect(formatBetsApiOdds('5.3000')).toBe('5.3');
    expect(formatBetsApiOdds('3.0000')).toBe('3');
    expect(formatBetsApiOdds('1.1429')).toBe('1.14');
    expect(formatBetsApiOdds('1.0050')).toBe('1.005');
    expect(formatBetsApiOdds('0')).toBe('—');
    expect(formatBetsApiOdds('Infinity')).toBe('—');
  });

  it('only builds team badge URLs from a real image_id (never from an unrelated Bet365 team ID)', () => {
    expect(betsApiTeamImageUrl({ id: '99881' })).toBeNull();
    expect(betsApiTeamImageUrl({ id: '99881', image_id: '18734' }))
      .toBe('https://assets.b365api.com/images/team/m/18734.png');
    expect(betsApiTeamImageUrl({ image_id: '../test' })).toBeNull();
  });

  it('keeps vendor league identifiers separate from internal UUIDs and attaches source logos', () => {
    const f = parseExplorerFixture({
      id: '203012312', league: { id: '825', name: 'Italian Serie A', cc: 'it' },
      home: { name: 'Home Team', image_id: '100' },
      away: { name: 'Away Team', image_id: '101' }, time: '1792242000',
    }, 1);
    expect(f?.leagueId).toBe('825');
    expect(f?.homeLogoUrl).toContain('/images/team/m/100.png');
    expect(f?.awayLogoUrl).toContain('/images/team/m/101.png');
    const m = sourceMatch(f!, 'football', 'upcoming');
    expect(m.leagueId).toBeNull();
    expect(m.participants[0]?.logoUrl).toContain('100.png');
    expect(m.isBettingAvailable).toBe(false);
  });

  it('filters every upcoming page using bookmaker league_id, never old provider league UUIDs', async () => {
    const fn = vi.fn(async (input: RequestInfo | URL) => {
      const p = new URL(String(input));
      expect(p.pathname).toBe('/v1/bet365/upcoming');
      expect(p.searchParams.get('league_id')).toBe('825');
      expect(p.searchParams.get('page')).toBe('3');
      return new Response(JSON.stringify({ success: 1, results: [], pager: { page: 3, total: 10 } }));
    });
    const res = await exploreBetsApi('MOCK_PRIVATE_TOKEN', { sportId: 1, mode: 'upcoming', page: 3, leagueId: '825' }, fn as typeof fetch);
    expect(res.error).toBeNull();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('loads real bookmaker league directory rather than only page-one fixtures', async () => {
    const fn = vi.fn(async (input: RequestInfo | URL) => {
      const p = new URL(String(input));
      expect(p.pathname).toBe('/v1/bet365/league');
      return new Response(JSON.stringify({ success: 1, results: [
        { id: '825', name: 'Serie A', cc: 'it' },
        { id: '825', name: 'Serie A', cc: 'it' },
        { id: '1044', name: 'Türkiye Süper Lig', cc: 'tr' },
      ] }));
    });
    const res = await listBetsApiLeagues('MOCK_PRIVATE_TOKEN', 1, fn as typeof fetch);
    expect(res.error).toBeNull();
    expect(res.leagues.map(x => x.id)).toEqual(['825','1044']);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
