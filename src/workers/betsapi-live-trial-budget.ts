/**
 * BetsAPI trial has a finite hourly request budget. One request every five
 * seconds is ~720 price requests/hour before event discovery, which consumes
 * the entire trial and leaves every previously open quote stale.
 *
 * Keep one 1X2-priced match refreshed, reserving a bounded slot every three
 * minutes to inspect a fixture that does not yet have a wager-grade market.
 * The financial SQL still independently checks the bookmaker timestamps.
 */
export interface BetsapiLiveCandidate {
  has_betsapi_market: boolean;
}

export const BETSAPI_EXPLORATION_INTERVAL_MS = 180_000;

export function betsapiLivePollIntervalMs(
  rawBudget: string | undefined,
): number {
  const budget = Number(rawBudget);
  const hourly = Number.isSafeInteger(budget) && budget >= 50
    ? Math.min(budget, 3000)
    : 200;
  // Reserve >=30 calls/hour for live discovery and >=20 for error/health
  // headroom. Never exceed 120 price requests/hour even on a paid plan:
  // greater concurrency/coverage requires a separately reviewed scheduler.
  const priceCalls = Math.max(1, Math.min(120, hourly - 50));
  return Math.max(30_000, Math.ceil(3_600_000 / priceCalls));
}

export function selectBetsapiLiveCandidate<T extends BetsapiLiveCandidate>(
  ordered: readonly T[],
  explorationIndex: number,
  explorationDue: boolean,
): { candidate: T | undefined; explored: boolean } {
  const priced = ordered.filter(row => row.has_betsapi_market);
  const unpriced = ordered.filter(row => !row.has_betsapi_market);
  if (unpriced.length && (explorationDue || priced.length === 0)) {
    const index = ((explorationIndex % unpriced.length) + unpriced.length) % unpriced.length;
    return { candidate: unpriced[index], explored: true };
  }
  return { candidate: priced[0], explored: false };
}
