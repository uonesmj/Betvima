/**
 * Factual match information only, independent from sportsbook markets.
 * Never infer a statistic, event identity, stadium or result from prices.
 */
import {
  request, ExplorerUpstreamError, type ExplorerError,
} from './betsapi-explorer';
import { object, string } from './betsapi-normalization';
import { betsApiLiveMinute } from './betsapi-match-clock';

const rec = object;
const val = (x: unknown) => string(x).trim();
type Fetcher = typeof fetch;
const safeError = (error: unknown): ExplorerError =>
  error instanceof ExplorerUpstreamError ? error.code : 'UPSTREAM_UNAVAILABLE';
const numeric = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const s = val(value);
  if (!/^\d{1,6}(?:\.\d{1,2})?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};
const epoch = (value: unknown): string | null => {
  const sec = Number(value);
  return Number.isFinite(sec) && sec >= 1500000000 && sec < 4102444800
    ? new Date(sec * 1000).toISOString() : null;
};
const normalize = (name: string) =>
  name.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const eventId = (x: unknown): string | null =>
  /^\d{1,16}$/.test(val(x)) ? val(x) : null;

export interface StatLine {
  key: string;
  en: string;
  fa: string;
  home: number | null;
  away: number | null;
}
export interface MatchLiveFacts {
  fi: string;
  score: string | null;
  minute: number | null;
  home: string | null;
  away: string | null;
  stats: StatLine[];
  updatedAt: string;
  error: ExplorerError | null;
}
export interface MatchEventItem {
  id: string;
  home: string;
  away: string;
  homeId: string | null;
  awayId: string | null;
  kickoff: string | null;
  score: string | null;
  league: string | null;
  status: 'finished' | 'upcoming' | 'live';
}
export interface MatchBackground {
  matched: boolean;
  stadium: string | null;
  city: string | null;
  country: string | null;
  referee: string | null;
  home: string | null;
  away: string | null;
  kickoff: string | null;
  pastHome: MatchEventItem[];
  pastAway: MatchEventItem[];
  h2h: MatchEventItem[];
  nextHome: MatchEventItem[];
  nextAway: MatchEventItem[];
  updatedAt: string;
  error: ExplorerError | null;
}

type Metric = { key: string; en: string; fa: string; codes: string[] };
const METRICS: Metric[] = [
  { key: 'corners', en: 'Corners', fa: 'کرنر', codes: ['corners', 'corner', 'icorner'] },
  { key: 'throwins', en: 'Throw-ins', fa: 'اوت دستی', codes: ['throwins', 'throwin', 'ithrowin'] },
  { key: 'fouls', en: 'Fouls', fa: 'خطا', codes: ['fouls', 'foul', 'ifoul'] },
  { key: 'offsides', en: 'Offsides', fa: 'آفساید', codes: ['offsides', 'offside', 'ioffside'] },
  { key: 'yellowcards', en: 'Yellow cards', fa: 'کارت زرد', codes: ['yellowcards', 'yellowcard', 'iyellowcard'] },
  { key: 'redcards', en: 'Red cards', fa: 'کارت قرمز', codes: ['redcards', 'redcard', 'iredcard'] },
  { key: 'on_target', en: 'Shots on target', fa: 'شوت در چارچوب', codes: ['ontarget', 'shotontarget', 'shotstarget'] },
  { key: 'off_target', en: 'Shots off target', fa: 'شوت خارج چارچوب', codes: ['offtarget', 'shotsofftarget'] },
  { key: 'possession', en: 'Possession %', fa: 'مالکیت توپ٪', codes: ['possession', 'possessionrt', 'possession%'] },
  { key: 'attacks', en: 'Attacks', fa: 'حملات', codes: ['attacks', 'attack'] },
  { key: 'dangerous_attacks', en: 'Dangerous attacks', fa: 'حملات خطرناک', codes: ['dangerousattacks'] },
  { key: 'freekicks', en: 'Free kicks', fa: 'ضربات آزاد', codes: ['freekicks', 'freekick', 'ifreekick'] },
  { key: 'goalkicks', en: 'Goal kicks', fa: 'ضربات دروازه', codes: ['goalkicks', 'goalkick', 'igoalkick'] },
];
const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9%]/g, '');
function labelMetric(name: string) {
  return METRICS.find(m => m.codes.includes(clean(name)));
}
function traverse(value: unknown, sink: Record<string, unknown>[], depth = 0): void {
  if (depth > 8 || sink.length >= 25000) return;
  if (Array.isArray(value)) {
    for (const child of value) traverse(child, sink, depth + 1);
  } else if (value && typeof value === 'object') {
    const row = rec(value);
    if (typeof row.type === 'string') sink.push(row);
    // A Bet365 response has arrays nested under results, not under every key.
    if (row.results) traverse(row.results, sink, depth + 1);
  }
}

