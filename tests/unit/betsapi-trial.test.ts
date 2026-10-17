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
    expect(result.callsInProbe).toBe(4);
    expect(result.bet365.permitted).toBe(true);
    expect(result.remainingHourlyRequests).toBe(3550);
    expect(requests).toHaveLength(4);
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
