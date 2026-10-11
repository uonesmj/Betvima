import { describe, expect, it } from 'vitest';
import {
  MARKET_RULES, canTransitionMarket, checkMarketGate, gradeSelection, marketRuleFor, parseLine,
} from '@/domain/market-rules';
import type { MatchResult, Selection } from '@/domain/types';

const result = (over: Partial<MatchResult> = {}): MatchResult => ({
  matchId: 'm1', status: 'finished', homeScore: 2, awayScore: 1, homeHalfScore: 1, awayHalfScore: 0,
  homeCorners: 6, awayCorners: 4, homeCards: 2, awayCards: 3, extraTime: false, penalties: false,
  penaltyHome: null, penaltyAway: null, provider: 'test', providerResultId: null, authoritative: true,
  observedAt: new Date(), revision: 1, ...over,
});
const sel = (code: string, line: string | null = null): Pick<Selection, 'code' | 'line' | 'participantType'> =>
  ({ code, line, participantType: 'NEUTRAL' });

describe('market rules: catalogue and state machine', () => {
  it('exposes rules for every required market family', () => {
    for (const key of ['1X2', 'DOUBLE_CHANCE', 'DRAW_NO_BET', 'OU', 'BTTS', 'HCP', 'AH', 'CS', 'HT', 'HT_FT', 'CORNERS', 'CARDS', 'TEAM_GOALS']) {
      expect(marketRuleFor(key), key).toBeTruthy();
    }
    expect(marketRuleFor('OU_FULL_TIME_2_5')?.type).toBe('OVER_UNDER');
    expect(MARKET_RULES['1X2']!.basis).toBe('FULL_TIME');
  });

  it('validates market transitions', () => {
    expect(canTransitionMarket('open', 'suspended')).toBe(true);
    expect(canTransitionMarket('suspended', 'open')).toBe(true);
    expect(canTransitionMarket('closed', 'settled')).toBe(true);
    expect(canTransitionMarket('settled', 'open')).toBe(false);
    expect(canTransitionMarket('void', 'open')).toBe(false);
  });
});

describe('market rules: betting gates', () => {
  const rule = MARKET_RULES['1X2']!;
  const now = new Date('2026-01-01T12:00:00Z');
  const base = {
    rule, now, scheduledAt: new Date('2026-01-01T13:00:00Z'),
    isLive: false, liveBettingEnabled: true, prematchBettingEnabled: true,
  };

  it('allows pre-match betting before kick-off', () => {
    expect(checkMarketGate({ ...base, matchStatus: 'scheduled' }).allowed).toBe(true);
  });

  const codeOf = (gate: ReturnType<typeof checkMarketGate>): string => (gate.allowed ? 'ALLOWED' : gate.code);

  it('closes at kick-off and blocks finished/postponed/cancelled matches', () => {
    expect(codeOf(checkMarketGate({ ...base, matchStatus: 'scheduled', now: new Date('2026-01-01T13:01:00Z') }))).toBe('MARKET_CLOSED');
    expect(codeOf(checkMarketGate({ ...base, matchStatus: 'finished' }))).toBe('MATCH_FINISHED');
    expect(codeOf(checkMarketGate({ ...base, matchStatus: 'postponed' }))).toBe('MATCH_POSTPONED');
    expect(codeOf(checkMarketGate({ ...base, matchStatus: 'abandoned' }))).toBe('MATCH_FINISHED');
  });

  it('respects live/pre-match emergency controls and market capability', () => {
    expect(codeOf(checkMarketGate({ ...base, matchStatus: 'live', liveBettingEnabled: false }))).toBe('LIVE_BETTING_DISABLED');
    expect(codeOf(checkMarketGate({ ...base, matchStatus: 'scheduled', prematchBettingEnabled: false }))).toBe('PREMATCH_BETTING_DISABLED');
    expect(codeOf(checkMarketGate({ ...base, matchStatus: 'live', isLive: true, rule: marketRuleFor('CS')! }))).toBe('MARKET_SUSPENDED');
  });
});