export function parseBet365MatchStats(fi: string, payload: unknown): MatchLiveFacts {
  const rows: Record<string, unknown>[] = [];
  traverse(payload, rows);
  const event = rows.find(row => row.type === 'EV');
  const teams = rows.filter(row => row.type === 'TE');
  const homeTeam = teams.find(row => val(row.ID) === '1') ?? teams[0];
  const awayTeam = teams.find(row => val(row.ID) === '2') ?? teams[1];
  const home = val(homeTeam?.NA) || null, away = val(awayTeam?.NA) || null;
  const values = new Map<string, [number | null, number | null]>();
  // Explicit EV column heading S1..S8 is paired with corresponding TE cell.
  for (let i = 1; i <= 8; i++) {
    const name = val(event?.['S' + i]);
    const metric = labelMetric(name);
    if (!metric) continue;
    const h = numeric(homeTeam?.['S' + i]), a = numeric(awayTeam?.['S' + i]);
    if (h !== null || a !== null) values.set(metric.key, [h, a]);
  }
  // SC is an extra stat name; its two following SL rows contain the actual
  // left and right values (D1), not bookmaker PA prices.
  let current: Metric | null = null;
  let h: number | null = null, a: number | null = null;
  const flush = () => {
    if (current && (h !== null || a !== null) && !values.has(current.key))
      values.set(current.key, [h, a]);
  };
  for (const row of rows) {
    if (row.type === 'SC') {
      flush(); current = labelMetric(val(row.NA)) ?? null; h = null; a = null;
    } else if (row.type === 'SL' && current) {
      if (val(row.ID) === '0') h = numeric(row.D1);
      if (val(row.ID) === '1') a = numeric(row.D1);
    } else if (row.type === 'MG') {
      flush(); current = null; h = null; a = null;
    }
  }
  flush();
  const stats = METRICS.filter(metric => values.has(metric.key)).map(metric => ({
    key: metric.key, en: metric.en, fa: metric.fa,
    home: values.get(metric.key)?.[0] ?? null,
    away: values.get(metric.key)?.[1] ?? null,
  }));
  const score = val(event?.SS);
  return {
    fi, home, away, score: /^\d{1,3}-\d{1,3}$/.test(score) ? score : null,
    minute: event ? betsApiLiveMinute(event) : null,
    stats, updatedAt: new Date().toISOString(), error: null,
  };
}
function eventItem(raw: unknown): MatchEventItem | null {
  const row = rec(raw), home = rec(row.home), away = rec(row.away);
  const id = eventId(row.id), homeName = val(home.name), awayName = val(away.name);
  if (!id || !homeName || !awayName) return null;
  const status = val(row.time_status);
  const score = val(row.ss);
  return {
    id, home: homeName, away: awayName, homeId: eventId(home.id), awayId: eventId(away.id),
    kickoff: epoch(row.time), score: /^\d{1,3}-\d{1,3}$/.test(score) ? score : null,
    league: val(rec(row.league).name) || null,
    status: status === '3' ? 'finished' : status === '1' ? 'live' : 'upcoming',
  };
}
const matchList = (v: unknown) =>
  (Array.isArray(v) ? v : []).map(eventItem).filter((e): e is MatchEventItem => e !== null).slice(0, 8);

/** The search API uses Events IDs, never Bet365 FI. Verify both teams & time. */
export function resolveEventsMatch(
  result: unknown, fi: string, home: string, away: string, when: string,
): MatchEventItem | null {
  const start = Date.parse(when);
  if (!Number.isFinite(start) || !home || !away) return null;
  const records = Array.isArray(result) ? result : [];
  for (const raw of records) {
    const row = rec(raw), event = eventItem(raw);
    if (!event || !event.kickoff) continue;
    const upstreamFi = eventId(row.bet365_id);
    if (upstreamFi && upstreamFi !== fi) continue;
    if (normalize(event.home) !== normalize(home) ||
        normalize(event.away) !== normalize(away)) continue;
    if (Math.abs(Date.parse(event.kickoff) - start) > 3 * 60 * 60_000) continue;
    return event;
  }
  return null;
}

