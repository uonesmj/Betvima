import { describe, expect, it, vi } from 'vitest';
import { BetsApiEventsProvider } from '@/providers/betsapi-events-provider';

const TOKEN = 'TEST_ONLY_BETSAPI_TOKEN_123456';
const fixture = (status: '0' | '1' = '1') => ({
  id: '123456', time: '1792300000', time_status: status, ss: '1-0',
  home: {name:'Sample Home'}, away:{name:'Sample Away'},
  league:{name:'Sample League', cc:'dz'}, timer:{tm:'41'},
});
const makeFetch = (handler: (url: URL) => Response) =>
  vi.fn(async (input: RequestInfo | URL) => handler(new URL(String(input)))) as unknown as typeof fetch;

describe('BetsAPI candidate provider contract (synthetic data; never production)', () => {
  it('caps simultaneous live-fixture discovery requests at three', async () => {
    let active = 0;
    let peak = 0;
    const fetcher = vi.fn(async (_input: RequestInfo | URL) => {
      active++;
      peak = Math.max(peak, active);
      await new Promise(resolve => setTimeout(resolve, 5));
      active--;
      return Response.json({ success: 1, results: [] });
    }) as unknown as typeof fetch;
    const provider = new BetsApiEventsProvider(TOKEN, fetcher);
    const result = await provider.fetchLiveMatches();
    expect(result.ok).toBe(true);
    expect(peak).toBeLessThanOrEqual(3);
    expect(peak).toBeGreaterThan(0);
  });

  it('parses genuine-shaped live events, preserves provider identity and does not leak token', async () => {
    const fetcher = makeFetch(url => {
      expect(url.hostname).toBe('api.b365api.com');
      expect(url.pathname).toBe('/v3/events/inplay');
      expect(url.searchParams.get('token')).toBe(TOKEN);
      return Response.json({success:1,results:[fixture()]});
    });
    const provider = new BetsApiEventsProvider(TOKEN,fetcher);
    const result = await provider.fetchLiveMatches('football');
    expect(result.ok).toBe(true);
    expect(result.value?.[0]).toMatchObject({
      providerId:'1:123456', status:'live', homeTeamName:'Sample Home',
      awayTeamName:'Sample Away', minute:41, countryCode:'dz',
    });
    expect(JSON.stringify(result)).not.toContain(TOKEN);
  });
  it('rejects quota errors without returning stale fabricated events', async () => {
    const provider = new BetsApiEventsProvider(TOKEN,makeFetch(() =>
      new Response('quota', {status:429})));
    const result = await provider.fetchLiveMatches('football');
    expect(result).toMatchObject({ok:false,value:null,errorCode:'UPSTREAM_RATE_LIMIT'});
  });
  it('keeps suspended live prices out of executable bookmaker feeds', async () => {
    const provider = new BetsApiEventsProvider(TOKEN,makeFetch(url => {
      expect(url.pathname).toBe('/v1/bet365/event');
      return Response.json({success:1,results:[[
        {type:'MG',ID:'19',NA:'Full Time Result',SU:'1'},
        {type:'PA',ID:'12',NA:'Home',OD:'2/1',SU:'0'},
      ]]});
    }));
    const result = await provider.fetchBet365Catalogue('9876','live');
    expect(result.ok).toBe(true);
    expect(result.value?.markets[0]?.status).toBe('suspended');
    expect(result.value?.markets[0]?.selections[0]?.status).toBe('suspended');
    expect(result.value?.readOnly).toBe(true);
  });
  it('fails closed when Bet365 access is denied', async () => {
    const provider = new BetsApiEventsProvider(TOKEN,makeFetch(() =>
      Response.json({success:0,error_code:'PERMISSION_DENIED'},{status:403})));
    expect(await provider.fetchBet365Catalogue('9876','upcoming')).toMatchObject({
      ok:false,value:null,errorCode:'UPSTREAM_DENIED',
    });
  });
  it('does not accept nonnumeric FI and never contacts remote service', async () => {
    const fetcher = makeFetch(() => {throw Error('unexpected call');});
    const provider = new BetsApiEventsProvider(TOKEN,fetcher);
    expect(await provider.fetchBet365Catalogue('other:123','live')).toMatchObject({
      ok:false,errorCode:'INVALID_BET365_FI',
    });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('cannot mark unverified event views as authoritative results for settlement', async () => {
    const provider = new BetsApiEventsProvider(TOKEN,makeFetch(() =>
      Response.json({success:1,results:[{...fixture('1'),time_status:'3'}]})));
    const result = await provider.fetchResult('1:123456');
    expect(result.ok).toBe(true);
    expect(result.value?.authoritative).toBe(false);
  });
});
