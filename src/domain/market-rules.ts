/**
 * NOVA - MARKET RULES ENGINE
 *
 * Every market type declares: eligibility, opening, suspension, closure, settlement,
 * void rules and result mapping. Settlement logic NEVER lives in a React component
 * (rule 11 / 91); the UI only renders what this engine returns.
 *
 * Result mapping consumes an authoritative MatchResult plus optional per-market facts.
 * Missing/ambiguous facts => MANUAL_REVIEW. Never guessed, never silently voided.
 */
import type { MatchResult, Market, MarketType, Selection, MatchStatus } from './types';
import type { LegGrade } from './types';

export type SettlementBasis =
  | 'FULL_TIME'          // 90 minutes + stoppage (football convention: excludes ET/pens)
  | 'REGULATION_AND_ET'  // includes extra time, excludes penalties
  | 'INCLUDING_PENALTIES'
  | 'FIRST_HALF'
  | 'SECOND_HALF'
  | 'PERIOD_BASED';

export interface MarketRule {
  type: MarketType;
  key: string;
  name: string;
  nameFa: string;
  basis: SettlementBasis;
  /** Minimum match status required before this market may be settled. */
  requiresStatus: MatchStatus[];
  /** Market voided (stake returned) when the match is abandoned/postponed/cancelled. */
  voidOnAbandoned: boolean;
  /** Market voided when the referenced period is not completed. */
  voidOnIncompletePeriod: boolean;
  /** Settlement resolver id; the settlement engine looks the resolver up by this key. */
  resolver: string;
  /** Optional data requirement; missing requirement => MANUAL_REVIEW. */
  requires?: readonly ('homeScore' | 'awayScore' | 'homeHalfScore' | 'awayHalfScore' | 'homeCorners' | 'awayCorners' | 'homeCards' | 'awayCards' | 'penalties')[];
  isLive: boolean;
}

