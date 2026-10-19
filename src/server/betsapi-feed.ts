/**
 * Sole public sports catalogue: BetsAPI Bet365.
 * A hard boundary separates external fixture IDs from wagerable internal UUIDs.
 * In particular this module never reads previously imported The Odds API rows.
 */
import { exploreBetsApi, type ExplorerFixture, type ExplorerList } from '@/providers/betsapi-explorer';
import { BETSAPI_SPORTS, sportByKey, type BetsMode } from '@/lib/betsapi-sports-map';
import type { MatchViewPayload } from '@/server/queries/public';
import { attachBet365Logos } from '@/server/betsapi-logos';
import { supplementBet365LiveMinutes } from '@/server/betsapi-fixture-clock';

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
  memo.set(key, { expires: now + (mode === 'live' ? 15000 : 90000), data });
  if (memo.size > 250) {
    for (const [k, v] of memo) if (v.expires < now) memo.delete(k);
  }
  return data;
}

/**
 * Bet365 inplay_filter supplies scores/fixtures but usually has no 'timer'.
 * Events inplay carries 'timer.tm' for the SAME event through our_event_id.
 * One coalesced, 45s-cached, football-only request across all visitors keeps
 * subscription usage bounded. Do not match teams solely by name/league.
 */
let eventsClockCache: { expires: number; result: Promise<ExplorerList> } | null = null;
async function liveFootballClocks(): Promise<ExplorerList> {
  const now = Date.now();
  if (eventsClockCache && now < eventsClockCache.expires) return eventsClockCache.result;
  const result = exploreBetsApi(betsApiToken(), {
    mode: 'live', feed: 'events', sportId: 1,
  }) as Promise<ExplorerList>;
  eventsClockCache = { expires: now + 45_000, result };
  return result;
}

export function fillBetsApiMissingMinutes(
  fixtures: ExplorerFixture[], events: ExplorerFixture[],
): ExplorerFixture[] {
  const byId = new Map(events.filter(event => event.eventId && event.minute !== null)
    .map(event => [event.eventId, event]));
  return fixtures.map(fixture => {
    if (fixture.minute !== null || !fixture.eventId) return fixture;
    const event = byId.get(fixture.eventId);
    if (!event || event.minute === null ||
        (event.fi !== null && fixture.fi !== event.fi)) return fixture;
    // Events API and Bet365 may use different translations/abbreviations of
    // team names. A confirmed linked FI is stronger than text labels.
    if (event.fi === null && (
        event.home.trim().toLowerCase() !== fixture.home.trim().toLowerCase() ||
        event.away.trim().toLowerCase() !== fixture.away.trim().toLowerCase()
    )) return fixture;
    return { ...fixture, minute: event.minute };
  });
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
    // External Bet365 league IDs must never occupy local UUID slots.
    sportKey, leagueId: null, leagueName: f.league, leagueLogoUrl: f.leagueLogoUrl ?? null,
    countryCode: f.country, status: mode === 'live' ? 'live' : 'scheduled',
    scheduledAt: f.kickoff ?? '', minute: f.minute, period: null,
    homeScore, awayScore, isLive: mode === 'live', isBettingAvailable: false,
    participants: [
      { teamId: '', role: 'HOME', name: f.home, logoUrl: f.homeLogoUrl ?? null },
      { teamId: '', role: 'AWAY', name: f.away, logoUrl: f.awayLogoUrl ?? null },
    ],
    marketsCount: 0, topMarkets: [],
  };
}

export async function getBetsApiSport(mode: BetsMode, sportKey: string, page = 1, leagueId?: string) {
  const sport = sportByKey(sportKey);
  if (!sport) return { source: 'betsapi_bet365', matches: [], total: null, pageCount: null, error: 'UNSUPPORTED_SPORT', page, sportKey };
  const selectedPage = mode === 'live' ? 1 : Math.min(100, Math.max(1, page));
  try {
    const data = leagueId ? await exploreBetsApi(betsApiToken(), { mode, sportId: sport.id, feed: 'bet365', page: selectedPage, leagueId }) as ExplorerList : await read(mode, sport.id, selectedPage);
    let fixtures = data.fixtures;
    if (mode === 'live' && sport.id === 1 && fixtures.some(f => f.minute === null && f.eventId)) {
      // Only Events IDs explicitly bridged by Bet365 are eligible.
      const events = await liveFootballClocks().catch(() => null);
      if (events && !events.error) fixtures = fillBetsApiMissingMinutes(fixtures, events.fixtures);
    }
    // The Android Home carousel and full Live list both consume 'minute' from
    // this SAME catalogue; there is no reason to change their card layout.
    if (mode === 'live' && sport.id === 1 && fixtures.some(f => f.minute === null && f.fi)) {
      fixtures = await supplementBet365LiveMinutes(fixtures);
    }
    const matches = await attachBet365Logos(fixtures.map(f => sourceMatch(f, sport.key, mode)), sport.key);
    return {
      source: 'betsapi_bet365' as const,
      matches,
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
