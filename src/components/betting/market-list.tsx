'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useApp } from '@/components/layout/providers';
import { translateVisibleText } from '@/lib/i18n/ui-phrases';
import { formatOddsScaled } from '@/lib/i18n';
import { useBetSlip, type SlipItem } from '@/lib/store/betslip';
import type { MarketView, MatchView } from './match-card';

type MarketCategory =
  | 'all'
  | 'main'
  | 'goals'
  | 'total_goals'
  | 'points'
  | 'total_points'
  | 'runs'
  | 'total_runs'
  | 'handicap'
  | 'first_half'
  | 'second_half'
  | 'halves'
  | 'q1'
  | 'q2'
  | 'q3'
  | 'q4'
  | 'periods'
  | 'innings'
  | 'sets'
  | 'games'
  | 'total_games'
  | 'corners'
  | 'cards'
  | 'correct_score'
  | 'method'
  | 'rounds'
  | 'var'
  | 'other';

function getCategoryItems(
  sportKey: string,
  available: Set<MarketCategory>,
): Array<{ key: MarketCategory; label: string }> {
  const sport = sportKey.trim().toLowerCase();

  const isFootball =
    sport === 'football' || sport.includes('soccer');
  const isBasketball =
    sport.includes('basketball') ||
    sport === 'nba' ||
    sport.includes('ncaab');
  const isTennis = sport.includes('tennis');
  const isVolleyball = sport.includes('volleyball');
  const isHandball = sport.includes('handball');
  const isBaseball = sport.includes('baseball');
  const isHockey =
    sport.includes('ice-hockey') ||
    sport.includes('hockey');
  const isAmericanFootball =
    sport.includes('american-football') ||
    sport === 'nfl';
  const isCricket = sport.includes('cricket');
  const isBoxing = sport.includes('boxing');
  const isMma =
    sport === 'mma' ||
    sport.includes('mixed-martial');

  let order: MarketCategory[];

  if (isFootball) {
    order = [
      'all',
      'main',
      'goals',
      'total_goals',
      'handicap',
      'first_half',
      'second_half',
      'halves',
      'corners',
      'cards',
      'correct_score',
      'var',
      'other',
    ];
  } else if (isBasketball || isAmericanFootball) {
    order = [
      'all',
      'main',
      'points',
      'total_points',
      'handicap',
      'q1',
      'q2',
      'q3',
      'q4',
      'periods',
      'other',
    ];
  } else if (isTennis) {
    order = [
      'all',
      'main',
      'sets',
      'games',
      'total_games',
      'handicap',
      'other',
    ];
  } else if (isVolleyball) {
    order = [
      'all',
      'main',
      'sets',
      'points',
      'total_points',
      'handicap',
      'other',
    ];
  } else if (isHandball) {
    order = [
      'all',
      'main',
      'goals',
      'total_goals',
      'handicap',
      'first_half',
      'second_half',
      'halves',
      'other',
    ];
  } else if (isBaseball) {
    order = [
      'all',
      'main',
      'runs',
      'total_runs',
      'handicap',
      'innings',
      'other',
    ];
  } else if (isHockey) {
    order = [
      'all',
      'main',
      'goals',
      'total_goals',
      'handicap',
      'periods',
      'other',
    ];
  } else if (isCricket) {
    order = [
      'all',
      'main',
      'runs',
      'total_runs',
      'innings',
      'other',
    ];
  } else if (isBoxing || isMma) {
    order = [
      'all',
      'main',
      'method',
      'rounds',
      'other',
    ];
  } else {
    order = [
      'all',
      'main',
      'goals',
      'total_goals',
      'points',
      'total_points',
      'runs',
      'total_runs',
      'handicap',
      'first_half',
      'second_half',
      'halves',
      'periods',
      'sets',
      'games',
      'total_games',
      'innings',
      'rounds',
      'method',
      'corners',
      'cards',
      'correct_score',
      'var',
      'other',
    ];
  }

  const labels: Record<MarketCategory, string> = {
    all: 'All',
    main: 'Main',
    goals: 'Goals',
    total_goals: 'Total Goals',
    points: 'Points',
    total_points: 'Total Points',
    runs: 'Runs',
    total_runs: 'Total Runs',
    handicap: 'Handicap',
    first_half: '1st Half',
    second_half: '2nd Half',
    halves: 'Halves',
    q1: 'Q1',
    q2: 'Q2',
    q3: 'Q3',
    q4: 'Q4',
    periods: 'Periods',
    innings: 'Innings',
    sets: 'Sets',
    games: 'Games',
    total_games: 'Total Games',
    corners: 'Corners',
    cards: 'Cards',
    correct_score: 'Correct Score',
    method: 'Method',
    rounds: 'Rounds',
    var: 'VAR',
    other: 'Other',
  };

  return order
    .filter((key) => available.has(key))
    .map((key) => ({
      key,
      label: labels[key],
    }));
}

function formatMarketSpecifier(specifier: string | null | undefined) {
  const value = specifier?.trim();
  if (!value) return null;

  const numeric = Number(value);

  if (!Number.isNaN(numeric)) {
    if (Object.is(numeric, -0)) return '0';
    return numeric > 0 ? `+${value}` : value;
  }

  return value;
}

function getSportFamily(sportKey: string) {
  const sport = sportKey.trim().toLowerCase();
  if (sport === 'football' || sport.includes('soccer')) return 'football';
  if (sport.includes('basketball') || sport === 'nba' || sport.includes('ncaab')) return 'basketball';
  if (sport.includes('tennis')) return 'tennis';
  if (sport.includes('volleyball')) return 'volleyball';
  if (sport.includes('handball')) return 'handball';
  if (sport.includes('baseball')) return 'baseball';
  if (sport.includes('ice-hockey') || sport.includes('hockey')) return 'hockey';
  if (sport.includes('american-football') || sport === 'nfl') return 'american-football';
  if (sport.includes('cricket')) return 'cricket';
  if (sport.includes('boxing')) return 'boxing';
  if (sport === 'mma' || sport.includes('mixed-martial')) return 'mma';
  return 'other';
}

