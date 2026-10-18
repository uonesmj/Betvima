/**
 * Sole public sports catalogue: BetsAPI Bet365.
 * A hard boundary separates external fixture IDs from wagerable internal UUIDs.
 * In particular this module never reads previously imported The Odds API rows.
 */
import { exploreBetsApi, type ExplorerFixture, type ExplorerList } from '@/providers/betsapi-explorer';
import type { MatchViewPayload } from '@/server/queries/public';

export const BETSAPI_SPORTS = [
  { key: 'football', id: 1, name: 'Football' },
  { key: 'basketball', id: 18, name: 'Basketball' },
  { key: 'tennis', id: 13, name: 'Tennis' },
  { key: 'volleyball', id: 91, name: 'Volleyball' },
  { key: 'ice-hockey', id: 17, name: 'Ice Hockey' },
  { key: 'cricket', id: 3, name: 'Cricket' },
  { key: 'handball', id: 78, name: 'Handball' },
  { key: 'baseball', id: 16, name: 'Baseball' },
  { key: 'american-football', id: 12, name: 'American Football' },
  { key: 'table-tennis', id: 92, name: 'Table Tennis' },
  { key: 'darts', id: 15, name: 'Darts' },
  { key: 'snooker', id: 14, name: 'Snooker' },
  { key: 'futsal', id: 83, name: 'Futsal' },
  { key: 'badminton', id: 94, name: 'Badminton' },
  { key: 'rugby-union', id: 8, name: 'Rugby Union' },
  { key: 'rugby-league', id: 19, name: 'Rugby League' },
  { key: 'australian-rules', id: 36, name: 'Australian Rules' },
  { key: 'floorball', id: 90, name: 'Floorball' },
  { key: 'beach-volleyball', id: 95, name: 'Beach Volleyball' },
  { key: 'water-polo', id: 110, name: 'Water Polo' },
  { key: 'squash', id: 107, name: 'Squash' },
  { key: 'esports', id: 151, name: 'E-sports' },
  { key: 'mma', id: 162, name: 'MMA / UFC' },
  { key: 'boxing', id: 9, name: 'Boxing' },
  { key: 'horse-racing', id: 2, name: 'Horse Racing' },
  { key: 'greyhounds', id: 4, name: 'Greyhounds' },
  { key: 'bowls', id: 66, name: 'Bowls' },
  { key: 'gaelic-sports', id: 75, name: 'Gaelic Sports' },
] as const;

export type BetsMode = 'live' | 'upcoming';
export function sportByKey(key: string) {
  return BETSAPI_SPORTS.find(item => item.key === (key === 'hockey' ? 'ice-hockey' : key));
}
export function betsApiToken(): string | null {
  return process.env.BETSAPI_PUBLIC_PREVIEW_ENABLED === 'true'
    && process.env.BETSAPI_TRIAL_ENABLED === 'true'
    ? process.env.BETSAPI_TRIAL_TOKEN?.trim() || null : null;
}
const memo = new Map<string, { expires: number; data: Promise<ExplorerList> }>();
/** One cached upstream read per sport/mode/page, coalesced across simultaneous requests. */
async function read(mode: BetsMode, sportId: number, page: number): Promise<ExplorerList> {
  const token = betsApiToken();
  const key = [mode, sportId, page, Boolean(token)].join(':');
  const now = Date.now();
  const prev = memo.get(key);
  if (prev && now < prev.expires) return prev.data;
  const data = exploreBetsApi(token, { mode, sportId, feed: 'bet365', page }).then(result => {
    if (!('fixtures' in result)) throw new Error('UNEXPECTED_BETSAPI_RESULT');
    return result;
  });
  memo.set(key, { expires: now + (mode === 'live' ? 60000 : 300000), data });
  if (memo.size > 250) {
    for (const [k, v] of memo) if (v.expires < now) memo.delete(k);
  }
  return data;
}

function parsedScore(score: string | null): [number | null, number | null] {
  if (!score || !/^\d{1,3}-\d{1,3}$/.test(score)) return [null, null];
  const [home, away] = score.split('-').map(Number);
  return [home ?? null, away ?? null];
}

/** External IDs are namespaced and never valid wager-placement UUIDs. */
export function sourceMatch(f: ExplorerFixture, sportKey: string, mode: BetsMode): MatchViewPayload {
  const [homeScore, awayScore] = parsedScore(f.score);
  return {
    id: `betsapi:${mode}:${f.sportId}:${f.fi ?? f.eventId ?? 'unlinked'}`,
    sportKey, leagueId: null, leagueName: f.league, leagueLogoUrl: null,
    countryCode: f.country, status: mode === 'live' ? 'live' : 'scheduled',
    scheduledAt: f.kickoff ?? '', minute: f.minute, period: null,
    homeScore, awayScore, isLive: mode === 'live', isBettingAvailable: false,
    participants: [
      { teamId: '', role: 'HOME', name: f.home, logoUrl: null },
      { teamId: '', role: 'AWAY', name: f.away, logoUrl: null },
    ],
    marketsCount: 0, topMarkets: [],
  };
}

export async function getBetsApiSport(mode: BetsMode, sportKey: string, page = 1) {
  const sport = sportByKey(sportKey);
  if (!sport) return { source: 'betsapi_bet365', matches: [], total: null, pageCount: null, error: 'UNSUPPORTED_SPORT', page, sportKey };
  const selectedPage = mode === 'live' ? 1 : Math.min(100, Math.max(1, page));
  try {
    const data = await read(mode, sport.id, selectedPage);
    return {
      source: 'betsapi_bet365' as const,
      matches: data.fixtures.map(f => sourceMatch(f, sport.key, mode)),
      total: data.total,
      pageCount: data.pageCount,
      error: data.error,
      page: selectedPage, sportKey: sport.key,
    };
  } catch {
    return { source: 'betsapi_bet365' as const, matches: [] as MatchViewPayload[],
      total: null, pageCount: null, error: 'PROVIDER_UNAVAILABLE', page: selectedPage, sportKey: sport.key };
  }
}

const HOMEPAGE_SPORTS = ['football', 'basketball', 'tennis', 'volleyball', 'ice-hockey', 'cricket', 'handball'];
export async function getBetsApiHomepage() {
  const [live, upcoming] = await Promise.all([
    Promise.all(HOMEPAGE_SPORTS.map(s => getBetsApiSport('live', s))),
    Promise.all(HOMEPAGE_SPORTS.map(s => getBetsApiSport('upcoming', s))),
  ]);
  const errors = [...live, ...upcoming].filter(x => x.error).map(x => x.sportKey + ': ' + x.error);
  const counts: Record<string, number> = {};
  for (const row of live) if (!row.error && row.total !== null) counts[row.sportKey] = row.total;
  const knownTotal = (rows: typeof live) => rows.every(x => !x.error && x.total !== null)
    ? rows.reduce((sum, x) => sum + (x.total ?? 0), 0) : null;
  return {
    source: 'betsapi_bet365' as const, readOnly: true as const,
    live: live.flatMap(x => x.matches.slice(0, 4)).slice(0, 12),
    upcoming: upcoming.flatMap(x => x.matches.slice(0, 4)).slice(0, 12),
    liveTotal: knownTotal(live), upcomingTotal: knownTotal(upcoming),
    liveSportCounts: counts, errors, configured: Boolean(betsApiToken()),
  };
}
