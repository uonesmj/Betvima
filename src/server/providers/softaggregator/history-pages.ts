import type { ProviderRound } from './reconcile';

export type CasinoHistoryPage = {
  total: number;
  rounds: ProviderRound[];
  limit?: number;
  offset?: number;
};

/**
 * Read every vendor history page. A first-page match never proves ledger
 * completeness. Bound the scan and refuse partial, drifting, or duplicate
 * pages instead of quietly declaring a small subset reconciled.
 */
export async function readCompleteCasinoHistory(
  load: (limit: number, offset: number) => Promise<CasinoHistoryPage>,
  limit = 200,
  maxRounds = 2_000,
): Promise<ProviderRound[]> {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 500 ||
      !Number.isSafeInteger(maxRounds) || maxRounds < 1)
    throw new Error('CASINO_HISTORY_LIMIT_INVALID');
  const seen = new Set<string>();
  const all: ProviderRound[] = [];
  let expectedTotal: number | null = null;

  for (;;) {
    const offset = all.length;
    const page = await load(limit, offset);
    if (!page || !Array.isArray(page.rounds) ||
        !Number.isSafeInteger(page.total) || page.total < 0 ||
        page.total > maxRounds)
      throw new Error('CASINO_HISTORY_PAGE_INVALID');

    if (expectedTotal === null) expectedTotal = page.total;
    else if (expectedTotal !== page.total) throw new Error('CASINO_HISTORY_CHANGED_DURING_AUDIT');

    if (page.rounds.length > limit ||
        page.rounds.length > expectedTotal - all.length ||
        (expectedTotal > all.length && page.rounds.length === 0))
      throw new Error('CASINO_HISTORY_PAGE_INCOMPLETE');
    if (page.offset !== undefined && page.offset !== offset)
      throw new Error('CASINO_HISTORY_OFFSET_MISMATCH');

    for (const round of page.rounds) {
      if (typeof round?.round_id !== 'string' || !round.round_id ||
          typeof round.gameid !== 'string' || !round.gameid ||
          ('currency' in round && round.currency !== 'USD'))
        throw new Error('CASINO_HISTORY_ROUND_INVALID');
      const key = JSON.stringify([round.round_id, round.gameid]);
      if (seen.has(key)) throw new Error('CASINO_HISTORY_DUPLICATE_ROUND');
      seen.add(key);
      all.push(round);
    }
    if (all.length >= expectedTotal) return all;
  }
}
