import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ProviderMatch } from '@/lib/ports/providers';
import type { FiveDollarFootballApiSportsProvider } from '@/providers/5dollar-football-api';
import { FiveDollarLiveDataProvider } from '@/providers/5dollar-live-data';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

const fixture: ProviderMatch = {
  providerId: 'fixture-17',
  sport: 'football',
  leagueProviderId: 'league-a',
  leagueName: 'Example League',
  countryCode: 'GB',
  homeTeamName: 'Home Town',
  awayTeamName: 'Away Town',
  homeTeamProviderId: '12',
  awayTeamProviderId: '13',
  scheduledAt: '2026-10-13T20:00:00Z',
  status: 'live',
  homeScore: 2,
  awayScore: 1,
  minute: 71,
  period: '2H',
  liveEvents: [{ id: 'g1', type: 'goal', minute: 71, team: 'home', player_name: 'Player A' }],
  liveStats: {
    shots_on_target: { home: 6, away: 4 },
    corners: { home: 3, away: 2 },
    cards: { home: { yellow: 2, red: 0 }, away: { yellow: 1, red: 0 } },
  },
};

describe('FiveDollar football-only display statistics', () => {
  it('does not touch bookmaker pricing for fixture, events or statistics', async () => {
    const fetchOdds = vi.fn();
    const fetchEventOdds = vi.fn();
    const fetchLiveMatches = vi.fn().mockResolvedValue({ ok: true, value: [fixture] });
    const fetchFixture = vi.fn().mockResolvedValue({ ok: true, value: fixture });
    const provider = {
      configured: true,
      fetchLiveMatches,
      fetchFixture,
      fetchOdds,
      fetchEventOdds,
      health: vi.fn().mockResolvedValue({ provider: '5dollarfootballapi', reachable: true }),
    } as unknown as FiveDollarFootballApiSportsProvider;
    const stats = new FiveDollarLiveDataProvider(provider);
    const live = await stats.fetchLiveFixtures();
    const events = await stats.fetchEvents('fixture-17');
    const details = await stats.fetchStatistics('fixture-17');

    expect(live.value?.[0]).toMatchObject({ homeScore: 2, awayScore: 1, minute: 71 });
    expect(events.value?.[0]).toMatchObject({ type: 'goal', playerName: 'Player A', minute: 71 });
    expect(details.value?.teams[0]?.statistics).toEqual(expect.arrayContaining([
      { type: 'shots_on_target', value: 6 },
      { type: 'corners', value: 3 },
      { type: 'cards_yellow', value: 2 },
    ]));
    expect(fetchLiveMatches).toHaveBeenCalledWith('football');
    expect(fetchOdds).not.toHaveBeenCalled();
    expect(fetchEventOdds).not.toHaveBeenCalled();
  });

  it('refuses requests to 5Dollar odds endpoints at the provider adapter itself', async () => {
    vi.stubEnv('FIVEDOLLAR_API_KEY', 'testing-key');
    const { FiveDollarFootballApiSportsProvider } = await import('@/providers/5dollar-football-api');
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const provider = new FiveDollarFootballApiSportsProvider();
    expect(await provider.fetchOdds(['fixture-17'])).toMatchObject({
      ok: false, errorCode: 'ODDS_NOT_SUPPORTED',
    });
    expect(await provider.fetchEventOdds(['fixture-17'])).toMatchObject({
      ok: false, errorCode: 'ODDS_NOT_SUPPORTED',
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
