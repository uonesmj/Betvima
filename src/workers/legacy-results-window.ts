/**
 * Select one UTC kickoff day from existing, unresolved FiveDollar fixtures.
 * Result requests are scoped to that day; never scan a multi-month API window.
 * Rows must already have been filtered by the DB to provider-owned matches
 * with an unsettled bet. This helper never discovers or creates fixtures.
 */
export interface LegacyResultCandidate {
  provider_id: string | null;
  scheduled_at: string;
}

export function selectLegacyResultWindow<T extends LegacyResultCandidate>(
  candidates: readonly T[],
  cursor: number,
  maxMatches = 50,
): {
  from: string;
  to: string;
  matches: T[];
  day: string;
  daysInBacklog: number;
} | null {
  const byDay = new Map<string, T[]>();

  for (const row of candidates) {
    if (!row.provider_id) continue;
    const time = new Date(row.scheduled_at).getTime();
    if (!Number.isFinite(time)) continue;
    const day = new Date(time).toISOString().slice(0, 10);
    const rows = byDay.get(day) ?? [];
    rows.push(row);
    byDay.set(day, rows);
  }

  const days = [...byDay.keys()].sort().reverse();
  if (days.length === 0) return null;

  const position = Number.isSafeInteger(cursor) && cursor >= 0 ? cursor % days.length : 0;
  const day = days[position]!;
  const from = `${day}T00:00:00.000Z`;
  const to = new Date(Date.parse(from) + 24 * 60 * 60 * 1000).toISOString();

  return {
    from,
    to,
    matches: byDay.get(day)!.slice(0, Math.max(1, Math.min(100, Math.trunc(maxMatches) || 50))),
    day,
    daysInBacklog: days.length,
  };
}
