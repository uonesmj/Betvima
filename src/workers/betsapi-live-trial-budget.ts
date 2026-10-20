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
  provider_id?: string | null;
}

export const BETSAPI_EXPLORATION_INTERVAL_MS = 180_000;
// A live match can have a historical 1X2 market and yet return no current
// bookmaker prices. Never pin the entire trial on that match indefinitely.
export const BETSAPI_EMPTY_PRICE_ROTATE_AFTER = 3;
export const BETSAPI_EMPTY_PRICE_COOLDOWN_MS = 8 * 60_000;

/** An unchanged/empty provider quote is not proof that a market is live.
 * After several consecutive no-update polls, probe a different fixture. */
export function betsapiNoQuoteProbe(
  previousEmptyCount: number,
  updated: number,
  nowMs: number,
): { emptyCount: number; cooldownUntil: number | null } {
  if (updated > 0) return { emptyCount: 0, cooldownUntil: null };
  const emptyCount = Math.max(0, previousEmptyCount) + 1;
  return {
    emptyCount,
    cooldownUntil: emptyCount >= BETSAPI_EMPTY_PRICE_ROTATE_AFTER
      ? nowMs + BETSAPI_EMPTY_PRICE_COOLDOWN_MS : null,
  };
}

export interface BetsapiLiveCoveragePlan {
  intervalMs: number;
  pricedSlots: number;
  explorationIntervalMs: number;
  hourlyBudget: number;
}

/**
 * Raise coverage only after an operator has verified and explicitly configured
 * the new provider hourly quota. A 200/h trial stays on its original isolated
 * single-fixture schedule. Premium mode reserves ample headroom for discovery,
 * pending-result checks, exploration and upstream request retries.
 *
 * No amount of request budget can make a missing/suspended bookmaker market
 * wagerable; source timestamps and settlement eligibility remain authoritative.
 */
export function betsapiLiveCoveragePlan(rawBudget: string | undefined): BetsapiLiveCoveragePlan {
  const parsed = Number(rawBudget);
  const hourlyBudget = Number.isSafeInteger(parsed) && parsed >= 50
    ? Math.min(parsed, 199_999) : 200;
  if (hourlyBudget < 600) {
    const pricedCalls = Math.max(1, Math.min(120, hourlyBudget - 50));
    return {
      intervalMs: Math.max(30_000, Math.ceil(3_600_000 / pricedCalls)),
      pricedSlots: 1,
      explorationIntervalMs: BETSAPI_EXPLORATION_INTERVAL_MS,
      hourlyBudget,
    };
  }
  const intervalMs = 25_000;
  // 200 calls/hour are withheld before allocating only 75% of the rest to
  // sustained markets. The extra per-tick exploration call fits the margin.
  const perFixtureHourly = Math.ceil(3_600_000 / intervalMs);
  const pricedSlots = Math.max(1, Math.min(16,
    Math.floor((hourlyBudget - 200) * 0.75 / perFixtureHourly)));
  return {
    intervalMs, pricedSlots, explorationIntervalMs: 60_000, hourlyBudget,
  };
}

export function betsapiLivePollIntervalMs(
  rawBudget: string | undefined,
): number {
  return betsapiLiveCoveragePlan(rawBudget).intervalMs;
}

export function selectBetsapiLiveCandidates<T extends BetsapiLiveCandidate>(
  ordered: readonly T[],
  explorationIndex: number,
  explorationDue: boolean,
  preferredProviderId?: string | null,
  excludedProviderIds: ReadonlySet<string> = new Set<string>(),
  preferredProviderIds: readonly string[] = [],
  pricedSlots = 1,
): { candidates: T[]; explored: boolean } {
  const available = ordered.filter(row =>
    Boolean(row.provider_id) ? !excludedProviderIds.has(row.provider_id!) : true);
  const priced = available.filter(row => row.has_betsapi_market);
  const unpriced = available.filter(row => !row.has_betsapi_market);
  // Never skip repricing the known valid market when probing another event:
  // two upstream calls every three minutes still fit a 200/hr trial budget.
  // Stick to a live, already-priced event until it is no longer eligible.
  // Sorting by oldest update otherwise rotates across all priced fixtures,
  // guaranteeing that *none* remains fresh under a 200 calls/hour trial.
  const slots = Math.max(1, Math.min(16, Math.trunc(pricedSlots) || 1));
  const candidates: T[] = [];
  const addPriced = (row: T | undefined) => {
    if (row && candidates.length < slots && !candidates.includes(row)) candidates.push(row);
  };
  for (const id of preferredProviderIds) addPriced(priced.find(row => row.provider_id === id));
  if (preferredProviderId) addPriced(priced.find(row => row.provider_id === preferredProviderId));
  for (const row of priced) addPriced(row);

  // On paid plans, probe one new event each tick until the priced cohort fills;
  // once it is full, probe only at the bounded exploration interval. The
  // single-fixture trial retains its historical exploration behavior.
  const canExplore = explorationDue ||
    (slots > 1 ? candidates.length < slots : priced.length === 0);
  if (unpriced.length && canExplore) {
    const index = ((explorationIndex % unpriced.length) + unpriced.length) % unpriced.length;
    candidates.push(unpriced[index]!);
    return { candidates, explored: true };
  }
  return { candidates, explored: false };
}
