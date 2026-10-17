import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BetsApiSportsProvider } from '@/providers/betsapi-sports';

const event = {
  id: '4140581', sport_id: '1', time: '1792242000', time_status: '1',
  league: { id: '825', name: 'League One' },
  home: { id: '1', name: 'Home' }, away: { id: '2', name: 'Away' },
  ss: '1-1', timer: { tm: 48 },
};
beforeEach(() => { vi.stubEnv('BETSAPI_TRIAL_ENABLED', 'true'); });
afterEach(() => vi.unstubAllEnvs());

describe('BetsAPI staged sports contract', () => {
  it('discovers independent live fixtures without ever publishing a wager', async () => {
    const paths: string[] = [];
    const fetcher = vi.fn(async (url: RequestInfo | URL) => {
      const u = new URL(String(url));
      expect(u.searchParams.get('token')).toBe('MOCK_TEST_ONLY');
      paths.push(u.pathname);
      return new Response(JSON.stringify({ success: 1, results: [event] }));
    });
    const provider = new BetsApiSportsProvider({ token: 'MOCK_TEST_ONLY', fetcher: fetcher as typeof fetch });
    expect(provider.name).toBe('betsapi');
    expect(provider.configured).toBe(true);
    const r = await provider.fetchLiveMatches('football');
    expect(r.value?.[0]).toMatchObject({
      providerId: '1:4140581', minute: 48, homeScore: 1, awayScore: 1,
    });
    expect(paths).toEqual(['/v3/events/inplay']);
    expect(JSON.stringify(r)).not.toContain('MOCK_TEST_ONLY');
  });
  it('preserves upstream source price age rather than faking a live refresh', async () => {
    const old = Math.floor(Date.now() / 1000) - 180;
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      success: 1,
      results: {
        stats: { odds_update: { '1_1': old } },
        odds: { '1_1': [{ add_time: String(old), home_od: '2.4', draw_od: '3.1', away_od: '3.0' }] },
      },
    })));
    const provider = new BetsApiSportsProvider({ token: 'MOCK_TEST_ONLY', fetcher: fetcher as typeof fetch });
    // An unknown fixture's status is not inferred from the quote timestamp.
    expect((await provider.fetchOdds(['1:4140581'])).errorCode).toBe('BETSAPI_SCHEMA_INVALID');
    expect(fetcher).not.toHaveBeenCalled();
    // First discover it as live, then verify that a 3-minute-old price is stale.
    const live = { ...event, time_status: '1' };
    const mixedFetcher = vi.fn(async (url: RequestInfo | URL) =>
      new Response(JSON.stringify(String(url).includes('/events/inplay')
        ? { success: 1, results: [live] }
        : { success: 1, results: {
          stats: { odds_update: { '1_1': old } },
          odds: { '1_1': [{ add_time: String(old), home_od: '2.4', draw_od: '3.1', away_od: '3.0' }] },
        } })));
    const knownProvider = new BetsApiSportsProvider({ token: 'MOCK_TEST_ONLY', fetcher: mixedFetcher as typeof fetch });
    await knownProvider.fetchLiveMatches('football');
    const r = await knownProvider.fetchOdds(['1:4140581']);
    expect(r.value?.[0]?.markets).toEqual([]);
    expect(mixedFetcher).toHaveBeenCalledTimes(2);
  });
  it('does not retry unauthorized or quota-exhausted requests and refuses unknown source identities', async () => {
    const fetcher = vi.fn(async () => new Response('denied', { status: 403 }));
    const provider = new BetsApiSportsProvider({ token: 'MOCK_TEST_ONLY', fetcher: fetcher as typeof fetch });
    expect((await provider.fetchOdds(['foo:bar'])).errorCode).toBe('BETSAPI_SCHEMA_INVALID');
    // An unknown fixture does not trigger a downstream monetary quote request.
    const result = await provider.fetchOdds(['1:4140581']);
    expect(result).toMatchObject({ ok: false });
    expect(fetcher).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain('MOCK_TEST_ONLY');
  });
  it('never initializes without explicit enabled flag even if a key exists', async () => {
    vi.stubEnv('BETSAPI_TRIAL_ENABLED', 'false');
    const f = vi.fn();
    const provider = new BetsApiSportsProvider({ token: 'MOCK_TEST_ONLY', fetcher: f as typeof fetch });
    expect((await provider.fetchLiveMatches()).errorCode).toBe('NOT_CONFIGURED');
    expect(f).not.toHaveBeenCalled();
  });
});