export const MARKET_RULES: Record<string, MarketRule> = {
  '1X2': {
    type: '1X2', key: '1X2', name: 'Match Result', nameFa: 'نتیجه Openی', basis: 'FULL_TIME',
    requiresStatus: ['finished'], voidOnAbandoned: true, voidOnIncompletePeriod: true,
    resolver: 'resolve1X2', requires: ['homeScore', 'awayScore'], isLive: true,
  },
  DOUBLE_CHANCE: {
    type: 'DOUBLE_CHANCE', key: 'DOUBLE_CHANCE', name: 'Double Chance', nameFa: 'شانس دوگانه', basis: 'FULL_TIME',
    requiresStatus: ['finished'], voidOnAbandoned: true, voidOnIncompletePeriod: true,
    resolver: 'resolveDoubleChance', requires: ['homeScore', 'awayScore'], isLive: true,
  },
  DRAW_NO_BET: {
    type: 'DRAW_NO_BET', key: 'DRAW_NO_BET', name: 'Draw No Bet', nameFa: 'بدون Draw', basis: 'FULL_TIME',
    requiresStatus: ['finished'], voidOnAbandoned: true, voidOnIncompletePeriod: true,
    resolver: 'resolveDrawNoBet', requires: ['homeScore', 'awayScore'], isLive: true,
  },
  OVER_UNDER: {
    type: 'OVER_UNDER', key: 'OU', name: 'Total Goals', nameFa: 'مجموع گل‌ها', basis: 'FULL_TIME',
    requiresStatus: ['finished'], voidOnAbandoned: true, voidOnIncompletePeriod: true,
    resolver: 'resolveOverUnder', requires: ['homeScore', 'awayScore'], isLive: true,
  },
  BTTS: {
    type: 'BTTS', key: 'BTTS', name: 'Both Teams To Score', nameFa: 'گل هر دو تیم', basis: 'FULL_TIME',
    requiresStatus: ['finished'], voidOnAbandoned: true, voidOnIncompletePeriod: true,
    resolver: 'resolveBTTS', requires: ['homeScore', 'awayScore'], isLive: true,
  },
  HANDICAP: {
    type: 'HANDICAP', key: 'HCP', name: 'Handicap', nameFa: 'هندیکپ', basis: 'FULL_TIME',
    requiresStatus: ['finished'], voidOnAbandoned: true, voidOnIncompletePeriod: true,
    resolver: 'resolveHandicap', requires: ['homeScore', 'awayScore'], isLive: true,
  },
  ASIAN_HANDICAP: {
    type: 'ASIAN_HANDICAP', key: 'AH', name: 'Asian Handicap', nameFa: 'هندیکپ آسیایی', basis: 'FULL_TIME',
    requiresStatus: ['finished'], voidOnAbandoned: true, voidOnIncompletePeriod: true,
    resolver: 'resolveAsianHandicap', requires: ['homeScore', 'awayScore'], isLive: true,
  },
  CORRECT_SCORE: {
    type: 'CORRECT_SCORE', key: 'CS', name: 'Correct Score', nameFa: 'نتیجه دقیق', basis: 'FULL_TIME',
    requiresStatus: ['finished'], voidOnAbandoned: true, voidOnIncompletePeriod: true,
    resolver: 'resolveCorrectScore', requires: ['homeScore', 'awayScore'], isLive: false,
  },
  HALF_TIME: {
    type: 'HALF_TIME', key: 'HT', name: 'First Half Result', nameFa: 'نتیجه نیمه اول', basis: 'FIRST_HALF',
    requiresStatus: ['finished'], voidOnAbandoned: true, voidOnIncompletePeriod: true,
    resolver: 'resolveHalfTime', requires: ['homeHalfScore', 'awayHalfScore'], isLive: true,
  },
  DOUBLE_CHANCE_H1: {
    type: 'DOUBLE_CHANCE', key: 'DOUBLE_CHANCE_H1', name: 'Double Chance - 1st Half', nameFa: 'شانس دوگانه - نیمه اول', basis: 'FIRST_HALF',
    requiresStatus: ['finished'], voidOnAbandoned: true, voidOnIncompletePeriod: true,
    resolver: 'resolveDoubleChance', requires: ['homeHalfScore', 'awayHalfScore'], isLive: true,
  },
  DRAW_NO_BET_H1: {
    type: 'DRAW_NO_BET', key: 'DRAW_NO_BET_H1', name: 'Draw No Bet - 1st Half', nameFa: 'بدون Draw - نیمه اول', basis: 'FIRST_HALF',
    requiresStatus: ['finished'], voidOnAbandoned: true, voidOnIncompletePeriod: true,
    resolver: 'resolveDrawNoBet', requires: ['homeHalfScore', 'awayHalfScore'], isLive: true,
  },
  BTTS_H1: {
    type: 'BTTS', key: 'BTTS_H1', name: 'Both Teams To Score - 1st Half', nameFa: 'گل هر دو تیم - نیمه اول', basis: 'FIRST_HALF',
    requiresStatus: ['finished'], voidOnAbandoned: true, voidOnIncompletePeriod: true,
    resolver: 'resolveBTTS', requires: ['homeHalfScore', 'awayHalfScore'], isLive: true,
  },
  OVER_UNDER_H1: {
    type: 'OVER_UNDER', key: 'OU_H1', name: 'Total Goals - 1st Half', nameFa: 'مجموع گل‌ها - نیمه اول', basis: 'FIRST_HALF',
    requiresStatus: ['finished'], voidOnAbandoned: true, voidOnIncompletePeriod: true,
    resolver: 'resolveOverUnder', requires: ['homeHalfScore', 'awayHalfScore'], isLive: true,
  },
  ASIAN_HANDICAP_H1: {
    type: 'ASIAN_HANDICAP', key: 'AH_H1', name: 'Asian Handicap - 1st Half', nameFa: 'هندیکپ آسیایی - نیمه اول', basis: 'FIRST_HALF',
    requiresStatus: ['finished'], voidOnAbandoned: true, voidOnIncompletePeriod: true,
    resolver: 'resolveAsianHandicap', requires: ['homeHalfScore', 'awayHalfScore'], isLive: true,
  },
  CORRECT_SCORE_H1: {
    type: 'CORRECT_SCORE', key: 'CS_H1', name: 'Correct Score - 1st Half', nameFa: 'نتیجه دقیق - نیمه اول', basis: 'FIRST_HALF',
    requiresStatus: ['finished'], voidOnAbandoned: true, voidOnIncompletePeriod: true,
    resolver: 'resolveCorrectScore', requires: ['homeHalfScore', 'awayHalfScore'], isLive: false,
  },
  HT_FT: {
    type: 'HT_FT', key: 'HT_FT', name: 'Half Time / Full Time', nameFa: 'نیمه اول/پایان', basis: 'FULL_TIME',
    requiresStatus: ['finished'], voidOnAbandoned: true, voidOnIncompletePeriod: true,
    resolver: 'resolveHtFt', requires: ['homeHalfScore', 'awayHalfScore', 'homeScore', 'awayScore'], isLive: false,
  },
  TOTAL_CORNERS: {
    type: 'TOTAL_CORNERS', key: 'CORNERS', name: 'Total Corners', nameFa: 'کرنرها', basis: 'FULL_TIME',
    requiresStatus: ['finished'], voidOnAbandoned: true, voidOnIncompletePeriod: true,
    resolver: 'resolveTotalCorners', requires: ['homeCorners', 'awayCorners'], isLive: true,
  },
  TOTAL_CARDS: {
    type: 'TOTAL_CARDS', key: 'CARDS', name: 'Total Cards', nameFa: 'کارت‌ها', basis: 'FULL_TIME',
    requiresStatus: ['finished'], voidOnAbandoned: true, voidOnIncompletePeriod: true,
    resolver: 'resolveTotalCards', requires: ['homeCards', 'awayCards'], isLive: true,
  },
  TEAM_TOTAL_GOALS: {
    type: 'TEAM_TOTAL_GOALS', key: 'TEAM_GOALS', name: 'Team Total Goals', nameFa: 'گل‌های تیم', basis: 'FULL_TIME',
    requiresStatus: ['finished'], voidOnAbandoned: true, voidOnIncompletePeriod: true,
    resolver: 'resolveTeamTotalGoals', requires: ['homeScore', 'awayScore'], isLive: true,
  },
  PLAYER_MARKET: {
    type: 'PLAYER_MARKET', key: 'PLAYER', name: 'Player Market', nameFa: 'Openیکن', basis: 'FULL_TIME',
    requiresStatus: ['finished'], voidOnAbandoned: true, voidOnIncompletePeriod: true,
    resolver: 'resolvePlayerMarket', isLive: false,
  },
};

