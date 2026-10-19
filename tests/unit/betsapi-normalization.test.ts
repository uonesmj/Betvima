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
      .toMatchObject({ status: 'finished', authoritative: false, homeCorners: 2 });
    expect(normalizeBetsapiResult('1:4140581', { ...event, time_status: '3' }, at, true))
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
  it('accepts rechecked unchanged quotes but rejects stale market checks', () => {
    expect(normalizeBetsapiOdds('1:4140581', quote(now - 120, now, price), at, true).markets).toHaveLength(1);
    expect(normalizeBetsapiOdds('1:4140581', quote(now, now - 120, price), at, true).markets).toEqual([]);
    expect(normalizeBetsapiOdds('1:4140581', quote(now + 50, now + 50, price), at, true).markets).toEqual([]);
    expect(normalizeBetsapiOdds('1:4140581', quote(now - 20, now - 20, price), at, true).markets[0])
      .toMatchObject({ key: 'h2h', isLive: true, status: 'open' });
  });
  it('accepts an unchanged bookmaker price only after a genuinely fresh market check', () => {
    // Odds history add_time is not the provider's most recent market check.
    const freshRecheck = normalizeBetsapiOdds('1:4140581',
      quote(now - 180, now - 5, price), at, true);
    expect(freshRecheck.markets[0]).toMatchObject({
      key: 'h2h', sourceUpdatedAt: new Date((now - 5) * 1000).toISOString(),
    });
    expect(normalizeBetsapiOdds('1:4140581',
      quote(now - 180, now - 60, price), at, true).markets).toEqual([]);
    expect(normalizeBetsapiOdds('1:4140581',
      quote(now + 50, now - 2, price), at, true).markets).toEqual([]);
  });

  it('rejects reversed home/away mapping rather than grading an inverted winner', () => {
    const reversed = {
      ...quote(now - 2, now - 1, price),
      stats: { matching_dir: -1, odds_update: { '1_1': now - 1 } },
    };
    expect(normalizeBetsapiOdds('1:4140581', reversed, at, true).markets).toEqual([]);
    const forward = {
      ...reversed,
      stats: { matching_dir: 1, odds_update: { '1_1': now - 1 } },
    };
    expect(normalizeBetsapiOdds('1:4140581', forward, at, true).markets).toHaveLength(1);
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


describe('Bet365 outcome names vs metadata headers', () => {
  it('does not concatenate correct-score labels with positional header values', () => {
    const preview = parseBet365PrematchPreview('100000', [{
      goals: { sp: { score: { id: 'score', name: 'Correct Score', odds: [
        { id: '21', name: '1-0', header: '1', odds: '17.00' },
        { id: '22', name: '0-0', header: 'Draw', odds: '21.00' },
      ] } } },
    }]);
    expect(preview.markets[0]?.selections.map(x => x.label)).toEqual(['1-0','0-0']);
    expect(preview.markets[0]?.selections.map(x => x.decimal)).toEqual(['17.00','21.00']);
  });
  it('preserves a real handicap and falls back to a provider header only when no name exists', () => {
    const preview = parseBet365PrematchPreview('100001', [{
      main: { sp: { asian: { id: 'asian', name: 'Asian Handicap', odds: [
        { id: '31', name: 'Home', header: '1', handicap: '-0.5', odds: '1.85' },
        { id: '32', name: '', header: 'Away', handicap: '+0.5', odds: '1.92' },
      ] } } },
    }]);
    expect(preview.markets[0]?.selections.map(x => x.label)).toEqual(['Home (-0.5)','Away (+0.5)']);
  });
});
