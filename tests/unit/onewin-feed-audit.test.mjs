import { describe, expect, it } from 'vitest';
import { asArray, extractMarkets, compareReference, runAudit } from '../../scripts/onewin-feed-audit.mjs';

describe('1Win feed audit - offline / read only', () => {
  it('extracts only 1Win markets and never substitutes another bookmaker', () => {
    expect(extractMarkets({ bookmakers: {
      Bet365: [{ name: 'Shots', odds: [{ over: '1.90' }] }],
      '1Win': [
        { name: 'Moneyline', updatedAt: '2026-10-16T18:00:00Z', odds: [{ home: '2.0' }] },
        { name: 'Corners Totals', odds: [{ over: '1.7', under: '2.0' }] },
      ],
    } }).map((m) => m.name)).toEqual(['Moneyline', 'Corners Totals']);
    expect(extractMarkets({ bookmakers: { Bet365: [{ name: 'Moneyline' }] } })).toEqual([]);
  });

  it('treats empty and wrapped API event lists consistently', () => {
    expect(asArray({ events: [{ id: 1 }] })).toHaveLength(1);
    expect(asArray({ data: [{ id: 2 }] })).toHaveLength(1);
    expect(asArray({ unknown: true })).toEqual([]);
  });

  it('reports missing reference matches and missing markets, not imaginary parity', () => {
    const discovered = [
      { id: 7, home: 'AFC Iran', away: 'B Club', date: '2026-10-16T20:00:00Z' },
    ];
    const samples = [{ id: 7, marketNames: ['Moneyline', 'Totals'] }];
    const result = compareReference([
      { home: 'AFC Iran', away: 'B Club', date: '2026-10-16T20:00:00Z',
        markets: ['Moneyline', 'Corners Totals'] },
      { home: 'Absent', away: 'Fixture', date: '2026-10-16T21:00:00Z' },
    ], discovered, samples);
    expect(result.matched).toBe(1);
    expect(result.missingEvents).toHaveLength(1);
    expect(result.missingMarkets[0].markets).toEqual(['Corners Totals']);
  });

  it('audits via injected mock HTTP without real network, writes or user funds', async () => {
    const calls = [];
    const mockFetch = async (url) => {
      const u = new URL(url);
      calls.push(u.pathname);
      const payload = u.pathname.endsWith('/leagues') ?
        [{ name: 'Iran - Persian Gulf Pro League', slug: 'iran-league' }] :
        u.pathname.endsWith('/events/live') ?
          [{ id: 5, home: 'Team A', away: 'Team B', date: '2026-10-16T18:00:00Z',
            status: 'live', league: { name: 'Iran' }, scores: { home: 1, away: 0 } }] :
          u.pathname.endsWith('/events') ?
            [{ id: 6, home: 'Team C', away: 'Team D', date: '2026-10-17T18:00:00Z',
              status: 'pending', league: { name: 'Iran' } }] :
            { bookmakers: { '1Win': [{
              name: 'Moneyline', updatedAt: '2026-10-16T17:58:00Z',
              odds: [{ home: '2.0', away: '1.8' }],
            }] } };
      return new Response(JSON.stringify(payload), { status: 200 });
    };
    const report = await runAudit({ apiKey: 'test-only', maxEvents: 2,
      fetchImpl: mockFetch, now: Date.parse('2026-10-16T18:00:00Z') });
    expect(calls).toEqual(['/v3/leagues', '/v3/events/live', '/v3/events', '/v3/odds', '/v3/odds']);
    expect(report.discoveredFixtures).toBe(2);
    expect(report.sampledLiveFixtures).toBe(1);
    expect(report.samples.find((sample) => sample.id === 5)?.staleLiveMarketsOver60s).toBe(1);
    expect(report.bookmakerParityVerified).toBe(false);
    expect(report.sportsbookLiveEnabled).toBe(false);
  });

  it('fails closed when no API key is configured', async () => {
    await expect(runAudit({ apiKey: '' })).rejects.toThrow('ODDS_API_IO_KEY');
  });
});
