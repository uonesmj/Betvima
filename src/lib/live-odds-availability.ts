import { isLiveMatchStatus } from './match-state';

/**
 * Display-only freshness gate. Never upgrades a suspended selection to open.
 * The authoritative quote, place_bet and wallet debit checks remain in force.
 */
export function effectiveSelectionStatus(
  selection: {
    status: string;
    oddsUpdatedAt: string | null;
    providerTimestamp: string | null;
    provider: string | null;
  },
  matchStatus: string,
  marketIsLive: boolean,
  nowMs = Date.now(),
): string {
  if (selection.status !== 'open') return selection.status;

  const isInPlay = marketIsLive || isLiveMatchStatus(matchStatus.toLowerCase());
  const maximumAgeMs = (isInPlay ? 45 : 300) * 1_000;
  const ingestedAtMs = selection.oddsUpdatedAt ? Date.parse(selection.oddsUpdatedAt) : NaN;

  if (!Number.isFinite(ingestedAtMs) || nowMs - ingestedAtMs > maximumAgeMs) {
    return 'suspended';
  }

  if (isInPlay && selection.provider === 'the_odds_api') {
    const sourceAtMs = selection.providerTimestamp
      ? Date.parse(selection.providerTimestamp)
      : NaN;
    if (
      !Number.isFinite(sourceAtMs) ||
      nowMs - sourceAtMs > 45_000 ||
      sourceAtMs - nowMs > 15_000
    ) {
      return 'suspended';
    }
  }

  return 'open';
}