const emptyBackground = (): MatchBackground => ({
  matched: false, stadium: null, city: null, country: null, referee: null,
  home: null, away: null, kickoff: null,
  pastHome: [], pastAway: [], h2h: [], nextHome: [], nextAway: [],
  updatedAt: new Date().toISOString(), error: null,
});
export async function fetchMatchLiveFacts(token: string | null, fi: string,
  fetcher: Fetcher = fetch): Promise<MatchLiveFacts> {
  const empty: MatchLiveFacts = {
    fi, home: null, away: null, score: null, minute: null,
    stats: [], updatedAt: new Date().toISOString(),
    error: token ? null : 'NOT_CONFIGURED',
  };
  if (!token) return empty;
  try {
    const response = await request(token, '/v1/bet365/event',
      { FI: fi, stats: '1' }, fetcher, 15_000);
    return parseBet365MatchStats(fi, response.results);
  } catch (error) { return { ...empty, error: safeError(error) }; }
}
export async function fetchMatchBackground(
  token: string | null, fi: string, sportId: number,
  home: string, away: string, kickoff: string,
  fetcher: Fetcher = fetch,
): Promise<MatchBackground> {
  const empty = emptyBackground();
  if (!token) return { ...empty, error: 'NOT_CONFIGURED' };
  if (!/^\d{1,16}$/.test(fi) || !/^\d{1,4}$/.test(String(sportId)) ||
      !home || !away || !Number.isFinite(Date.parse(kickoff)))
    return empty;
  try {
    const search = await request(token, '/v1/events/search', {
      sport_id: String(sportId), home, away, time: String(Math.floor(Date.parse(kickoff) / 1000)),
    }, fetcher, 600_000);
    const match = resolveEventsMatch(search.results, fi, home, away, kickoff);
    if (!match) return empty; // Do not show another match's history or stadium!
    const viewResp = await request(token, '/v1/event/view',
      { event_id: match.id }, fetcher, 600_000);
    const view = rec(Array.isArray(viewResp.results) ? viewResp.results[0] : viewResp.results);
    const extra = rec(view.extra), venue = rec(extra.stadium_data);
    const realHome = rec(view.home), realAway = rec(view.away);
    const hId = eventId(realHome.id) ?? match.homeId;
    const aId = eventId(realAway.id) ?? match.awayId;
    const [historyResp, homeNext, awayNext] = await Promise.all([
      request(token, '/v1/event/history', { event_id: match.id, qty: '8' }, fetcher, 600_000)
        .catch(() => null),
      hId ? request(token, '/v3/events/upcoming',
        { sport_id: String(sportId), team_id: hId }, fetcher, 300_000).catch(() => null) : Promise.resolve(null),
      aId ? request(token, '/v3/events/upcoming',
        { sport_id: String(sportId), team_id: aId }, fetcher, 300_000).catch(() => null) : Promise.resolve(null),
    ]);
    const past = rec(historyResp?.results);
    const nextOf = (response: { results?: unknown } | null, teamId: string | null) => {
      if (!teamId) return [];
      return matchList(response?.results).filter(e =>
        (e.homeId === teamId || e.awayId === teamId)
        && e.id !== match.id && e.status === 'upcoming');
    };
    return {
      matched: true,
      home: val(realHome.name) || home, away: val(realAway.name) || away,
      kickoff: epoch(view.time) ?? match.kickoff,
      stadium: val(venue.name) || val(extra.stadium) || null,
      city: val(venue.city) || null,
      country: val(venue.country) || null,
      referee: val(rec(extra.referee).name) || null,
      pastHome: matchList(past.home), pastAway: matchList(past.away),
      h2h: matchList(past.h2h), nextHome: nextOf(homeNext, hId),
      nextAway: nextOf(awayNext, aId),
      updatedAt: new Date().toISOString(), error: null,
    };
  } catch (error) { return { ...empty, error: safeError(error) }; }
}