describe('market rules: grading', () => {
  const grade = (key: string, code: string, line: string | null, r = result()) =>
    gradeSelection({ rule: marketRuleFor(key)!, selection: sel(code, line), result: r, matchStatus: 'finished' });

  it('1X2', () => {
    expect(grade('1X2', 'HOME', null).grade).toBe('WON');
    expect(grade('1X2', 'AWAY', null).grade).toBe('LOST');
    expect(grade('1X2', 'DRAW', null, result({ homeScore: 1, awayScore: 1 })).grade).toBe('WON');
  });

  it('double chance', () => {
    expect(grade('DOUBLE_CHANCE', 'HOME_OR_DRAW', null).grade).toBe('WON');
    expect(grade('DOUBLE_CHANCE', 'AWAY_OR_DRAW', null).grade).toBe('LOST');
    expect(grade('DOUBLE_CHANCE', 'HOME_OR_AWAY', null).grade).toBe('WON');
    expect(grade('DOUBLE_CHANCE', 'HOME_OR_AWAY', null, result({ homeScore: 2, awayScore: 2 })).grade).toBe('LOST');
  });

  it('draw no bet voids on a draw', () => {
    expect(grade('DRAW_NO_BET', 'HOME', null, result({ homeScore: 1, awayScore: 1 })).grade).toBe('VOID');
    expect(grade('DRAW_NO_BET', 'HOME', null).grade).toBe('WON');
  });

  it('over/under with lines, halves and pushes', () => {
    expect(grade('OU', 'OVER_2_5', '2.5').grade).toBe('WON');
    expect(grade('OU', 'UNDER_2_5', '2.5').grade).toBe('LOST');
    expect(grade('OU', 'OVER_2_5', '2.5', result({ homeScore: 1, awayScore: 1 })).grade).toBe('LOST');
    expect(grade('OU', 'OVER_3', '3', result({ homeScore: 2, awayScore: 1 })).grade).toBe('VOID');
    expect(grade('OU', 'OVER_0_5', '0.5', result({ homeHalfScore: 1, awayHalfScore: 0, homeScore: 2, awayScore: 1 })).grade).toBe('WON');
  });

  it('both teams to score', () => {
    expect(grade('BTTS', 'YES', null).grade).toBe('WON');
    expect(grade('BTTS', 'NO', null).grade).toBe('LOST');
    expect(grade('BTTS', 'YES', null, result({ awayScore: 0 })).grade).toBe('LOST');
  });

  it('handicaps including Asian quarter lines', () => {
    expect(grade('HCP', 'HOME', '-1').grade).toBe('VOID');               // 2-1 with -1 -> push
    expect(grade('HCP', 'HOME', '-0.5').grade).toBe('WON');
    expect(grade('HCP', 'AWAY', '+1.5').grade).toBe('WON');   // away +1.5 covers a 1-goal defeat
    // quarter lines split the stake: a draw with -0.25 loses half; a draw with +0.25 wins half
    expect(grade('AH', 'HOME', '-0.25', result({ homeScore: 1, awayScore: 1 })).grade).toBe('HALF_LOST');
    expect(grade('AH', 'HOME', '+0.25', result({ homeScore: 1, awayScore: 1 })).grade).toBe('HALF_WON');
    expect(grade('AH', 'HOME', '-0.25').grade).toBe('WON');    // won by one: both halves win
  });

  it('correct score and half time / full time', () => {
    expect(grade('CS', '2-1', null).grade).toBe('WON');
    expect(grade('CS', '1-1', null).grade).toBe('LOST');
    expect(grade('HT', 'HOME', null).grade).toBe('WON');
    expect(grade('HT_FT', 'HOME_HOME', null).grade).toBe('WON');
    expect(grade('HT_FT', 'HOME_AWAY', null).grade).toBe('LOST');
  });

  it('corners and cards', () => {
    expect(grade('CORNERS', 'OVER_8_5', '8.5').grade).toBe('WON');   // 10 corners
    expect(grade('CORNERS', 'UNDER_8_5', '8.5').grade).toBe('LOST');
    expect(grade('CARDS', 'OVER_4_5', '4.5').grade).toBe('WON');     // 5 cards
  });

  it('voids markets when the match is abandoned/postponed and never guesses', () => {
    const abandoned = gradeSelection({ rule: marketRuleFor('1X2')!, selection: sel('HOME'), result: result({ status: 'abandoned' }), matchStatus: 'abandoned' });
    expect(abandoned.grade).toBe('VOID');
    const missing = gradeSelection({
      rule: marketRuleFor('CORNERS')!, selection: sel('OVER_8_5', '8.5'),
      result: result({ homeCorners: null, awayCorners: null }), matchStatus: 'finished',
    });
    expect(missing.grade).toBe('MANUAL_REVIEW');
    const notFinished = gradeSelection({ rule: marketRuleFor('1X2')!, selection: sel('HOME'), result: result(), matchStatus: 'live' });
    expect(notFinished.grade).toBe('PENDING');
  });

  it('parses lines exactly (no floating point authority)', () => {
    expect(parseLine('2.5')).toBe(250);
    expect(parseLine('-1')).toBe(-100);
    expect(parseLine('+1.75')).toBe(175);
    expect(parseLine('abc')).toBeNull();
    expect(parseLine(null)).toBeNull();
  });
});
