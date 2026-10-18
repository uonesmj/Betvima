import { describe, expect, it } from 'vitest';
import { sourceMatch } from '@/server/betsapi-feed';
import { sportsbookMatchHref } from '@/lib/betsapi-links';
import { sportByKey } from '@/lib/betsapi-sports-map';

describe('BetsAPI sole public sports source', () => {
  const f = {
    fi: '202860705', eventId: '13275397', sportId: 1,
    league: 'Brazil U20', country: null, home: 'Home FC', away: 'Away FC',
    kickoff: '2026-10-18T18:00:00.000Z', score: '3-1', minute: null,
    marketStatus: 'not_requested' as const,
  };
  it('namespaces external fixtures, prevents wager placement and keeps verified score', () => {
    const result = sourceMatch(f, 'football', 'live');
    expect(result.id).toBe('betsapi:live:1:202860705');
    expect(result.isBettingAvailable).toBe(false);
    expect(result.topMarkets).toEqual([]);
    expect(result.homeScore).toBe(3);
    expect(result.awayScore).toBe(1);
  });
  it('navigates to a read-only bookmaker event page instead of the local match route', () => {
    expect(sportsbookMatchHref('betsapi:live:1:202860705'))
      .toBe('/event/202860705?mode=live&sportId=1');
    expect(sportsbookMatchHref('betsapi:upcoming:18:203030123'))
      .toBe('/event/203030123?mode=upcoming&sportId=18');
  });
  it('does not treat another provider sport ID as a Bet365 fixture', () => {
    expect(sportByKey('hockey')?.id).toBe(17);
    const result = sourceMatch({ ...f, score: null }, 'football', 'upcoming');
    expect(result.homeScore).toBeNull();
    expect(result.isLive).toBe(false);
  });
});