/**
 * Resolve a rule by market type ("OVER_UNDER"), provider key ("OU"), or a parameterised
 * key such as "OU_FULL_TIME_2_5" / "OU_FULL_TIME_2_5_OVER". Lookup is by type, by short
 * key, then by longest matching prefix (so the most specific rule wins).
 */
const RULES_BY_KEY: Record<string, MarketRule> = Object.values(MARKET_RULES).reduce<Record<string, MarketRule>>(
  (acc, rule) => { acc[rule.key] = rule; return acc; }, {},
);

const PROVIDER_MARKET_RULE_ALIASES: Record<string, keyof typeof MARKET_RULES> = {
  H2H: '1X2',
  '1X2': '1X2',
  H2H_3_WAY: '1X2',
  H2H_H1: 'HALF_TIME',
  H2H_3_WAY_H1: 'HALF_TIME',

  DOUBLE_CHANCE: 'DOUBLE_CHANCE',
  DOUBLE_CHANCE_H1: 'DOUBLE_CHANCE_H1',

  DRAW_NO_BET: 'DRAW_NO_BET',
  DRAW_NO_BET_H1: 'DRAW_NO_BET_H1',

  BTTS: 'BTTS',
  BTTS_H1: 'BTTS_H1',

  TOTALS: 'OVER_UNDER',
  ALTERNATE_TOTALS: 'OVER_UNDER',
  TOTALS_H1: 'OVER_UNDER_H1',
  ALTERNATE_TOTALS_H1: 'OVER_UNDER_H1',

  SPREADS: 'ASIAN_HANDICAP',
  ALTERNATE_SPREADS: 'ASIAN_HANDICAP',
  SPREADS_H1: 'ASIAN_HANDICAP_H1',
  ALTERNATE_SPREADS_H1: 'ASIAN_HANDICAP_H1',

  CORRECT_SCORE: 'CORRECT_SCORE',
  CORRECT_SCORE_H1: 'CORRECT_SCORE_H1',

  HALFTIME_FULLTIME: 'HT_FT',
  GOAL_LINE: 'OVER_UNDER',
  GOAL_LINE_FIXED: 'OVER_UNDER',
  GOAL_LINE_HALF: 'OVER_UNDER_H1',
  ASIAN_HANDICAP_HALF: 'ASIAN_HANDICAP_H1',
  CORNER_LINE: 'TOTAL_CORNERS',
  CORNER_LINE_HALF: 'TOTAL_CORNERS',
};

