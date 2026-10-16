import type { Match } from '@/lib/types';

/**
 * Prioritize fixtures with actual current displayed selections.
 * Catalog already applies source age / provider_timestamp / market suspension.
 * This helper must never resurrect an unavailable quote or fake betting.
 */
export function hasDisplayedLiveOdds(match: Pick<Match,
  'isBettingAvailable' | 'topMarkets'>): boolean {
  if (!match.isBettingAvailable) return false;
  return Boolean(match.topMarkets?.some(market =>
    (market.status === 'open' || market.status === 'active') &&
    market.selections.some(selection =>
      (selection.status === 'active' || selection.status === 'open') &&
      selection.oddsScaled > 10_000n,
    ),
  ));
}

export function rankLiveFixturesWithOdds<T extends Pick<Match,
  'isBettingAvailable' | 'topMarkets'>>(matches: readonly T[]): T[] {
  // JS Array.sort is stable: original minute/competition priority remains
  // unchanged within both categories.
  return [...matches].sort((a, b) =>
    Number(hasDisplayedLiveOdds(b)) - Number(hasDisplayedLiveOdds(a)),
  );
}
