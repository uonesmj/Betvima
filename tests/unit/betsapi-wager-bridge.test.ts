import { afterEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('@/server/services/container', () => ({
  createServices: () => ({ db: { query: state.query } }),
}));

import {
  attachCanonicalWagers, fullTimeOutcome, pricesAgree, wagerFeedEnabled,
} from '@/server/betsapi-wager-bridge';

afterEach(() => {
  vi.unstubAllEnvs();
  state.query.mockReset();
});

const input = {
  fi: '92809252', eventId: '4140581', sportId: 1, mode: 'live' as const,
  home: 'Home FC', away: 'Away United',
};
const markets = [{
  key: 'bet365:92809252:1777', title: 'Fulltime Result',
  selections: [
    { id: 'bet365-home', label: 'Home FC', decimal: '2.1000' },
    { id: 'bet365-draw', label: 'Draw', decimal: '3.2500' },
    { id: 'bet365-away', label: 'Away United', decimal: '3.8500' },
  ],
}];

function enable() {
  vi.stubEnv('BETSAPI_WAGER_INGEST_ENABLED', 'true');
  vi.stubEnv('BETSAPI_TRIAL_ENABLED', 'true');
  vi.stubEnv('SPORTS_PROVIDER', 'betsapi');
  vi.stubEnv('BETSAPI_TRIAL_TOKEN', 'TEST_SERVER_ONLY');
}

describe('Bet365-to-Events wallet bridge', () => {
  it('rejects misleading, partial, half-time and player market identities', () => {
    expect(fullTimeOutcome('Fulltime Result', 'Home FC', 'Home FC', 'Away United')).toBe('HOME');
    expect(fullTimeOutcome('Fulltime Result', 'Draw', 'Home FC', 'Away United')).toBe('DRAW');
    expect(fullTimeOutcome('1x2', '2', 'Home FC', 'Away United')).toBe('AWAY');
    expect(fullTimeOutcome('First Half Result', 'Home FC', 'Home FC', 'Away United')).toBeNull();
    expect(fullTimeOutcome('Fulltime Result', 'Different Team', 'Home FC', 'Away United')).toBeNull();
    expect(fullTimeOutcome('Corners', 'Home', 'Home FC', 'Away United')).toBeNull();
    expect(fullTimeOutcome('Match Winner', 'Away United', 'Home FC', 'Away United')).toBe('AWAY');
  });

  it('requires exact current bookmaker prices; never tolerates silent movement', () => {
    expect(pricesAgree('2.1000', '21000')).toBe(true);
    expect(pricesAgree('2.1000', '21001')).toBe(false);
    expect(pricesAgree('0', '0')).toBe(false);
    expect(pricesAgree('1.0000', '10000')).toBe(false);
    expect(pricesAgree('not-a-price', '21000')).toBe(false);
  });

  it('does not query wallet-authoritative data before explicit activation', async () => {
    expect(wagerFeedEnabled()).toBe(false);
    expect(await attachCanonicalWagers(markets, input)).toEqual(markets);
    expect(state.query).not.toHaveBeenCalled();
  });

  it('never confuses a Bet365 FI with its linked Events event ID', async () => {
    enable();
    state.query.mockResolvedValue([{
      matchId: 'm-uuid', marketId: 'mk-uuid', selectionId: 's-home-uuid',
      code: 'HOME', oddsScaled: '21000', oddsVersion: 7, matchStatus: 'live',
    }, {
      matchId: 'm-uuid', marketId: 'mk-uuid', selectionId: 's-draw-uuid',
      code: 'DRAW', oddsScaled: '32500', oddsVersion: 7, matchStatus: 'live',
    }]);
    const result = await attachCanonicalWagers(markets, input);
    expect(result[0]?.selections[0]?.wager).toEqual({
      matchId: 'm-uuid', marketId: 'mk-uuid', selectionId: 's-home-uuid',
      oddsScaled: '21000', oddsVersion: 7,
    });
    expect(result[0]?.selections[1]?.wager?.selectionId).toBe('s-draw-uuid');
    expect(result[0]?.selections[2]?.wager).toBeUndefined();
    const sql = state.query.mock.calls[0]![0] as string;
    const params = state.query.mock.calls[0]![1] as unknown[];
    expect(params).toEqual(['betsapi', '1:4140581', true, 'live']);
    expect(sql).toContain("m.provider = $1");
    expect(sql).toContain("s.odds_updated_at > now()");
    expect(sql).toContain("s.status::text = 'open'");
    expect(sql).toContain("mk.type = '1X2'");
  });

  it('does not allow a mismatching displayed price or fabricated provider linkage', async () => {
    enable();
    state.query.mockResolvedValue([{
      matchId: 'm-uuid', marketId: 'mk-uuid', selectionId: 's-home-uuid',
      code: 'HOME', oddsScaled: '20500', oddsVersion: 8, matchStatus: 'live',
    }]);
    const r = await attachCanonicalWagers(markets, input);
    expect(r[0]?.selections[0]?.wager).toBeUndefined();
    expect(await attachCanonicalWagers(markets, { ...input, eventId: null })).toEqual(markets);
    expect(await attachCanonicalWagers(markets, { ...input, sportId: 18 })).toEqual(markets);
    expect(state.query).toHaveBeenCalledTimes(1);
  });

  it('fails closed when canonical odds database is unavailable', async () => {
    enable();
    state.query.mockRejectedValue(new Error('DB unavailable'));
    expect(await attachCanonicalWagers(markets, input)).toEqual(markets);
  });
});
