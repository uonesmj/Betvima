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
const fetcherWith = (resolver: (path: string, url: URL) => Record<string, unknown>) =>
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

  it('lists every BetsAPI Events fixture, even when no Bet365 market mapping exists', async () => {
    const fetcher = fetcherWith(() => ({ results: [{
      id: '8241329', time: '1792400000', time_status: '1', ss: '0-1',
      league: { name: 'Independent League', cc: 'ir' },
      home: { name: 'Sample A' }, away: { name: 'Sample B' },
      timer: { tm: '72' },
    }, {
      id: '8241330', bet365_id: '9918271', time: '1792400100', time_status: '1',
      league: { name: 'Bet365 linked' },
      home: { name: 'Sample C' }, away: { name: 'Sample D' },
    }] }));
    const data = await exploreBetsApi(token, {
      mode: 'live', sportId: 1, feed: 'events',
    }, fetcher as typeof fetch) as ExplorerList;
    expect(data.source).toBe('betsapi_events');
    expect(data.total).toBe(2);
    expect(data.fixtures[0]).toMatchObject({
      fi: null, eventId: '8241329', home: 'Sample A', minute: 72,
    });
    expect(data.fixtures[1]).toMatchObject({ fi: '9918271', eventId: '8241330' });
    expect(String(fetcher.mock.calls[0]?.[0])).toContain('/v3/events/inplay?');
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
    const result = await exploreBetsApi(token, { mode: 'live', sportId: 18 }, fake as typeof fetch);
    expect(result.error).toBe('UPSTREAM_DENIED');
    expect(JSON.stringify(result)).not.toContain(token);
  });
});

describe('Bet365 missing outcome labels', () => {
  it('never invents player names or Over/Under sides for live prices', () => {
    const parsed = parseBet365LivePreview('801', [[
      { type: 'MG', ID: '1', NA: 'Goalscorers' },
      { type: 'PA', ID: '12', OD: '5/1' },
      { type: 'PA', ID: '13', OD: '6/1', NA: 'Player A' },
    ]]);
    expect(parsed.markets[0]?.selections[0]?.label).toBe('Unlabelled outcome #12');
    expect(parsed.markets[0]?.selections[1]?.label).toBe('Player A');
  });

  it('retains unmatched prematch lines without mislabelling them as over or under', () => {
    const parsed = parseBet365PrematchPreview('802', [{
      goals: { sp: { total: { id: '4', name: 'Match Goals', odds: [
        { id: '20', name: '', handicap: '4.5', odds: '1.9' },
        { id: '21', name: 'Over', handicap: '4.5', odds: '2.2' },
      ] } } },
    }]);
    expect(parsed.markets[0]?.selections[0]?.label).toBe('Unlabelled outcome #20 · line 4.5');
    expect(parsed.markets[0]?.selections[1]?.label).toBe('Over (4.5)');
  });
});

describe('Ambiguous source labels', () => {
  it('rejects generic Selection with Yes/No suffix as a defined outcome', () => {
    const parsed = parseBet365LivePreview('804', [[
      { type: 'MG', ID: '1', NA: 'Team Clean Sheet' },
      { type: 'PA', ID: '101', NA: 'Selection (Yes)', OD: '5/2' },
      { type: 'PA', ID: '102', NA: 'Selection (No)', OD: '1/4' },
    ]]);
    expect(parsed.markets[0]?.selections.map(x => x.label)).toEqual([
      'Unlabelled outcome #101', 'Unlabelled outcome #102',
    ]);
  });
});

describe('Bet365 MA market context', () => {
  it('retains explicit MA context for anonymous PA outcomes and resets on a new MG', () => {
    const parsed = parseBet365LivePreview('803', [[
      { type: 'MG', ID: '1', NA: 'Match Goals' },
      { type: 'MA', ID: '100', NA: 'Over 2.5' },
      { type: 'PA', ID: '21', OD: '6/5' },
      { type: 'MA', ID: '101', NA: 'Under 2.5' },
      { type: 'PA', ID: '22', OD: '5/6' },
      { type: 'MG', ID: '2', NA: 'Result' },
      { type: 'PA', ID: '23', NA: 'Draw', OD: '2/1' },
    ]]);
    expect(parsed.markets[0]?.selections.map(s => s.label)).toEqual([
      'Over 2.5 · Unlabelled outcome #21',
      'Under 2.5 · Unlabelled outcome #22',
    ]);
    expect(parsed.markets[1]?.selections[0]?.label).toBe('Draw');
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