export function marketRuleFor(marketKeyOrType: string): MarketRule | null {
  const upper = marketKeyOrType.trim().toUpperCase();

  const alias = PROVIDER_MARKET_RULE_ALIASES[upper];
  if (alias) return MARKET_RULES[alias] ?? null;

  const direct =
    MARKET_RULES[marketKeyOrType] ??
    MARKET_RULES[upper] ??
    RULES_BY_KEY[upper];

  if (direct) return direct;

  // Only allow prefix matching for NOVA's own parameterised rule keys.
  // Never infer provider-specific markets such as alternate_spreads_corners
  // from a generic prefix such as ALTERNATE_SPREADS.
  const parameterPrefixes = [
    'OU_',
    'HCP_',
    'AH_',
    'CS_',
    'TEAM_GOALS_',
  ];

  if (!parameterPrefixes.some((prefix) => upper.startsWith(prefix))) {
    return null;
  }

  const candidates = [...Object.keys(MARKET_RULES), ...Object.keys(RULES_BY_KEY)]
    .filter((k) => upper.startsWith(k))
    .sort((a, b) => b.length - a.length);

  const best = candidates[0];
  return best ? (MARKET_RULES[best] ?? RULES_BY_KEY[best] ?? null) : null;
}

/** All rules, for admin screens and traceability documentation. */
export function allMarketRules(): MarketRule[] {
  return Object.values(MARKET_RULES);
}

/* ------------------------------------------------------------------ *
 * Eligibility / state machine                                        *
 * ------------------------------------------------------------------ */

export interface OpenCheckInput {
  rule: MarketRule;
  matchStatus: MatchStatus;
  now: Date;
  scheduledAt: Date;
  isLive: boolean;
  liveBettingEnabled: boolean;
  prematchBettingEnabled: boolean;
}

export type MarketGate = { allowed: true } | { allowed: false; reason: string; code: string };

export function checkMarketGate(input: OpenCheckInput): MarketGate {
  const { rule, matchStatus, now, scheduledAt, liveBettingEnabled, prematchBettingEnabled } = input;
  if (matchStatus === 'finished') return { allowed: false, reason: 'Match finished', code: 'MATCH_FINISHED' };
  if (matchStatus === 'cancelled' || matchStatus === 'abandoned') return { allowed: false, reason: 'Match cancelled', code: 'MATCH_FINISHED' };
  if (matchStatus === 'postponed' || matchStatus === 'interrupted') return { allowed: false, reason: 'Match suspended', code: 'MATCH_POSTPONED' };
  if (matchStatus === 'live' || matchStatus === 'paused') {
    if (!liveBettingEnabled) return { allowed: false, reason: 'Live betting is currently unavailable', code: 'LIVE_BETTING_DISABLED' };
    if (!rule.isLive) return { allowed: false, reason: 'This market is not offered in-play', code: 'MARKET_SUSPENDED' };
    return { allowed: true };
  }
  if (!prematchBettingEnabled) return { allowed: false, reason: 'Pre-match betting is currently unavailable', code: 'PREMATCH_BETTING_DISABLED' };
  // Pre-match cutoff: markets freeze at kick-off.
  if (now.getTime() >= scheduledAt.getTime()) {
    return { allowed: false, reason: 'Kick-off reached', code: 'MARKET_CLOSED' };
  }
  return { allowed: true };
}

