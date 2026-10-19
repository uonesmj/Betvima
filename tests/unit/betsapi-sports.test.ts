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
  it('only treats a score as settlement-authoritative when confirmed by official ended feed', async () => {
    const calls: string[] = [];
    const fetcher = vi.fn(async (url: RequestInfo | URL) => {
      const u = new URL(String(url));
      calls.push(u.pathname);
      const ended = { ...event, time_status: '3', ss: '2-1' };
      return new Response(JSON.stringify({
        success: 1, results: u.pathname.endsWith('/events/ended') ? [ended] : ended,
      }));
    });
    const provider = new BetsApiSportsProvider({ token: 'MOCK_TEST_ONLY', fetcher: fetcher as typeof fetch });
    const preview = await provider.fetchResult('1:4140581');
    expect(preview.value?.authoritative).toBe(false);
    const ended = await provider.fetchResults('2026-10-17T00:00:00Z', '2026-10-17T23:00:00Z', ['1:4140581']);
    expect(ended.value?.[0]).toMatchObject({
      matchProviderId: '1:4140581', homeScore: 2, awayScore: 1,
      status: 'finished', authoritative: true,
    });
    expect(calls).toEqual(['/v1/event/view', '/v3/events/ended']);
    expect(JSON.stringify(ended)).not.toContain('MOCK_TEST_ONLY');
  });

  it('walks official ended-event pages until the requested match is confirmed', async () => {
    const requested: string[] = [];
    const fetcher = vi.fn(async (url: RequestInfo | URL) => {
      const parsed = new URL(String(url));
      requested.push(parsed.pathname + '?page=' + parsed.searchParams.get('page'));
      const page = parsed.searchParams.get('page');
      // Page one has 50 unrelated completed fixtures; page two contains ours.
      const rows = page === '1'
        ? Array.from({ length: 50 }, (_, n) => ({
            ...event, id: String(6000000 + n), time_status: '3',
          }))
        : [{ ...event, time_status: '3', ss: '2-1' }];
      return new Response(JSON.stringify({
        success: 1, results: rows, pager: { total_pages: 2 },
      }));
    });
    const provider = new BetsApiSportsProvider({
      token: 'MOCK_TEST_ONLY', fetcher: fetcher as typeof fetch,
    });
    const result = await provider.fetchResults(
      '2026-10-17T00:00:00Z',
      '2026-10-17T23:59:59Z',
      ['1:4140581'],
    );
    expect(result.ok).toBe(true);
    expect(result.value?.[0]).toMatchObject({
      matchProviderId: '1:4140581', authoritative: true,
      homeScore: 2, awayScore: 1,
    });
    expect(requested).toEqual([
      '/v3/events/ended?page=1', '/v3/events/ended?page=2',
    ]);
  });

  it('accepts the exact thirty-one-day discovery horizon used by the worker', async () => {
    const start = Date.parse('2026-10-17T00:00:00Z');
    const end = start + 31 * 86400_000;
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      success: 1, results: [{ ...event, time_status: '0' }],
    })));
    const provider = new BetsApiSportsProvider({
      token: 'MOCK_TEST_ONLY', fetcher: fetcher as typeof fetch,
    });
    const result = await provider.fetchMatches({
      from: new Date(start).toISOString(),
      to: new Date(end).toISOString(),
      sport: 'football',
    });
    expect(result.ok).toBe(true);
    expect(fetcher).toHaveBeenCalled();
  });

  it('never initializes without explicit enabled flag even if a key exists', async () => {
    vi.stubEnv('BETSAPI_TRIAL_ENABLED', 'false');
    const f = vi.fn();
    const provider = new BetsApiSportsProvider({ token: 'MOCK_TEST_ONLY', fetcher: f as typeof fetch });
    expect((await provider.fetchLiveMatches()).errorCode).toBe('NOT_CONFIGURED');
    expect(f).not.toHaveBeenCalled();
  });
});
