/**
 * Refresh an existing fixture's provider recency only when a current, trusted
 * in-play response identifies that exact event as still live. This does not
 * authorize or change its odds, market state, score, or settlement.
 */
export function confirmedExistingLiveFixtureIds(
  observed: readonly { providerId: string; status: string }[],
  knownIds: ReadonlySet<string>,
): string[] {
  return [...new Set(observed
    .filter(row => row.status === 'live' &&
      /^1:[0-9]{1,16}$/.test(row.providerId) &&
      knownIds.has(row.providerId))
    .map(row => row.providerId))];
}