/* ------------------------------------------------------------------ *
 * Result mapping                                                     *
 * ------------------------------------------------------------------ */

export interface SelectionGradeInput {
  rule: MarketRule;
  selection: Pick<Selection, 'code' | 'line' | 'participantType'>;
  result: MatchResult;
  matchStatus: MatchStatus;
}

export interface SelectionGrade {
  grade: LegGrade;
  reason: string;
}

const VOID_STATUSES: MatchStatus[] = ['cancelled', 'abandoned', 'postponed', 'interrupted'];

function requireFacts(rule: MarketRule, result: MatchResult): string | null {
  if (!rule.requires) return null;
  for (const field of rule.requires) {
    if (result[field] === null || result[field] === undefined) return `MISSING_RESULT_FACT: ${field}`;
  }
  return null;
}

/** Parse a line ("2.5", "-1", "+1.5") to an exact quarter-unit integer (x100). */
export function parseLine(line: string | null): number | null {
  if (line === null) return null;
  const cleaned = line.replace('+', '').trim();
  if (!/^-?\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 100);
}

function totalGoals(result: MatchResult, half: boolean): number | null {
  if (half) {
    if (result.homeHalfScore === null || result.awayHalfScore === null) return null;
    return result.homeHalfScore + result.awayHalfScore;
  }
  if (result.homeScore === null || result.awayScore === null) return null;
  return result.homeScore + result.awayScore;
}

/**
 * Grades a single selection. Returns PENDING when the result is not final,
 * MANUAL_REVIEW when facts are missing/ambiguous - never a guess.
 */
