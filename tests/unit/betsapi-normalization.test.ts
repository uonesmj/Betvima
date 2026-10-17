import { describe, expect, it } from 'vitest';
import {
  betsapiIdentity, normalizeBetsapiEvent, normalizeBetsapiOdds,
  normalizeBetsapiResult, parseBetsapiIdentity,
} from '@/providers/betsapi-normalization';
import {
  bet365OddsDecimal, parseBet365LivePreview, parseBet365PrematchPreview,
} from '@/providers/betsapi-bet365-preview';

const at = new Date('2026-10-17T13:30:00.000Z');
const now = Math.floor(at.getTime() / 1000);
const event = {
  id: '4140581', sport_id: '1', time: '1792242000', time_status: '1',
  league: { id: '825', name: 'Tunisia League 1', cc: 'tn' },
  home: { id: '47374', name: 'Home' }, away: { id: '71185', name: 'Away' },
  ss: '1-1', timer: { tm: 54, tt: '1' }, stats: { corners: ['2', '3'] },
  scores: { '1': { home: '0', away: '1' } },
};

describe('BetsAPI Events API identity and fixture normalization', () => {
  it('tracks a distinct source event ID, scores, league and real live minute', () => {
    const m = normalizeBetsapiEvent(event);
    expect(m).toMatchObject({
      providerId: '1:4140581', sport: 'football', status: 'live',
      homeScore: 1, awayScore: 1, minute: 54, leagueName: 'Tunisia League 1',
    });
    expect(parseBetsapiIdentity('1:4140581')).toEqual({ sportId: 1, eventId: '4140581' });
    expect(parseBetsapiIdentity('soccer_epl:4140581')).toBeNull();
    expect(betsapiIdentity(1, '4140581')).not.toEqual('108742033');
  });
  it('rejects phantom fixtures and never settles ambiguous live results', () => {
    expect(normalizeBetsapiEvent({ ...event, home: { name: '' } })).toBeNull();
    expect(normalizeBetsapiEvent({ ...event, sport_id: '7777' })).toBeNull();
    expect(normalizeBetsapiResult('1:4140581', event)?.authoritative).toBe(false);
    expect(normalizeBetsapiResult('1:4140581', { ...event, time_status: '3' }))
      .toMatchObject({ status: 'finished', authoritative: true, homeCorners: 2 });
    expect(normalizeBetsapiResult('1:9999', event)).toBeNull();
  });
});

describe('BetsAPI bookmaker freshness and suspension policy', () => {
  const quote = (addTime: number, marketTime: number, prices: Record<string, string>) => ({
    stats: { odds_update: { '1_1': marketTime } },
    odds: { '1_1': [{ id: 'quote', add_time: String(addTime), ...prices }] },
  });
  const price = { home_od: '2.100', draw_od: '3.100', away_od: '3.200' };
  it('does not repeat a historical quote or treat an upstream check as a new price', () => {
    expect(normalizeBetsapiOdds('1:4140581', quote(now - 120, now, price), at, true).markets).toEqual([]);
    expect(normalizeBetsapiOdds('1:4140581', quote(now, now - 120, price), at, true).markets).toEqual([]);
    expect(normalizeBetsapiOdds('1:4140581', quote(now + 50, now + 50, price), at, true).markets).toEqual([]);
    expect(normalizeBetsapiOdds('1:4140581', quote(now - 20, now - 20, price), at, true).markets[0])
      .toMatchObject({ key: 'h2h', isLive: true, status: 'open' });
  });
  it('ignores suspended placeholders and protects the single-source market identity', () => {
    const result = normalizeBetsapiOdds('1:4140581', quote(now, now, {
      home_od: '-', draw_od: '-', away_od: '3.100',
    }), at, true);
    expect(result.markets).toHaveLength(0);
    expect(normalizeBetsapiOdds('other:4140581', quote(now, now, price), at, true).markets).toEqual([]);
  });
  it('rejects malformed odds and keeps real decimal values', () => {
    const result = normalizeBetsapiOdds('1:4140581', quote(now, now, price), at, true);
    expect(result.markets[0]?.selections.map(s => s.odds)).toEqual(['2.100', '3.100', '3.200']);
  });
});

describe('Bet365 preview is a separate bookmaker identity, not a bettable Events API source', () => {
  it('parses fractional prices, ignores suspended participants and marks preview-only markets', () => {
    const live = parseBet365LivePreview('92809252', [[
      { type: 'MG', ID: '1777', NA: 'Fulltime Result' },
      { type: 'MA' },
      { type: 'PA', ID: '1', NA: 'Home', OD: '2/1', SU: '0' },
      { type: 'PA', ID: '2', NA: 'Draw', OD: '11/5', SU: '0' },
      { type: 'PA', ID: '3', NA: 'Away', OD: '1/5', SU: '1' },
    ]]);
    expect(live.source).toBe('betsapi_bet365');
    expect(live.marketCount).toBe(1);
    expect(live.priceCount).toBe(2);
    expect(live.markets[0]?.key).toBe('bet365:92809252:1777');
    expect(live.markets[0]?.selections[0]?.decimal).toBe('3.0000');
    expect(bet365OddsDecimal('11/5')).toBe('3.2000');
    expect(bet365OddsDecimal('0/0')).toBeNull();
  });
  it('parses multiple independent prematch groups without confusing FI and event ids', () => {
    const data = [{ FI: '92809252', main: { sp: {
      full_time_result: { name: 'Full Time Result', odds: [
        { id: '1', name: 'Home', odds: '2.25' },
        { id: '2', name: 'Draw', odds: '3.50' },
        { id: '3', name: 'Away', odds: '3.25' },
      ] },
    } } }];
    const result = parseBet365PrematchPreview('92809252', data);
    expect(result.marketCount).toBe(1);
    expect(result.priceCount).toBe(3);
    expect(result.markets[0]?.key).toContain('bet365:92809252:main:');
  });
});
