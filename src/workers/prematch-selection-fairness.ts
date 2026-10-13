/** 
 * Select fresh provider requests fairly when an API returns no quotes for
 * some old fixture IDs. A quote being stale must NEVER make a fixture occupy
 * the front of every limited provider batch.
 *
 * This module schedules attempts only; it cannot change selection status,
 * bookmaker timestamps, odds or bet placement authorization.
 */
export interface PrematchRefreshCandidate {
  match_id: string;
  provider_id: string | null;
  scheduled_at: string;
  status: string;
}

export type RefreshBucket = 'near' | 'mid' | 'far';

export interface PrematchRefreshLimits {
  near: number;
  mid: number;
  far: number;
}

export function selectFairPrematchRefreshes<T extends PrematchRefreshCandidate>(
  candidates: readonly T[],
  now: number,
  limits: PrematchRefreshLimits,
  enabled: { near: boolean; mid: boolean; far: boolean },
  lastAttemptedAt: Map<string, number>,
): T[] {
  const nearCutoff = now + 30 * 60_000;
  const midCutoff = now + 24 * 60 * 60_000;
  const output: T[] = [];

  const buckets: Record<RefreshBucket, T[]> = { near: [], mid: [], far: [] };
  for (const item of candidates) {
    if (item.status !== 'scheduled' || !item.provider_id) continue;
    const scheduled = Date.parse(item.scheduled_at);
    if (!Number.isFinite(scheduled) || scheduled <= now) continue;
    const bucket: RefreshBucket = scheduled <= nearCutoff ? 'near' : scheduled <= midCutoff ? 'mid' : 'far';
    if (!enabled[bucket]) continue;
    buckets[bucket].push(item);
  }

  for (const bucket of ['near', 'mid', 'far'] as const) {
    const limit = Math.max(0, Math.floor(limits[bucket]));
    if (!enabled[bucket] || limit === 0) continue;
    const sorted = buckets[bucket].sort((a, b) =>
      (lastAttemptedAt.get(a.match_id) ?? 0) - (lastAttemptedAt.get(b.match_id) ?? 0)
      || Date.parse(a.scheduled_at) - Date.parse(b.scheduled_at)
      || a.match_id.localeCompare(b.match_id),
    );
    for (const candidate of sorted.slice(0, limit)) {
      output.push(candidate);
      lastAttemptedAt.set(candidate.match_id, now);
    }
  }

  // Prune ancient attempts. Work happens only for current scheduled fixtures.
  if (lastAttemptedAt.size > 5000) {
    const active = new Set(candidates.map((c) => c.match_id));
    for (const matchId of lastAttemptedAt.keys()) {
      if (!active.has(matchId)) lastAttemptedAt.delete(matchId);
    }
  }

  return output;
}