export function gradeSelection(input: SelectionGradeInput): SelectionGrade {
  const { rule, selection, result, matchStatus } = input;

  if (VOID_STATUSES.includes(matchStatus)) {
    return rule.voidOnAbandoned
      ? { grade: 'VOID', reason: `MATCH_${matchStatus.toUpperCase()}` }
      : { grade: 'MANUAL_REVIEW', reason: 'VOID_RULE_REQUIRES_OPERATOR' };
  }
  if (matchStatus !== 'finished') return { grade: 'PENDING', reason: 'MATCH_NOT_FINISHED' };

  const missing = requireFacts(rule, result);
  if (missing) return { grade: 'MANUAL_REVIEW', reason: missing };

  const h = result.homeScore as number;
  const a = result.awayScore as number;
  const code = selection.code.toUpperCase();

  switch (rule.resolver) {
    case 'resolve1X2': {
      if (code === 'HOME') return h > a ? won('HOME_WIN') : lost('HOME_LOSE');
      if (code === 'DRAW') return h === a ? won('DRAW') : lost('NO_DRAW');
      if (code === 'AWAY') return a > h ? won('AWAY_WIN') : lost('AWAY_LOSE');
      return { grade: 'MANUAL_REVIEW', reason: `UNKNOWN_SELECTION_CODE:${code}` };
    }
    case 'resolveDoubleChance': {
      const draw = h === a;
      if (code === 'HOME_OR_DRAW') return h >= a ? won('DC_1X') : lost('DC_1X');
      if (code === 'AWAY_OR_DRAW') return a >= h ? won('DC_X2') : lost('DC_X2');
      if (code === 'HOME_OR_AWAY') return !draw ? won('DC_12') : lost('DC_12');
      return { grade: 'MANUAL_REVIEW', reason: `UNKNOWN_SELECTION_CODE:${code}` };
    }
    case 'resolveDrawNoBet': {
      if (h === a) return { grade: 'VOID', reason: 'DRAW_NO_BET_DRAW' };
      if (code === 'HOME') return h > a ? won('DNB_HOME') : lost('DNB_HOME');
      if (code === 'AWAY') return a > h ? won('DNB_AWAY') : lost('DNB_AWAY');
      return { grade: 'MANUAL_REVIEW', reason: `UNKNOWN_SELECTION_CODE:${code}` };
    }
    case 'resolveOverUnder': {
      const line = parseLine(selection.line);
      if (line === null) return { grade: 'MANUAL_REVIEW', reason: 'MISSING_OR_INVALID_LINE' };
      const goals = totalGoals(result, rule.basis === 'FIRST_HALF');
      if (goals === null) return { grade: 'MANUAL_REVIEW', reason: 'MISSING_SCORE' };
      const goalsX100 = goals * 100;
      const isOver = code.startsWith('OVER') || code === 'O';
      const isUnder = code.startsWith('UNDER') || code === 'U';
      if (!isOver && !isUnder) return { grade: 'MANUAL_REVIEW', reason: `UNKNOWN_SELECTION_CODE:${code}` };
      if (goalsX100 === line) return { grade: 'VOID', reason: 'EXACT_LINE_PUSH' };
      const overWon = goalsX100 > line;
      const won_ = isOver ? overWon : !overWon;
      return won_ ? won('OU') : lost('OU');
    }
    case 'resolveBTTS': {
      const yes = code === 'YES';
      const no = code === 'NO';
      if (!yes && !no) return { grade: 'MANUAL_REVIEW', reason: `UNKNOWN_SELECTION_CODE:${code}` };
      const both = h > 0 && a > 0;
      return (yes ? both : !both) ? won('BTTS') : lost('BTTS');
    }
    case 'resolveHandicap':
    case 'resolveAsianHandicap': {
      const line = parseLine(selection.line);
      if (line === null) return { grade: 'MANUAL_REVIEW', reason: 'MISSING_OR_INVALID_LINE' };
      const isHome = code === 'HOME' || code === '1';
      const isAway = code === 'AWAY' || code === '2';
      if (!isHome && !isAway) return { grade: 'MANUAL_REVIEW', reason: `UNKNOWN_SELECTION_CODE:${code}` };
      const marginX100 = (h - a) * 100;
      const adjusted = isHome ? marginX100 + line : -marginX100 + line;
      if (Math.abs(line) % 50 !== 0 && rule.resolver === 'resolveHandicap') {
        // Whole/half lines only for standard handicap.
        return { grade: 'MANUAL_REVIEW', reason: 'INVALID_HANDICAP_LINE' };
      }
      if (rule.resolver === 'resolveAsianHandicap') {
        // Quarter lines (-0.25, +0.75) split the stake into two half-bets.
        if (adjusted > 0 && adjusted < 50) return { grade: 'HALF_WON', reason: 'AH_QUARTER_SPLIT' };
        if (adjusted < 0 && adjusted > -50) return { grade: 'HALF_LOST', reason: 'AH_QUARTER_SPLIT' };
      }
      if (adjusted > 0) return won('HANDICAP');
      if (adjusted < 0) return lost('HANDICAP');
      return { grade: 'VOID', reason: 'HANDICAP_PUSH' };
    }
    case 'resolveCorrectScore': {
      if (!/^\d+-\d+$/.test(code)) return { grade: 'MANUAL_REVIEW', reason: `UNKNOWN_SELECTION_CODE:${code}` };
      const [ch, ca] = code.split('-').map(Number) as [number, number];
      return ch === h && ca === a ? won('CS') : lost('CS');
    }
    case 'resolveHalfTime': {
      const hh = result.homeHalfScore as number;
      const ah = result.awayHalfScore as number;
      if (code === 'HOME') return hh > ah ? won('HT') : lost('HT');
      if (code === 'DRAW') return hh === ah ? won('HT') : lost('HT');
      if (code === 'AWAY') return ah > hh ? won('HT') : lost('HT');
      return { grade: 'MANUAL_REVIEW', reason: `UNKNOWN_SELECTION_CODE:${code}` };
    }
    case 'resolveHtFt': {
      const hh = result.homeHalfScore as number;
      const ah = result.awayHalfScore as number;
      const ht = hh > ah ? 'HOME' : hh < ah ? 'AWAY' : 'DRAW';
      const ft = h > a ? 'HOME' : h < a ? 'AWAY' : 'DRAW';
      const expected = `${ht}_${ft}`;
      return code === expected ? won('HTFT') : lost('HTFT');
    }
    case 'resolveTotalCorners': {
      const line = parseLine(selection.line);
      if (line === null) return { grade: 'MANUAL_REVIEW', reason: 'MISSING_OR_INVALID_LINE' };
      const total = (result.homeCorners as number) + (result.awayCorners as number);
      const isOver = code.startsWith('OVER');
      if (total * 100 === line) return { grade: 'VOID', reason: 'EXACT_LINE_PUSH' };
      const overWon = total * 100 > line;
      return (isOver ? overWon : !overWon) ? won('CORNERS') : lost('CORNERS');
    }
    case 'resolveTotalCards': {
      const line = parseLine(selection.line);
      if (line === null) return { grade: 'MANUAL_REVIEW', reason: 'MISSING_OR_INVALID_LINE' };
      const total = (result.homeCards as number) + (result.awayCards as number);
      const isOver = code.startsWith('OVER');
      if (total * 100 === line) return { grade: 'VOID', reason: 'EXACT_LINE_PUSH' };
      const overWon = total * 100 > line;
      return (isOver ? overWon : !overWon) ? won('CARDS') : lost('CARDS');
    }
    case 'resolveTeamTotalGoals': {
      const line = parseLine(selection.line);
      if (line === null) return { grade: 'MANUAL_REVIEW', reason: 'MISSING_OR_INVALID_LINE' };
      const isHome = code.startsWith('HOME');
      const value = isHome ? h * 100 : a * 100;
      if (value === line) return { grade: 'VOID', reason: 'EXACT_LINE_PUSH' };
      const overWon = code.includes('OVER') ? value > line : value < line;
      return overWon ? won('TEAM_TOTAL') : lost('TEAM_TOTAL');
    }
    case 'resolvePlayerMarket':
      // Provider-dependent player stats are not available in this deployment.
      return { grade: 'MANUAL_REVIEW', reason: 'PLAYER_MARKET_REQUIRES_OPERATOR' };
    default:
      return { grade: 'MANUAL_REVIEW', reason: `NO_RESOLVER:${rule.resolver}` };
  }
}

