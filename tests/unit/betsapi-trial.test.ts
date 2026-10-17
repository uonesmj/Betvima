import { describe, expect, it, vi } from 'vitest';
import { runBetsApiTrial } from '@/providers/betsapi-trial';

describe('BetsAPI evaluation adapter', () => {
  it('probes first-party sports and markets without exposing credentials or writing data', async () => {
    const requests: string[] = [];
    const fetcher = vi.fn(async (address: RequestInfo | URL) => {
      const url = new URL(String(address));
      requests.push(url.pathname);
      expect(url.origin).toBe('https://api.b365api.com');
      expect(url.searchParams.get('token')).toBe('TEST_TOKEN_ONLY');
      let payload: unknown = { success: 1, results: [] };
      if (url.pathname.endsWith('inplay')) {
        payload = { success: 1, results: [{
          id: '12345', home: { name: 'Home' }, away: { name: 'Away' },
          timer: { tm: 45 },
        }] };
      }
      if (url.pathname.endsWith('/v2/event/odds')) {
        payload = { success: 1, results: { odds: {
          '1_1': [{ home_od: '2.10', draw_od: '3.00', away_od: '3.50' }],
          '1_2': [{ home_od: '-', away_od: '-' }],
        } } };
      }
      return new Response(JSON.stringify(payload), {
        status: 200, headers: { 'X-RateLimit-Remaining': '3550' },
      });
    });
    const result = await runBetsApiTrial('TEST_TOKEN_ONLY', fetcher as typeof fetch, [{ id: 1, name: 'Football' }]);
    expect(result.mode).toBe('read_only');
    expect(result.sports[0]).toMatchObject({ sport: 'Football', liveFixtures: 1 });
    expect(result.sports[0]?.sample[0]?.minute).toBe(45);
    expect(result.oddsSample[0]).toMatchObject({
      sport: 'Football', eventId: '12345', marketKeys: 2, latestOffers: 1,
      freshMarkets: 0, freshSelections: 0, error: null,
    });
    expect(result.callsInProbe).toBe(5);
    expect(result.bet365.permitted).toBe(true);
    expect(result.bet365.upcomingAccess).toBe('AVAILABLE');
    expect(result.remainingHourlyRequests).toBe(3550);
    expect(requests).toHaveLength(5);
    expect(JSON.stringify(result)).not.toContain('TEST_TOKEN_ONLY');
  });

  it('uses Bet365 FI IDs and samples multiple distinct live fixtures, reporting mixed prices/errors', async () => {
    const observed: string[] = [];
    const sampleFilter = [
      { id: '991', our_event_id: '12345', league: { id: '10' },
        home: { name: 'Matched Home' }, away: { name: 'Matched Away' } },
      { id: '992', our_event_id: '54321', league: { id: '20' },
        home: { name: 'Other Home' }, away: { name: 'Other Away' } },
      { id: '993', league: { id: '30' }, home: { name: 'Third' }, away: { name: 'Fourth' } },
      { id: '994', league: { id: '40' }, home: { name: 'Fifth' }, away: { name: 'Sixth' } },
    ];
    const fetcher = vi.fn(async (address: RequestInfo | URL) => {
      const url = new URL(String(address));
      observed.push(url.pathname + (url.searchParams.get('FI') ? ':FI=' + url.searchParams.get('FI') : ''));
      expect(url.searchParams.get('token')).toBe('PRIVATE_TEST_TOKEN');
      let body: unknown = { success: 1, results: [] };
      if (url.pathname === '/v3/events/inplay') {
        body = { success: 1, results: [{
          id: '12345', sport_id: '1', home: { name: 'Matched Home' },
          away: { name: 'Matched Away' }, bet365_id: '991',
        }] };
      } else if (url.pathname === '/v1/bet365/inplay_filter') {
        body = { success: 1, results: sampleFilter };
      } else if (url.pathname === '/v1/bet365/event') {
        const fi = url.searchParams.get('FI');
        if (fi === '991') {
          body = { success: 1, results: [[
            { type: 'MG', ID: '1777', NA: 'Fulltime Result', SU: '0' },
            { type: 'MA', ID: '1777', NA: 'Fulltime Result', SU: '0' },
            { type: 'PA', ID: '99101', NA: 'Home', OD: '4/5', SU: '0' },
            { type: 'PA', ID: '99102', NA: 'Draw', OD: '9/4', SU: '0' },
          ]] };
        } else if (fi === '992') {
          return new Response(JSON.stringify({ success: 0, error: 'INTERNAL_SERVER_ERROR' }), { status: 500 });
        } else if (fi === '994') {
          body = { success: 0, error: 'PERMISSION_DENIED' };
        }
      }
      return new Response(JSON.stringify(body), { status: 200 });
    });
    const result = await runBetsApiTrial('PRIVATE_TEST_TOKEN', fetcher as typeof fetch,
      [{ id: 1, name: 'Football' }]);
    expect(result.bet365).toMatchObject({
      permitted: true, eventCount: 4, sampledEventCount: 4,
      pricedEventCount: 1, marketCount: 1, priceCount: 2,
    });
    expect(result.bet365.samples).toHaveLength(4);
    expect(result.bet365.samples[0]).toMatchObject({
      fixtureId: '991', linkedEventId: '12345', markets: 1, selections: 2, error: null,
    });
    expect(result.bet365.samples[1]?.error).toBe('INTERNAL_SERVER_ERROR');
    expect(result.bet365.samples[2]?.markets).toBe(0);
    expect(result.bet365.samples[3]?.error).toBe('PERMISSION_DENIED');
    expect(observed.filter(path => path.startsWith('/v1/bet365/event'))).toEqual([
      '/v1/bet365/event:FI=991', '/v1/bet365/event:FI=992',
      '/v1/bet365/event:FI=993', '/v1/bet365/event:FI=994',
    ]);
    expect(JSON.stringify(result)).not.toContain('PRIVATE_TEST_TOKEN');
  });

  it('differentiates Bet365 authorization denial from transient upstream failures', async () => {
    const fake = vi.fn(async (url: RequestInfo | URL) => {
      const endpoint = new URL(String(url)).pathname;
      if (endpoint === '/v1/bet365/inplay_filter') {
        return new Response(JSON.stringify({
          success: 0, error_code: 'PERMISSION_DENIED',
          error: 'token=DO_NOT_ECHO',
        }), { status: 200 });
      }
      if (endpoint === '/v1/bet365/upcoming') {
        return new Response(JSON.stringify({ success: 1, results: [] }));
      }
      return new Response(JSON.stringify({ success: 0, error: 'upstream token=DO_NOT_ECHO' }), { status: 502 });
    });
    const result = await runBetsApiTrial('TEST_TOKEN_ONLY', fake as typeof fetch, [{ id: 1, name: 'Football' }]);
    expect(result.bet365.error).toBe('PERMISSION_DENIED');
    expect(result.bet365.upcomingAccess).toBe('AVAILABLE');
    expect(result.sports[0]?.error).toBe('UPSTREAM_HTTP_5XX');
    expect(JSON.stringify(result)).not.toContain('DO_NOT_ECHO');
    expect(JSON.stringify(result)).not.toContain('TEST_TOKEN_ONLY');
  });

  it('fails closed for unavailable or unentitled markets without leaking upstream errors', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      success: 0, error: 'Internal error: token=DO_NOT_ECHO',
      error_code: 'PERMISSION_DENIED',
    }), { status: 200 }));
    const result = await runBetsApiTrial('TEST_TOKEN_ONLY', fetcher as typeof fetch, [{ id: 1, name: 'Football' }]);
    expect(result.sports[0]?.error).toBe('PERMISSION_DENIED');
    expect(result.bet365.error).toBe('PERMISSION_DENIED');
    expect(result.oddsSample).toHaveLength(0);
    expect(JSON.stringify(result)).not.toContain('DO_NOT_ECHO');
    expect(JSON.stringify(result)).not.toContain('TEST_TOKEN_ONLY');
  });
});
