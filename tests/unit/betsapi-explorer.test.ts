import { describe, expect, it, vi } from 'vitest';
import {
  exploreBetsApi, parseExplorerFixture, type ExplorerMarkets, type ExplorerList,
} from '@/providers/betsapi-explorer';
import {
  parseBet365PrematchPreview, parseBet365LivePreview,
} from '@/providers/betsapi-bet365-preview';

const token = 'ROTATED_MOCK_TOKEN_DO_NOT_LOG';
const mockFixture = (id: string) => ({
  id, time: '1792400000', time_status: '0', ss: '2-1', our_event_id: '12345',
  league: { id: '17', name: 'Example Premier', cc: 'tr' },
  home: { name: 'Home' }, away: { name: 'Away' },
  timer: { tm: '51' },
});
const fetcherWith = (resolver: (path: string, url: URL) => unknown) =>
  vi.fn(async (resource: RequestInfo | URL) => {
    const url = new URL(String(resource));
    expect(url.hostname).toBe('api.b365api.com');
    expect(url.searchParams.get('token')).toBe(token);
    return new Response(JSON.stringify({ success: 1, ...resolver(url.pathname, url) }),
      { status: 200 });
  });

describe('Bet365 site catalogue security and pagination', () => {
  it('reads every live fixture without silently mixing Events ids and bookmaker FI', async () => {
    const fetcher = fetcherWith(() => ({ results: [mockFixture('901'), mockFixture('902')] }));
    const result = await exploreBetsApi(token, { mode: 'live', sportId: 1 }, fetcher as typeof fetch) as ExplorerList;
    expect(result.total).toBe(2);
    expect(result.fixtures.map(x => x.fi)).toEqual(['901', '902']);
    expect(result.fixtures[0]).toMatchObject({
      eventId: '12345', home: 'Home', away: 'Away', league: 'Example Premier',
      minute: 51, score: '2-1',
    });
    expect(fetcher.mock.calls).toHaveLength(1);
    expect(String(fetcher.mock.calls[0]?.[0])).toContain('/v1/bet365/inplay_filter');
    expect(JSON.stringify(result)).not.toContain(token);
  });

  it('preserves page numbers and total fixtures, not just first 50 upcoming games', async () => {
    const fetcher = fetcherWith(() => ({
      pager: { page: 5, per_page: 50, total: 1010 },
      results: [mockFixture('920')],
    }));
    const result = await exploreBetsApi(token, {
      mode: 'upcoming', sportId: 1, page: 5,
    }, fetcher as typeof fetch) as ExplorerList;
    expect(result).toMatchObject({ page: 5, pageCount: 21, total: 1010 });
    expect(new URL(String(fetcher.mock.calls[0]?.[0])).searchParams.get('page')).toBe('5');
  });

  it('uses independent Bet365 FI endpoints for live and upcoming market details', async () => {
    const liveFetcher = fetcherWith(() => ({ results: [[
      { type: 'MG', ID: '440', NA: 'Result', SU: '0' },
      { type: 'PA', ID: '1', NA: 'Home', OD: '2/1', SU: '0' },
      { type: 'PA', ID: '2', NA: 'Draw', OD: '11/5', SU: '0' },
      { type: 'PA', ID: '3', NA: 'Away', OD: '3/1', SU: '1' },
    ]] }));
    const preview = await exploreBetsApi(token, {
      mode: 'live', sportId: 1, fi: '92809252',
    }, liveFetcher as typeof fetch) as ExplorerMarkets;
    expect(preview).toMatchObject({ fi: '92809252', marketCount: 1, selectionCount: 2 });
    expect(preview.markets[0]?.selections.map(s => s.decimal)).toEqual(['3.0000', '3.2000']);
    expect(String(liveFetcher.mock.calls[0]?.[0])).toContain('/v1/bet365/event?');

    const prematchFetcher = fetcherWith(() => ({ results: [{
      FI: '92809252',
      main: { sp: { full_time_result: { id: '1', name: 'Full Time Result',
        odds: [
          { id: '11', name: 'Home', odds: '2.20' },
          { id: '12', name: 'Away', odds: '3.40' },
        ],
      } } },
    }] }));
    const next = await exploreBetsApi(token, {
      mode: 'upcoming', sportId: 1, fi: '92809252',
    }, prematchFetcher as typeof fetch) as ExplorerMarkets;
    expect(next).toMatchObject({ marketCount: 1, selectionCount: 2 });
    expect(String(prematchFetcher.mock.calls[0]?.[0])).toContain('/v4/bet365/prematch?');
    expect(JSON.stringify(next)).not.toContain(token);
  });

  it('fails closed when private token is unconfigured or FI invalid', async () => {
    const empty = await exploreBetsApi(null, { mode: 'live', sportId: 1 }) as ExplorerList;
    expect(empty.error).toBe('NOT_CONFIGURED');
    expect(empty.fixtures).toHaveLength(0);
    await expect(exploreBetsApi(token, { mode: 'live', sportId: 1, fi: 'x:14' }))
      .rejects.toMatchObject({ code: 'UPSTREAM_INVALID' });
    expect(parseExplorerFixture({ id: 'bad' }, 1)).toBeNull();
  });

  it('masks upstream errors and never returns credential-bearing URLs', async () => {
    const fake = vi.fn(async () => new Response(
      JSON.stringify({ success: 0, error: 'token=' + token }),
      { status: 401 },
    ));
    const result = await exploreBetsApi(token, { mode: 'live', sportId: 1 }, fake as typeof fetch);
    expect(result.error).toBe('UPSTREAM_DENIED');
    expect(JSON.stringify(result)).not.toContain(token);
  });
});

describe('all Bet365 market groups', () => {
  it('parses more than 150 independent priced live groups and respects suspended participants', () => {
    const groups = Array.from({ length: 185 }, (_, i) => [
      { type: 'MG', ID: String(i), NA: 'Market ' + i, SU: '0' },
      { type: 'PA', ID: String(i * 10), NA: 'Home', OD: '6/5', SU: '0' },
      { type: 'PA', ID: String(i * 10 + 1), NA: 'Away', OD: '2/1', SU: '1' },
    ]);
    const result = parseBet365LivePreview('1288', groups);
    expect(result.marketCount).toBe(185);
    expect(result.priceCount).toBe(185);
    expect(result.markets[0]?.selections).toHaveLength(1);
  });

  it('includes Bet365 v4 prematch main, goals and dynamic others sections', () => {
    const odds = (i: string) => [{ id: i + '1', name: 'Yes', odds: '2.14' },
      { id: i + '2', name: 'No', odds: '1.70' }];
    const result = parseBet365PrematchPreview('900', [{
      FI: '900',
      main: { sp: { result: { id: '1', name: 'Result', odds: odds('1') } } },
      goals: { sp: { btts: { id: '2', name: 'Both Score', odds: odds('2') } } },
      others: [{ sp: { extra: { id: '3', name: 'Extra', odds: odds('3') } } }],
    }]);
    expect(result.marketCount).toBe(3);
    expect(result.priceCount).toBe(6);
    expect(result.markets.some(m => m.title === 'Extra')).toBe(true);
  });
});