function won(reason: string): SelectionGrade { return { grade: 'WON', reason }; }
function lost(reason: string): SelectionGrade { return { grade: 'LOST', reason }; }

/* ------------------------------------------------------------------ *
 * Market status transitions                                          *
 * ------------------------------------------------------------------ */

const MARKET_TRANSITIONS: Record<string, string[]> = {
  open: ['suspended', 'closed', 'void'],
  suspended: ['open', 'closed', 'void'],
  closed: ['settled', 'manual_review', 'open'],
  settled: ['manual_review'],
  void: [],
  manual_review: ['settled', 'void'],
};

export function canTransitionMarket(from: string, to: string): boolean {
  if (from === to) return false;
  return (MARKET_TRANSITIONS[from] ?? []).includes(to);
}

export function assertMarketTransition(from: string, to: string): void {
  if (!canTransitionMarket(from, to)) {
    throw new Error(`INVALID_MARKET_TRANSITION:${from}->${to}`);
  }
}

export function marketDisplayOrder(type: MarketType): number {
  const order: Partial<Record<MarketType, number>> = {
    '1X2': 10, DOUBLE_CHANCE: 20, OVER_UNDER: 30, BTTS: 40, DRAW_NO_BET: 50,
    HANDICAP: 60, ASIAN_HANDICAP: 70, HALF_TIME: 80, HT_FT: 90,
    TOTAL_CORNERS: 100, TOTAL_CARDS: 110, TEAM_TOTAL_GOALS: 120,
    CORRECT_SCORE: 200, PLAYER_MARKET: 300,
  };
  return order[type] ?? 500;
}

export function isMarketSettleable(market: Pick<Market, 'status'>): boolean {
  return market.status === 'open' || market.status === 'suspended' || market.status === 'closed';
}