function normalizeDisplayLabel(value: string | null | undefined) {
  return String(value ?? '')
    .replace(/\bTeam[ _-]*A\b/gi, 'Team 1')
    .replace(/\bTeam[ _-]*B\b/gi, 'Team 2')
    .replace(/\bteam_a\b/gi, 'Team 1')
    .replace(/\bteam_b\b/gi, 'Team 2')
    .replace(/\bTeam[ _-]*1\b/gi, 'Team 1')
    .replace(/\bTeam[ _-]*2\b/gi, 'Team 2')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function getTeamDisplayName(match: MatchView, code: string, fallback: string) {
  const normalizedCode = code.trim().toUpperCase();
  const home = match.participants.find((participant) => participant.role === 'HOME');
  const away = match.participants.find((participant) => participant.role === 'AWAY');

  if (normalizedCode === 'HOME' || normalizedCode === 'A') {
    return home?.name?.trim() || 'Team 1';
  }

  if (normalizedCode === 'AWAY' || normalizedCode === 'B') {
    return away?.name?.trim() || 'Team 2';
  }

  if (normalizedCode === 'DRAW') return 'Draw';

  return normalizeDisplayLabel(fallback);
}

function getSelectionDisplayName(
  match: MatchView,
  selection: MarketView['selections'][number],
) {
  const code = String(selection.code ?? '').trim().toUpperCase();

  if (code === 'HOME' || code === 'A') {
    return getTeamDisplayName(match, 'HOME', selection.name || selection.code);
  }

  if (code === 'AWAY' || code === 'B') {
    return getTeamDisplayName(match, 'AWAY', selection.name || selection.code);
  }

  if (code === 'DRAW') return 'Draw';

  let label = normalizeDisplayLabel(selection.name || selection.code);

  if (/^HOME$/i.test(label)) {
    label = getTeamDisplayName(match, 'HOME', label);
  } else if (/^AWAY$/i.test(label)) {
    label = getTeamDisplayName(match, 'AWAY', label);
  } else if (/^A$/i.test(label)) {
    label = getTeamDisplayName(match, 'HOME', label);
  } else if (/^B$/i.test(label)) {
    label = getTeamDisplayName(match, 'AWAY', label);
  }

  return label || selection.code || 'Selection';
}

function getMarketTitle(market: MarketView, sportKey = '') {
  const key = market.key.trim().toLowerCase();
  const specifier = formatMarketSpecifier(market.specifier);
  const family = getSportFamily(sportKey);

  const withLine = (title: string) =>
    specifier ? `${title} ${specifier}` : title;

  const quarterMatch = key.match(/^(h2h|spreads|totals)_q([1-4])$/);
  if (quarterMatch) {
    const base = quarterMatch[1];
    const quarter = `Q${quarterMatch[2]}`;

    if (base === 'h2h') {
      return family === 'american-football'
        ? `${quarter} Moneyline`
        : family === 'basketball'
          ? `${quarter} Moneyline`
          : `${quarter} Match Winner`;
    }

    if (base === 'spreads') {
      return family === 'american-football'
        ? withLine(`${quarter} Point Spread`)
        : family === 'basketball'
          ? withLine(`${quarter} Point Spread`)
          : withLine(`${quarter} Handicap`);
    }

    return family === 'american-football'
      ? withLine(`${quarter} Total Points`)
      : family === 'basketball'
        ? withLine(`${quarter} Total Points`)
        : withLine(`${quarter} Total`);
  }

  const firstFiveMatch = key.match(
    /^(h2h|spreads|totals)_1st_5_innings$/,
  );

  if (firstFiveMatch && family === 'baseball') {
    const base = firstFiveMatch[1];

    if (base === 'h2h') return 'First 5 Innings Moneyline';
    if (base === 'spreads') return withLine('First 5 Innings Run Line');
    return withLine('First 5 Innings Total Runs');
  }

  if (key === 'h2h') {
    if (
      family === 'basketball' ||
      family === 'baseball' ||
      family === 'american-football'
    ) {
      return 'Moneyline';
    }

    if (family === 'boxing' || family === 'mma') {
      return 'Fight Winner';
    }

    return 'Match Winner';
  }

  if (key === 'h2h_lay') {
    return family === 'basketball' ||
      family === 'baseball' ||
      family === 'american-football'
      ? 'Moneyline (Lay)'
      : 'Match Winner (Lay)';
  }

  if (key === 'draw_no_bet') return 'Draw No Bet';

  if (key === 'double_chance') return 'Double Chance';

  if (key === 'double_chance_h1') {
    return 'Double Chance - 1st Half';
  }

  if (key === 'btts') return 'Both Teams To Score';

  if (key === 'btts_h1') {
    return 'Both Teams To Score - 1st Half';
  }

  if (key === 'correct_score') return 'Correct Score';

  if (key === 'correct_score_h1') {
    return 'Correct Score - 1st Half';
  }

  if (key === 'halftime_fulltime') {
    return 'Half Time / Full Time';
  }

  if (key === 'to_qualify') return 'To Qualify';

  if (key === 'corners_1x2') return 'Corners 1X2';

  if (key === 'cards_1x2') return 'Cards 1X2';

  if (
    key === 'spreads' ||
    key === 'handicap' ||
    key === 'asian_handicap'
  ) {
    const label =
      family === 'football'
        ? 'Asian Handicap'
        : family === 'basketball' || family === 'american-football'
          ? 'Point Spread'
          : family === 'baseball' || family === 'cricket'
            ? 'Run Line'
            : family === 'hockey'
              ? 'Puck Line'
              : family === 'tennis'
                ? 'Game Handicap'
                : family === 'volleyball'
                  ? 'Set Handicap'
                  : family === 'handball'
                    ? 'Goal Handicap'
                    : 'Handicap';

    return withLine(label);
  }

  if (
    key === 'alternate_spreads' ||
    key === 'alternate_handicap' ||
    key === 'alternate_asian_handicap'
  ) {
    const label =
      family === 'football'
        ? 'Alternate Asian Handicap'
        : family === 'basketball' || family === 'american-football'
          ? 'Alternate Point Spread'
          : family === 'baseball' || family === 'cricket'
            ? 'Alternate Run Line'
            : family === 'hockey'
              ? 'Alternate Puck Line'
              : family === 'tennis'
                ? 'Alternate Game Handicap'
                : family === 'volleyball'
                  ? 'Alternate Set Handicap'
                  : family === 'handball'
                    ? 'Alternate Goal Handicap'
                    : 'Alternate Handicap';

    return withLine(label);
  }

  if (key === 'alternate_spreads_corners') {
    return withLine('Alternate Corner Handicap');
  }

  if (key === 'alternate_spreads_cards') {
    return withLine('Alternate Card Handicap');
  }

  if (key === 'alternate_totals_corners') {
    return withLine('Alternate Total Corners');
  }

  if (key === 'alternate_totals_cards') {
    return withLine('Alternate Total Cards');
  }

  if (key === 'alternate_team_totals_corners') {
    return withLine('Alternate Team Corners');
  }

  if (
    key === 'totals' ||
    key === 'ou' ||
    key === 'alternate_totals' ||
    key === 'alternate_ou'
  ) {
    const alternate = key.startsWith('alternate_');

    const label =
      family === 'football' ||
      family === 'handball' ||
      family === 'hockey'
        ? 'Total Goals'
        : family === 'basketball' ||
            family === 'volleyball' ||
            family === 'american-football'
          ? 'Total Points'
          : family === 'tennis'
            ? 'Total Games'
            : family === 'baseball' || family === 'cricket'
              ? 'Total Runs'
              : family === 'boxing' || family === 'mma'
                ? 'Total Rounds'
                : 'Total';

    return withLine(alternate ? `Alternate ${label}` : label);
  }

  if (key === 'team_totals' || key.includes('team_total')) {
    const label =
      family === 'football' || family === 'handball' || family === 'hockey'
        ? 'Team Total Goals'
        : family === 'basketball' || family === 'volleyball' || family === 'american-football'
          ? 'Team Total Points'
          : family === 'baseball' || family === 'cricket'
            ? 'Team Total Runs'
            : family === 'tennis'
              ? 'Team Total Games'
              : 'Team Total';

    const rawName = normalizeDisplayLabel(market.name);

    if (
      rawName &&
      rawName.toLowerCase() !== key &&
      rawName.toLowerCase() !== key.replace(/_/g, ' ')
    ) {
      return rawName;
    }

    return withLine(label);
  }

  const humanized = normalizeDisplayLabel(market.name || market.key)
    .replace(/^(alternate_)/i, 'Alternate ')
    .replace(/_/g, ' ')
    .replace(/\bq([1-4])\b/gi, 'Q$1')
    .replace(/\b1st 5 innings\b/gi, 'First 5 Innings')
    .replace(/\b1x2\b/gi, '1X2')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return humanized || 'Market';
}


function translateMarketDisplayLabel(value: string) {
  let label = String(value ?? '').trim();
  if (!label) return label;

  const exact: Record<string, string> = {
    'Market': 'Market',
    'Match Winner': 'Match Winner',
    'Moneyline': 'Moneyline',
    'Moneyline (Lay)': 'Moneyline (Lay)',
    'Match Winner (Lay)': 'Match Winner (Lay)',
    'Fight Winner': 'Fight Winner',
    'Draw No Bet': 'Draw No Bet',
    'Double Chance': 'Double Chance',
    'Both Teams To Score': 'Both Teams To Score',
    'Correct Score': 'Correct Score',
    'Half Time / Full Time': 'Half Time / Full Time',
    'To Qualify': 'To Qualify',
    'Corners': 'Corners',
    'Cards': 'Cards',
    'Corners 1X2': 'Corners 1X2',
    'Cards 1X2': 'Cards 1X2',
    'Asian Handicap': 'Asian Handicap',
    'Point Spread': 'Point Spread',
    'Run Line': 'Run Line',
    'Puck Line': 'Puck Line',
    'Game Handicap': 'Game Handicap',
    'Set Handicap': 'Set Handicap',
    'Goal Handicap': 'Goal Handicap',
    'Handicap': 'Handicap',
    'Alternate Asian Handicap': 'Alternate Asian Handicap',
    'Alternate Point Spread': 'Alternate Point Spread',
    'Alternate Run Line': 'Alternate Run Line',
    'Alternate Puck Line': 'Alternate Puck Line',
    'Alternate Game Handicap': 'Alternate Game Handicap',
    'Alternate Set Handicap': 'Alternate Set Handicap',
    'Alternate Goal Handicap': 'Alternate Goal Handicap',
    'Alternate Handicap': 'Alternate Handicap',
    'Alternate Corner Handicap': 'Alternate Corner Handicap',
    'Alternate Card Handicap': 'Alternate Card Handicap',
    'Alternate Total Corners': 'Alternate Total Corners',
    'Alternate Total Cards': 'Alternate Total Cards',
    'Alternate Team Corners': 'Alternate Team Corners',
    'Total Goals': 'Total Goals',
    'Total Points': 'Total Points',
    'Total Games': 'Total Games',
    'Total Runs': 'Total Runs',
    'Total Rounds': 'Total Rounds',
    'Total': 'Total',
    'Team Total Goals': 'Team Total Goals',
    'Team Total Points': 'Team Total Points',
    'Team Total Runs': 'Team Total Runs',
    'Team Total Games': 'Team Total Games',
    'Team Total': 'Team Total',
    'First 5 Innings Moneyline': 'First 5 Innings Moneyline',
    'First 5 Innings Run Line': 'First 5 Innings Run Line',
    'First 5 Innings Total Runs': 'First 5 Innings Total Runs',
  }

  if (exact[label]) return exact[label];

  label = label
    .replace(/\bDouble Chance - 1st Half\b/g, 'Double Chance - 1st Half')
    .replace(/\bBoth Teams To Score - 1st Half\b/g, 'Both Teams To Score - 1st Half')
    .replace(/\bCorrect Score - 1st Half\b/g, 'Correct Score - 1st Half')
    .replace(/\bAlternate Total Goals\b/g, 'Alternate Total Goals')
    .replace(/\bAlternate Total Points\b/g, 'Alternate Total Points')
    .replace(/\bAlternate Total Games\b/g, 'Alternate Total Games')
    .replace(/\bAlternate Total Runs\b/g, 'Alternate Total Runs')
    .replace(/\bAlternate Total Rounds\b/g, 'Alternate Total Rounds')
    .replace(/\bAlternate Total\b/g, 'Alternate Total')
    .replace(/\b1st Half\b/g, 'First Half')
    .replace(/\b2nd Half\b/g, 'Second Half')
    .replace(/\bFirst Half\b/g, 'First Half')
    .replace(/\bSecond Half\b/g, 'Second Half')
    .replace(/\bFirst 5 Innings\b/g, 'First 5 Innings')
    .replace(/\bQ([1-4])\b/g, 'Q$1')
    .replace(/\bPoint Spread\b/g, 'Point Spread')
    .replace(/\bAsian Handicap\b/g, 'Asian Handicap')
    .replace(/\bHandicap\b/g, 'Handicap')
    .replace(/\bTotal Goals\b/g, 'Total Goals')
    .replace(/\bTotal Points\b/g, 'Total Points')
    .replace(/\bTotal Games\b/g, 'Total Games')
    .replace(/\bTotal Runs\b/g, 'Total Runs')
    .replace(/\bTotal Rounds\b/g, 'Total Rounds')
    .replace(/\bTotal Corners\b/g, 'Total Corners')
    .replace(/\bTotal Cards\b/g, 'Total Cards')
    .replace(/\bCorners\b/g, 'Corners')
    .replace(/\bCards\b/g, 'Cards')
    .replace(/\bOffsides\b/g, 'Offsides')
    .replace(/\bFouls\b/g, 'Errors')
    .replace(/\bPenalty\b/g, 'Penalty')
    .replace(/\bYes\b/g, 'Yes')
    .replace(/\bNo\b/g, 'No')
    .replace(/\bOver\b/g, 'Over')
    .replace(/\bUnder\b/g, 'Under')
    .replace(/\bDraw\b/g, 'Draw')
    .replace(/\bHome\b/g, 'Home')
    .replace(/\bAway\b/g, 'Away')
    .replace(/\bMatch Winner\b/g, 'Match Winner')
    .replace(/\bWinner\b/g, 'Winner')
    .replace(/\bTeam 1\b/g, 'Team 1')
    .replace(/\bTeam 2\b/g, 'Team 2')
    .replace(/\bSpecials\b/g, 'Specials')
    .replace(/\bOther\b/g, 'Other');

  return label.replace(/\s{2,}/g, ' ').trim();
}

function translateSelectionDisplayLabel(value: string) {
  let label = String(value ?? '').trim();
  if (!label) return label;

  const exact: Record<string, string> = {
    'Draw': 'Draw',
    'Home': 'Home',
    'Away': 'Away',
    'Over': 'Over',
    'Under': 'Under',
    'Yes': 'Yes',
    'No': 'No',
    'Home or Draw': 'Home or Draw',
    'Draw or Away': 'Draw or Away',
    'Home or Away': 'Home or Away',
  };

  if (exact[label]) return exact[label];

  return label
    .replace(/\bHome\b/g, 'Home')
    .replace(/\bAway\b/g, 'Away')
    .replace(/\bDraw\b/g, 'Draw')
    .replace(/\bOver\b/g, 'Over')
    .replace(/\bUnder\b/g, 'Under')
    .replace(/\bYes\b/g, 'Yes')
    .replace(/\bNo\b/g, 'No')
    .replace(/\bFirst Half\b/g, 'First Half')
    .replace(/\bSecond Half\b/g, 'Second Half')
    .replace(/\b1st Half\b/g, 'First Half')
    .replace(/\b2nd Half\b/g, 'Second Half')
    .replace(/\bTeam 1\b/g, 'Team 1')
    .replace(/\bTeam 2\b/g, 'Team 2')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function getMarketCategories(
  market: MarketView,
  sportKey = '',
): MarketCategory[] {
  const key = market.key.trim().toLowerCase();
  const name = (market.name ?? '').trim().toLowerCase();
  const value = `${key} ${name}`;
  const sport = sportKey.trim().toLowerCase();

  const categories = new Set<MarketCategory>(['all']);

  const isFootball =
    sport === 'football' || sport.includes('soccer');
  const isBasketball =
    sport.includes('basketball') ||
    sport === 'nba' ||
    sport.includes('ncaab');
  const isTennis = sport.includes('tennis');
  const isVolleyball = sport.includes('volleyball');
  const isHandball = sport.includes('handball');
  const isBaseball = sport.includes('baseball');
  const isHockey =
    sport.includes('ice-hockey') ||
    sport.includes('hockey');
  const isAmericanFootball =
    sport.includes('american-football') ||
    sport === 'nfl';
  const isCricket = sport.includes('cricket');
  const isBoxing = sport.includes('boxing');
  const isMma =
    sport === 'mma' ||
    sport.includes('mixed-martial');

  const has = (...terms: string[]) =>
    terms.some(
      (term) => key === term || key.includes(term),
    );

  const textHas = (...terms: string[]) =>
    terms.some((term) => value.includes(term));

  const isMain =
    key === 'h2h' ||
    key === 'h2h_lay' ||
    key === 'draw_no_bet' ||
    key === 'double_chance' ||
    key === 'btts' ||
    key === 'to_qualify' ||
    key === '1x2' ||
    key === 'match_winner' ||
    key === 'fight_result';

  const isHandicap =
    key === 'spreads' ||
    key === 'spread' ||
    key === 'handicap' ||
    key === 'asian_handicap' ||
    key === 'asianhandicap' ||
    has('alternate_spread', 'spreads_') ||
    textHas('handicap', 'spread');

  const isTotal =
    key === 'totals' ||
    key === 'total' ||
    key === 'ou' ||
    key === 'over_under' ||
    key === 'overunder' ||
    has('alternate_totals', 'team_totals', 'team_total') ||
    textHas('over / under', 'over under', 'total');

  const isCorner =
    has('corner') ||
    textHas('corner');

  const isCard =
    has('card') ||
    textHas('card');

  const isCorrectScore =
    has('correct_score') ||
    textHas('correct score', 'goal score');

  const isVar =
    has('var') ||
    textHas('var', 'video assistant');

  const isMethod =
    has('method_of_victory', 'method_of_win') ||
    textHas('method of victory', 'method of win');

  const isRounds =
    has('round', 'rounds') ||
    textHas('round', 'rounds');

  const isQuarter =
    /(?:^|_)(?:q[1-4]|quarter[1-4]?)(?:_|$)/i.test(key) ||
    textHas(
      'quarter 1',
      'quarter 2',
      'quarter 3',
      'quarter 4',
    );

  const isPeriod =
    /(?:^|_)(?:period[1-4]?)(?:_|$)/i.test(key) ||
    textHas('period');

  const isInning =
    has('inning', '1st_5', 'first_5') ||
    textHas('inning', '1st 5', 'first 5');

  const isSet =
    has('set', 'sets') ||
    textHas('set', 'sets');

  const isGame =
    has('game', 'games') ||
    textHas('game', 'games');

  const isHalf =
    has(
      '_h1',
      '_h2',
      'first_half',
      'second_half',
      '1st_half',
      '2nd_half',
    ) ||
    key === 'correct_score_h1' ||
    key === 'halftime_fulltime' ||
    key === 'half_time_full_time' ||
    textHas(
      '1st half',
      '2nd half',
      'first half',
      'second half',
      'half time',
      'half-time',
      'halftime',
    );

  const isFirstHalf =
    has('h1', 'first_half', '1st_half') ||
    textHas('1st half', 'first half');

  const isSecondHalf =
    has('h2', 'second_half', '2nd_half') ||
    textHas('2nd half', 'second half');

  if (isMain) {
    categories.add('main');
  }

  if (isHandicap) {
    categories.add('handicap');
  }

  if (isFootball) {
    if (isTotal) categories.add('total_goals');
    if (isFirstHalf) categories.add('first_half');
    if (isSecondHalf) categories.add('second_half');
    if (isHalf && !isFirstHalf && !isSecondHalf) {
      categories.add('halves');
    }
    if (isCorner) categories.add('corners');
    if (isCard) categories.add('cards');
    if (isCorrectScore) {
      categories.add('correct_score');
      categories.add('goals');
    }
    if (isVar) categories.add('var');
  } else if (isBasketball || isAmericanFootball) {
    if (isTotal) categories.add('total_points');
    if (isQuarter) {
      if (key.includes('q1') || textHas('quarter 1')) {
        categories.add('q1');
      }
      if (key.includes('q2') || textHas('quarter 2')) {
        categories.add('q2');
      }
      if (key.includes('q3') || textHas('quarter 3')) {
        categories.add('q3');
      }
      if (key.includes('q4') || textHas('quarter 4')) {
        categories.add('q4');
      }
      categories.add('periods');
    }
    if (isPeriod) {
      categories.add('periods');
    }
    if (has('team_totals', 'team_total')) {
      categories.add('points');
    }
  } else if (isTennis) {
    if (isTotal) {
      categories.add('total_games');
    }
    if (isSet) categories.add('sets');
    if (isGame) categories.add('games');
  } else if (isVolleyball) {
    if (isTotal) categories.add('total_points');
    if (isSet) categories.add('sets');
    if (has('team_totals', 'team_total')) {
      categories.add('points');
    }
  } else if (isHandball) {
    if (isTotal) categories.add('total_goals');
    if (isFirstHalf) categories.add('first_half');
    if (isSecondHalf) categories.add('second_half');
    if (isHalf && !isFirstHalf && !isSecondHalf) {
      categories.add('halves');
    }
  } else if (isBaseball) {
    if (isTotal) categories.add('total_runs');
    if (isInning) categories.add('innings');
    if (has('team_totals', 'team_total')) {
      categories.add('runs');
    }
  } else if (isHockey) {
    if (isTotal) categories.add('total_goals');
    if (isPeriod) categories.add('periods');
    if (has('team_totals', 'team_total')) {
      categories.add('goals');
    }
  } else if (isCricket) {
    if (isTotal) categories.add('total_runs');
    if (isInning) categories.add('innings');
    if (has('team_totals', 'team_total')) {
      categories.add('runs');
    }
  } else if (isBoxing || isMma) {
    if (isMethod) categories.add('method');
    if (isRounds || isTotal) categories.add('rounds');
  } else {
    if (isTotal) categories.add('total_points');
    if (isSet) categories.add('sets');
    if (isGame) categories.add('games');
    if (isInning) categories.add('innings');
    if (isPeriod) categories.add('periods');
    if (isCorner) categories.add('corners');
    if (isCard) categories.add('cards');
    if (isCorrectScore) categories.add('correct_score');
    if (isVar) categories.add('var');
  }

  const known =
    isMain ||
    isHandicap ||
    isTotal ||
    isCorner ||
    isCard ||
    isCorrectScore ||
    isVar ||
    isMethod ||
    isRounds ||
    isQuarter ||
    isPeriod ||
    isInning ||
    isSet ||
    isGame ||
    isHalf;

  if (!known) {
    categories.add('other');
  }

  return [...categories];
}

function getOddsMovementImpact(
  selection: MarketView['selections'][number],
) {
  const current = Number(selection.oddsScaled);
  const previous = Number(selection.previousOddsScaled);

  if (
    !Number.isFinite(current) ||
    current <= 0 ||
    !Number.isFinite(previous) ||
    previous <= 0
  ) {
    return selection.movement === 'UP' || selection.movement === 'DOWN'
      ? 0.0001
      : 0;
  }

  return Math.abs(current - previous) / previous;
}

function getMarketBasePriority(market: MarketView, sportKey = '') {
  const key = market.key.trim().toLowerCase();
  const family = getSportFamily(sportKey);

  if (
    key === 'h2h' ||
    key === 'match_winner' ||
    key === 'fight_result'
  ) {
    return 100;
  }

  if (
    key === 'draw_no_bet' ||
    key === 'double_chance' ||
    key === 'to_qualify'
  ) {
    return 94;
  }

  if (key === 'btts') return 92;

  if (
    key === 'spreads' ||
    key === 'spread' ||
    key === 'handicap' ||
    key === 'asian_handicap'
  ) {
    return 90;
  }

  if (
    key === 'totals' ||
    key === 'ou' ||
    key === 'over_under'
  ) {
    return 88;
  }

  if (
    key === 'alternate_spreads' ||
    key === 'alternate_handicap' ||
    key === 'alternate_asian_handicap'
  ) {
    return 72;
  }

  if (
    key === 'alternate_totals' ||
    key === 'alternate_ou'
  ) {
    return 70;
  }

  if (family === 'football') {
    if (key.includes('corner')) return 80;
    if (key.includes('card')) return 76;
    if (key.includes('correct_score')) return 64;
  }

  if (family === 'baseball') {
    if (key === 'h2h_1st_5_innings') return 86;
    if (key === 'spreads_1st_5_innings') return 84;
    if (key === 'totals_1st_5_innings') return 82;
    if (key.includes('team_totals')) return 68;
  }

  if (
    family === 'basketball' ||
    family === 'american-football'
  ) {
    if (key === 'team_totals') return 78;
    if (key.includes('_q1')) return 74;
    if (key.includes('_q2')) return 73;
    if (key.includes('_q3')) return 72;
    if (key.includes('_q4')) return 71;
  }

  if (family === 'tennis') {
    if (key.includes('spreads')) return 82;
    if (key.includes('totals')) return 80;
  }

  return 50;
}

function getMarketMovementImpact(market: MarketView) {
  return market.selections.reduce(
    (max, selection) =>
      Math.max(max, getOddsMovementImpact(selection)),
    0,
  );
}

function getSelectionSemanticPriority(
  selection: MarketView['selections'][number],
) {
  const code = String(selection.code ?? '').trim().toLowerCase();
  const name = normalizeDisplayLabel(selection.name).trim().toLowerCase();

  if (code === 'home' || code === 'a') return 10;
  if (code === 'away' || code === 'b') return 20;
  if (code === 'draw' || name === 'draw') return 30;

  if (name === 'over' || code === 'over') return 10;
  if (name === 'under' || code === 'under') return 20;

  if (name.includes('over') && !name.includes('under')) return 10;
  if (name.includes('under') && !name.includes('over')) return 20;

  return 100;
}

function compareSelections(
  a: MarketView['selections'][number],
  b: MarketView['selections'][number],
) {
  const priorityA = getSelectionSemanticPriority(a);
  const priorityB = getSelectionSemanticPriority(b);

  if (priorityA !== priorityB) {
    return priorityA - priorityB;
  }

  const impactA = getOddsMovementImpact(a);
  const impactB = getOddsMovementImpact(b);

  if (priorityA >= 100 && impactA !== impactB) {
    return impactB - impactA;
  }

  const movementA =
    a.movement === 'UP' || a.movement === 'DOWN' ? 1 : 0;
  const movementB =
    b.movement === 'UP' || b.movement === 'DOWN' ? 1 : 0;

  return movementB - movementA;
}

function sortMarketSelections(market: MarketView) {
  return [...market.selections].sort(compareSelections);
}

function compareMarkets(
  a: MarketView,
  b: MarketView,
  sportKey: string,
) {
  const movementA = getMarketMovementImpact(a);
  const movementB = getMarketMovementImpact(b);

  if (movementA !== movementB) {
    return movementB - movementA;
  }

  const baseA = getMarketBasePriority(a, sportKey);
  const baseB = getMarketBasePriority(b, sportKey);

  return baseB - baseA;
}

function sortMarketsByPriority(
  markets: MarketView[],
  sportKey: string,
) {
  return markets
    .map((market, index) => ({ market, index }))
    .sort((a, b) => {
      const result = compareMarkets(
        a.market,
        b.market,
        sportKey,
      );

      return result !== 0 ? result : a.index - b.index;
    })
    .map(({ market }) => ({
      ...market,
      selections: sortMarketSelections(market),
    }));
}


function getMarketGroup(
  market: MarketView,
  sportKey = '',
) {
  const key = market.key.trim().toLowerCase();
  const title = getMarketTitle(market, sportKey)
    .trim()
    .toLowerCase()
    .replace(/[-_/]+/g, ' ');
  const text = `${key} ${title}`;

  const has = (...tokens: string[]) =>
    tokens.some((token) => text.includes(token));

  if (has('corner', 'corners')) return 'Corners';
  if (has('card', 'cards')) return 'Cards';

  if (
    has(
      'correct_score',
      'correct score',
      'half time / full time',
      'halftime_fulltime',
    )
  ) {
    return 'Specials';
  }

  if (has('btts', 'both teams to score')) {
    return 'Both Teams To Score';
  }

  if (
    has(
      'double_chance',
      'double chance',
      'draw_no_bet',
      'draw no bet',
      'to_qualify',
      'to qualify',
    )
  ) {
    return 'Match Specials';
  }

  if (
    has(
      'asian handicap',
      'alternate asian handicap',
      'point spread',
      'alternate point spread',
      'run line',
      'alternate run line',
      'puck line',
      'alternate puck line',
      'game handicap',
      'alternate game handicap',
      'set handicap',
      'alternate set handicap',
      'goal handicap',
      'alternate goal handicap',
      'handicap',
      'spread',
    )
  ) {
    return 'Handicap';
  }

  if (
    has(
      'total goals',
      'alternate total goals',
      'team total goals',
      'total points',
      'alternate total points',
      'team total points',
      'total runs',
      'alternate total runs',
      'team total runs',
      'total games',
      'alternate total games',
      'team total games',
      'total sets',
      'alternate total sets',
      'total rounds',
      'alternate total rounds',
      'totals',
      'over / under',
      'over under',
    )
  ) {
    return 'Totals';
  }

  if (
    has(
      'moneyline',
      'match winner',
      'fight winner',
      'h2h',
    )
  ) {
    return 'Winner';
  }

  if (
    has(
      'quarter',
      'q1',
      'q2',
      'q3',
      'q4',
      'period',
      'periods',
    )
  ) {
    return 'Periods';
  }

  if (has('inning', 'innings')) return 'Innings';
  if (has('set', 'sets')) return 'Sets';
  if (has('game', 'games')) return 'Games';
  if (has('round', 'rounds')) return 'Rounds';
  if (has('goal', 'goals')) return 'Goals';
  if (has('point', 'points')) return 'Points';
  if (has('run', 'runs')) return 'Runs';

  return 'Other';
}

function getMarketGroupPriority(
  group: string,
  markets: MarketView[],
) {
  const movement = markets.reduce(
    (max, market) =>
      Math.max(max, getMarketMovementImpact(market)),
    0,
  );

  const priority: Record<string, number> = {
    Winner: 100,
    Totals: 94,
    Handicap: 92,
    Goals: 88,
    Points: 88,
    Runs: 88,
    Corners: 86,
    Cards: 84,
    Periods: 80,
    Sets: 78,
    Games: 76,
    Innings: 76,
    Rounds: 74,
    'Both Teams To Score': 72,
    'Match Specials': 70,
    Specials: 68,
    Other: 50,
  };

  return movement * 1000 + (priority[group] ?? 50);
}

function groupMarketsByFamily(
  markets: MarketView[],
  sportKey: string,
) {
  const groups = new Map<
    string,
    { markets: MarketView[]; firstIndex: number }
  >();

  markets.forEach((market, index) => {
    const group = getMarketGroup(market, sportKey);
    const current = groups.get(group);

    if (current) {
      current.markets.push(market);
    } else {
      groups.set(group, {
        markets: [market],
        firstIndex: index,
      });
    }
  });

  return [...groups.entries()]
    .sort((a, b) => {
      const priorityA = getMarketGroupPriority(
        a[0],
        a[1].markets,
      );
      const priorityB = getMarketGroupPriority(
        b[0],
        b[1].markets,
      );

      if (priorityA !== priorityB) {
        return priorityB - priorityA;
      }

      return a[1].firstIndex - b[1].firstIndex;
    })
    .map(([group, value]) => ({
      group,
      markets: sortMarketsByPriority(
        value.markets,
        sportKey,
      ),
    }));
}


function MarketSelectionButton({
  match,
  market,
  selection,
  selected,
  locked,
  onToggle,
}: {
  match: MatchView;
  market: MarketView;
  selection: MarketView['selections'][number];
  selected: boolean;
  locked: boolean;
  onToggle: (item: SlipItem) => void;
}) {
  const { locale } = useApp();
  const item: SlipItem = {
    selectionId: selection.id,
    marketId: market.id,
    matchId: match.id,
    label: getSelectionDisplayName(match, selection),
    marketLabel: getMarketTitle(market, match.sportKey),
    matchLabel: match.participants.map((p) => p.name).join(' - '),
    sportSlug: match.sportKey,
    oddsScaled: selection.oddsScaled,
    oddsVersionSeen: selection.oddsVersion,
    addedAt: Date.now(),
  };

  const movement =
    selection.movement === 'UP'
      ? 'up'
      : selection.movement === 'DOWN'
        ? 'down'
        : 'stable';

  return (
    <button
      key={`${selection.id}-${selection.oddsVersion}`}
      type="button"
      disabled={locked}
      title={locked ? 'Odds paused — waiting for a valid current price' : 'Add this selection to your bet slip'}
      aria-label={locked
        ? `${getSelectionDisplayName(match, selection)} — odds temporarily unavailable`
        : `${getSelectionDisplayName(match, selection)} — ${formatOddsScaled(selection.oddsScaled)}. Add to bet slip`}
      aria-pressed={selected}
      data-selected={selected}
      data-locked={locked}
      data-testid="odds-button"
      onClick={() => onToggle(item)}
      className={[
        'group relative flex min-h-[58px] w-full items-center justify-between gap-3',
        'rounded-[13px] border px-3.5 py-2.5 text-left',
        'transition-[transform,background-color,border-color,box-shadow,opacity] duration-150',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#08B86A]/30',
        selected
          ? 'border-[#08B86A] bg-[#F2FBF6] shadow-[0_3px_12px_rgba(8,184,106,.10),inset_0_0_0_1px_rgba(8,184,106,.10)]'
          : 'border-[#E3E7EB] bg-white shadow-[0_1px_3px_rgba(16,24,40,.035)] hover:border-[#C9D0D7] hover:bg-[#FCFDFD] hover:shadow-[0_4px_12px_rgba(16,24,40,.055)]',
        movement === 'up' ? 'nova-odds-flash-up' : '',
        movement === 'down' ? 'nova-odds-flash-down' : '',
        locked
          ? 'cursor-not-allowed opacity-45'
          : 'active:scale-[.992]',
      ].join(' ')}
    >
      <span
        className={[
          'min-w-0 flex-1 truncate pr-1 text-[12px] leading-[18px]',
          selected
            ? 'font-bold text-[#078653]'
            : 'font-semibold text-[#343A40]',
        ].join(' ')}
      >
        {locale === 'fa'
          ? translateVisibleText(translateSelectionDisplayLabel(getSelectionDisplayName(match, selection)), true)
          : translateSelectionDisplayLabel(getSelectionDisplayName(match, selection))}
      </span>

      <span
        className={[
          'flex shrink-0 min-w-[58px] items-center justify-end gap-1.5',
          'rounded-[9px] px-2 py-1.5',
          selected
            ? 'bg-[#E2F7EB] text-[#078653]'
            : movement === 'up'
              ? 'bg-[#EFFAF4] text-[#078653]'
              : movement === 'down'
                ? 'bg-[#FFF1F2] text-[#C63D46]'
                : 'bg-[#F5F6F7] text-[#20242A]',
        ].join(' ')}
      >
        {movement !== 'stable' ? (
          <span className="text-[9px] font-black leading-none">
            {movement === 'up' ? '▲' : '▼'}
          </span>
        ) : null}

        <span className="text-[15px] font-black leading-none tabular-nums tracking-[-0.02em]">
          {locked ? 'Paused' : formatOddsScaled(selection.oddsScaled)}
        </span>
      </span>
    </button>
  );
}

function MarketCard({
  match,
  market,
  items,
  collapsed,
  onToggleCollapse,
  onToggleSelection,
}: {
  match: MatchView;
  market: MarketView;
  items: SlipItem[];
  collapsed: boolean;
  onToggleCollapse: () => void;
  onToggleSelection: (item: SlipItem) => void;
}) {
  const { locale } = useApp();
  const marketTitleEn = translateMarketDisplayLabel(getMarketTitle(market, match.sportKey));
  const marketTitle = locale === 'fa' ? translateVisibleText(marketTitleEn ?? '') : marketTitleEn;

  return (
    <section
      key={market.id}
      data-market-id={market.id}
      className={[
        'overflow-hidden rounded-[18px] border bg-white',
        'border-[#DDE2E7] shadow-[0_2px_12px_rgba(16,24,40,.035)]',
        collapsed ? '' : 'shadow-[0_3px_16px_rgba(16,24,40,.045)]',
      ].join(' ')}
    >
      <button
        type="button"
        onClick={onToggleCollapse}
        className={[
          'flex min-h-[58px] w-full items-center justify-between gap-3',
          'border-b px-4 py-3 text-left transition-colors',
          collapsed
            ? 'border-transparent bg-white hover:bg-[#FAFBFC]'
            : 'border-[#E8EBEE] bg-[#FCFDFD] hover:bg-[#FAFBFC]',
        ].join(' ')}
        aria-expanded={!collapsed}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className={[
              'h-2 w-2 shrink-0 rounded-full',
              market.status === 'open' &&
              match.isBettingAvailable &&
              market.selections.some((selection) => selection.status === 'open')
                ? 'bg-[#08B86A]'
                : 'bg-[#C7CDD3]',
            ].join(' ')}
          />

          <div className="min-w-0">
            <h3 className="truncate text-[13px] font-black tracking-[-0.01em] text-[#252A30]">
              {marketTitle}
            </h3>
            <div className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-[#9AA1A9]">
              {market.selections.length} selections
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {market.status !== 'open' ? (
            <span className="rounded-full bg-[#FFF4E4] px-2 py-1 text-[8px] font-black uppercase tracking-wide text-[#A86908]">
              {market.status === 'suspended' ? 'Suspended' : 'Closed'}
            </span>
          ) : null}

          <span className="hidden text-[9px] font-bold uppercase tracking-[0.08em] text-[#A0A6AD] sm:block">
            Odds
          </span>

          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#F3F5F6]">
            {collapsed ? (
              <ChevronDown size={15} strokeWidth={2.5} className="text-[#687078]" />
            ) : (
              <ChevronUp size={15} strokeWidth={2.5} className="text-[#687078]" />
            )}
          </span>
        </div>
      </button>

      {!collapsed ? (
        <div className="bg-[#F8FAFB] p-2.5 sm:p-3">
          {market.selections.length > 0 ? (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-2.5">
              {sortMarketSelections(market).map((selection) => {
                const selected = items.some(
                  (item) => item.selectionId === selection.id,
                );
                const locked =
                  selection.status !== 'open' ||
                  market.status !== 'open' ||
                  !match.isBettingAvailable;

                return (
                  <MarketSelectionButton
                    key={selection.id}
                    match={match}
                    market={market}
                    selection={selection}
                    selected={selected}
                    locked={locked}
                    onToggle={onToggleSelection}
                  />
                );
              })}
            </div>
          ) : (
            <div className="rounded-[12px] border border-dashed border-[#DDE2E7] bg-white py-6 text-center text-[11px] font-medium text-[#8A9199]">
              No odds available
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}

export function MarketList({
  match,
  markets,
}: {
  match: MatchView;
  markets: MarketView[];
}) {
  const { t } = useApp();

  const [activeCategory, setActiveCategory] =
    useState<MarketCategory>('all');

  const [collapsedMarkets, setCollapsedMarkets] = useState<Set<string>>(
    () => new Set(),
  );

  const toggle = useBetSlip((s) => s.toggle);
  const [betSlipHydrated, setBetSlipHydrated] = useState(false);
  const [liveMarkets, setLiveMarkets] = useState<MarketView[]>(markets);
  const previousOddsRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    setLiveMarkets(markets);
  }, [markets]);
  useEffect(() => {
    setBetSlipHydrated(true);
  }, []);

  useEffect(() => {
    let active = true;
    let lastVersion: number | null = null;

    const refreshOdds = async () => {
      try {
        const response = await fetch(`/api/v1/matches/${match.id}/odds?ts=${Date.now()}`, {
          cache: 'no-store',
          headers: { Accept: 'application/json' },
        });
        if (!response.ok) return;

        const json = await response.json();
        const payload = json?.data ?? json;
        if (!active || !Array.isArray(payload?.markets)) return;

        const nextVersion =
          typeof payload.version === 'number' ? payload.version : null;

        if (nextVersion !== null && nextVersion === lastVersion) return;
        lastVersion = nextVersion;

        setLiveMarkets((current) => {
          const incomingMarkets = Array.isArray(payload.markets)
            ? payload.markets
            : [];

          const currentById = new Map(
            current.map((market) => [String(market.id), market]),
          );

          const mergedMarkets = incomingMarkets.map((incoming: any) => {
            const existing = currentById.get(String(incoming.id));

            const incomingSelections = Array.isArray(incoming.selections)
              ? incoming.selections
              : [];

            const existingSelections = Array.isArray(existing?.selections)
              ? existing.selections
              : [];

            return {
              ...(existing ?? {}),
              ...incoming,
              id: incoming.id,
              key: incoming.key ?? existing?.key ?? '',
              specifier:
                incoming.specifier ??
                existing?.specifier ??
                '',
              name: normalizeDisplayLabel(
                incoming.name ??
                  incoming.nameFa ??
                  incoming.nameEn ??
                  existing?.name ??
                  incoming.key ??
                  '',
              ),
              status: incoming.status ?? existing?.status ?? 'open',
              selections: incomingSelections.map((selection: any) => {
                const previous = existingSelections.find(
                  (item) => String(item.id) === String(selection.id),
                );

                return {
                  ...(previous ?? {}),
                  ...selection,
                  id: selection.id,
                  code: selection.code ?? previous?.code ?? '',
                  name: normalizeDisplayLabel(
                    selection.name ??
                      selection.nameFa ??
                      selection.nameEn ??
                      previous?.name ??
                      selection.code ??
                      '',
                  ),
                  oddsScaled: String(
                    selection.oddsScaled ??
                      previous?.oddsScaled ??
                      '0',
                  ),
                  previousOddsScaled:
                    selection.previousOddsScaled == null
                      ? null
                      : String(selection.previousOddsScaled),
                  movement: (() => {
                    const key = String(selection.id);
                    const nextOdds = String(selection.oddsScaled ?? '0');
                    const previousOdds = previousOddsRef.current.get(key);
                    previousOddsRef.current.set(key, nextOdds);
                    if (previousOdds == null || previousOdds === nextOdds) {
                      return 'STABLE';
                    }
                    const prev = Number(previousOdds);
                    const next = Number(nextOdds);
                    return next > prev ? 'UP' : next < prev ? 'DOWN' : 'STABLE';
                  })(),
                  status:
                    selection.status ??
                    previous?.status ??
                    'open',
                  oddsVersion: Number(
                    selection.version ??
                      selection.oddsVersion ??
                      previous?.oddsVersion ??
                      0,
                  ),
                };
              }),
            };
          });

          const incomingIds = new Set(
            incomingMarkets.map((market: any) => String(market.id)),
          );

          const currentOnlyMarkets = current.filter(
            (market) => !incomingIds.has(String(market.id)),
          );

          return [...mergedMarkets, ...currentOnlyMarkets];
        });
      } catch {
        // Keep the last known odds snapshot on transient network errors.
      }
    };

    void refreshOdds();
    const timer = window.setInterval(
      refreshOdds,
      match.isLive ? 1_000 : 3_000,
    );
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [match.id, match.isLive]);


  const openFromControl = useBetSlip((s) => s.openFromControl);
  const persistedItems = useBetSlip((s) => s.items);
  const items = betSlipHydrated ? persistedItems : [];

  const availableCategories = useMemo(() => {
    const available = new Set<MarketCategory>(['all']);

    for (const market of liveMarkets) {
      for (const category of getMarketCategories(market, match.sportKey)) {
        available.add(category);
      }
    }

    return available;
  }, [liveMarkets, match.sportKey]);

  const visibleCategoryItems = useMemo(
    () =>
      getCategoryItems(
        match.sportKey,
        availableCategories,
      ),
    [availableCategories, match.sportKey],
  );

  const visibleMarkets = useMemo(() => {
    const filtered =
      activeCategory === 'all'
        ? liveMarkets
        : liveMarkets.filter((market) =>
            getMarketCategories(
              market,
              match.sportKey,
            ).includes(activeCategory),
          );

    return sortMarketsByPriority(
      filtered,
      match.sportKey,
    );
  }, [activeCategory, liveMarkets, match.sportKey]);

  useEffect(() => {
    if (!availableCategories.has(activeCategory)) {
      setActiveCategory('all');
    }
  }, [activeCategory, availableCategories]);

  const handleToggleSelection = (item: SlipItem) => {
    const result = toggle(item);

    if (result?.action === 'ADDED' || result?.action === 'REPLACED') {
      openFromControl();
    }
  };

  const toggleCollapsed = (marketId: string) => {
    setCollapsedMarkets((current) => {
      const next = new Set(current);

      if (next.has(marketId)) {
        next.delete(marketId);
      } else {
        next.add(marketId);
      }

      return next;
    });
  };

  if (liveMarkets.length === 0) {
    return (
      <div className="rounded-2xl border border-[#DDE1E6] bg-white px-5 py-12 text-center shadow-[0_2px_10px_rgba(0,0,0,.03)]">
        <div className="text-sm font-bold text-[#3E454D]">
          No betting markets available
        </div>
        <p className="mt-1 text-xs text-[#8A9199]">
          {t('home.oddsUnavailable')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="-mx-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex w-max min-w-full gap-2">
          {visibleCategoryItems.map((category) => {
            const active = activeCategory === category.key;

            return (
              <button
                key={category.key}
                type="button"
                onClick={() => setActiveCategory(category.key)}
                className={[
                  'shrink-0 rounded-full px-4 py-2.5 text-[12px] font-extrabold',
                  'transition active:scale-[.98]',
                  active
                    ? 'bg-[#1487F5] text-white shadow-[0_4px_12px_rgba(20,135,245,.18)]'
                    : 'bg-[#E4E7ED] text-[#30363D] hover:bg-[#DCE0E6]',
                ].join(' ')}
              >
                {category.label}
              </button>
            );
          })}
        </div>
      </div>

      {visibleMarkets.length > 0 ? (
        <div className="space-y-4">
          {groupMarketsByFamily(
            visibleMarkets,
            match.sportKey,
          ).map(({ group, markets: groupedMarkets }) => (
            <section
              key={group}
              data-market-group={group}
              className="space-y-2.5"
            >
              <div className="flex min-h-[34px] items-center gap-2 px-1">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#1487F5]" />
                <h2 className="text-[11px] font-black uppercase tracking-[0.08em] text-[#6B737C]">
                  {group}
                </h2>
                <span className="h-px flex-1 bg-[#E8EBEF]" />
              </div>

              <div className="space-y-3">
                {groupedMarkets.map((market) => (
                  <MarketCard
                    key={market.id}
                    match={match}
                    market={market}
                    items={items}
                    collapsed={collapsedMarkets.has(market.id)}
                    onToggleCollapse={() =>
                      toggleCollapsed(market.id)
                    }
                    onToggleSelection={handleToggleSelection}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-[#DDE1E6] bg-white px-5 py-12 text-center shadow-[0_2px_10px_rgba(0,0,0,.03)]">
          <div className="text-sm font-bold text-[#3E454D]">
            No markets available in this category
          </div>
          <p className="mt-1 text-xs text-[#8A9199]">
            Select another market category.
          </p>
        </div>
      )}
    </div>
  );
}
