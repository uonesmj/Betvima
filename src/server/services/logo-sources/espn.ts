/**
 * ESPN unofficial site API — official team + league badges.
 *
 * Free, no API key, generous rate limits. Serves real club/league artwork
 * from a.espncdn.com for soccer, NBA, NFL, MLB and NHL.
 *
 * Docs: none official (undocumented JSON endpoints used by espn.com).
 *   Teams:  site.api.espn.com/apis/site/v2/sports/{sport}/{league}/teams
 *   League: site.api.espn.com/apis/site/v2/sports/{sport}/{league}/scoreboard
 */

import { matchTeamName } from "./normalize";

const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports";
const TIMEOUT_MS = 12_000;
const LEAGUE_GAP_MS = 350;
const INDEX_TTL_MS = 6 * 60 * 60_000;

/** Our sport slug -> ESPN sport slug + league slugs to index. */
export const ESPN_SPORT_LEAGUES: Record<string, { espnSport: string; leagues: string[] }> = {
  football: {
    espnSport: "soccer",
    leagues: [
      "eng.1", "eng.2",
      "esp.1", "esp.2",
      "ger.1", "ger.2",
      "ita.1", "ita.2",
      "fra.1", "fra.2",
      "ned.1", "por.1", "sco.1", "bel.1", "aut.1", "sui.1",
      "den.1", "nor.1", "swe.1", "tur.1", "gre.1", "rus.1",
      "ukr.1", "pol.1", "usa.1", "mex.1", "bra.1", "arg.1",
      "jpn.1", "kor.1", "chn.1", "aus.1",
      "uefa.champions", "uefa.europa", "conmebol.libertadores",
    ],
  },
  basketball: { espnSport: "basketball", leagues: ["nba", "wnba"] },
  "american-football": { espnSport: "football", leagues: ["nfl"] },
  baseball: { espnSport: "baseball", leagues: ["mlb"] },
  "ice-hockey": { espnSport: "hockey", leagues: ["nhl"] },
};

/** The Odds API sport key -> ESPN league path (precise league-logo lookup). */
export const ODDS_KEY_TO_ESPN: Record<string, string> = {
  soccer_epl: "soccer/eng.1",
  soccer_efl_champ: "soccer/eng.2",
  soccer_spain_la_liga: "soccer/esp.1",
  soccer_spain_segunda_division: "soccer/esp.2",
  soccer_germany_bundesliga: "soccer/ger.1",
  soccer_germany_bundesliga2: "soccer/ger.2",
  soccer_italy_serie_a: "soccer/ita.1",
  soccer_italy_serie_b: "soccer/ita.2",
  soccer_france_ligue_one: "soccer/fra.1",
  soccer_france_ligue_two: "soccer/fra.2",
  soccer_netherlands_eredivisie: "soccer/ned.1",
  soccer_portugal_primeira_liga: "soccer/por.1",
  soccer_spl: "soccer/sco.1",
  soccer_belgium_first_div: "soccer/bel.1",
  soccer_austria_bundesliga: "soccer/aut.1",
  soccer_switzerland_superleague: "soccer/sui.1",
  soccer_denmark_superliga: "soccer/den.1",
  soccer_norway_eliteserien: "soccer/nor.1",
  soccer_sweden_allsvenskan: "soccer/swe.1",
  soccer_turkey_super_league: "soccer/tur.1",
  soccer_greece_super_league: "soccer/gre.1",
  soccer_russia_premier_league: "soccer/rus.1",
  soccer_usa_mls: "soccer/usa.1",
  soccer_mexico_ligamx: "soccer/mex.1",
  soccer_brazil_campeonato: "soccer/bra.1",
  soccer_argentina_primera_division: "soccer/arg.1",
  soccer_japan_j_league: "soccer/jpn.1",
  soccer_korea_kleague1: "soccer/kor.1",
  soccer_china_superleague: "soccer/chn.1",
  soccer_uefa_champs_league: "soccer/uefa.champions",
  soccer_uefa_europa_league: "soccer/uefa.europa",
  basketball_nba: "basketball/nba",
  basketball_wnba: "basketball/wnba",
  baseball_mlb: "baseball/mlb",
  icehockey_nhl: "hockey/nhl",
  americanfootball_nfl: "football/nfl",
};

/** ESPN league directory for NAME-based league matching (non-Odds providers). */
export const ESPN_LEAGUE_DIRECTORY: Array<{ path: string; names: string[] }> = [
  { path: "soccer/eng.1", names: ["premier league", "epl", "english premier league"] },
  { path: "soccer/eng.2", names: ["championship", "efl championship", "english championship", "english league championship"] },
  { path: "soccer/esp.1", names: ["la liga", "laliga", "primera division", "spanish la liga"] },
  { path: "soccer/esp.2", names: ["segunda division", "la liga 2", "spanish segunda"] },
  { path: "soccer/ger.1", names: ["bundesliga", "german bundesliga"] },
  { path: "soccer/ger.2", names: ["2. bundesliga", "bundesliga 2", "german 2. bundesliga"] },
  { path: "soccer/ita.1", names: ["serie a", "italian serie a"] },
  { path: "soccer/ita.2", names: ["serie b", "italian serie b"] },
  { path: "soccer/fra.1", names: ["ligue 1", "french ligue 1"] },
  { path: "soccer/fra.2", names: ["ligue 2", "french ligue 2"] },
  { path: "soccer/ned.1", names: ["eredivisie", "dutch eredivisie"] },
  { path: "soccer/por.1", names: ["primeira liga", "liga portugal", "portuguese liga"] },
  { path: "soccer/sco.1", names: ["premiership", "scottish premiership"] },
  { path: "soccer/bel.1", names: ["belgium first div", "belgian pro league", "jupiler pro league"] },
  { path: "soccer/usa.1", names: ["mls", "major league soccer"] },
  { path: "soccer/mex.1", names: ["liga mx", "mexican liga mx"] },
  { path: "soccer/uefa.champions", names: ["champions league", "uefa champions league", "ucl"] },
  { path: "soccer/uefa.europa", names: ["europa league", "uefa europa league", "uel"] },
  { path: "basketball/nba", names: ["nba", "national basketball association"] },
  { path: "baseball/mlb", names: ["mlb", "major league baseball"] },
  { path: "hockey/nhl", names: ["nhl", "national hockey league"] },
  { path: "football/nfl", names: ["nfl", "national football league"] },
];

export interface EspnTeamEntry {
  name: string;
  abbreviation: string;
  logo: string | null;
  leaguePath: string;
}

async function fetchJson(path: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(ESPN_BASE + path, {
      signal: controller.signal,
      headers: { accept: "application/json", "user-agent": "BetVima-logo-pipeline/1.0" },
    });
    if (!response.ok) return null;
    return (await response.json()) as unknown;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function pickLogo(logos: unknown): string | null {
  if (!Array.isArray(logos)) return null;
  const items = logos.filter(
    (item): item is { href?: unknown; rel?: unknown } =>
      typeof item === "object" && item !== null,
  );
  // Prefer the default full-color mark (skip dark variants for light cards).
  const preferred =
    items.find((item) => {
      const href = typeof item.href === "string" ? item.href : "";
      const rel = Array.isArray(item.rel) ? item.rel.join(" ") : "";
      return href.startsWith("https://") && !href.includes("dark") && rel.includes("default");
    }) ??
    items.find((item) => {
      const href = typeof item.href === "string" ? item.href : "";
      return href.startsWith("https://") && !href.includes("dark");
    }) ??
    items.find((item) => typeof item.href === "string" && item.href.startsWith("https://"));
  const href = preferred && typeof preferred.href === "string" ? preferred.href : null;
  return href && href.includes("espncdn.com") ? href : null;
}

function extractLeagueNode(data: unknown): Record<string, unknown> | null {
  if (typeof data !== "object" || data === null) return null;
  const root = data as Record<string, unknown>;
  const sports = Array.isArray(root.sports) ? root.sports : [];
  const first = sports[0] as Record<string, unknown> | undefined;
  const leagues = first && Array.isArray(first.leagues) ? first.leagues : [];
  const league = leagues[0] as Record<string, unknown> | undefined;
  return league ?? null;
}

/** Fetch all teams (+logos) of one ESPN league. Fails soft -> []. */
export async function fetchEspnLeagueTeams(leaguePath: string): Promise<EspnTeamEntry[]> {
  const data = await fetchJson("/" + leaguePath + "/teams?limit=500");
  const league = extractLeagueNode(data);
  if (!league || !Array.isArray(league.teams)) return [];
  const entries: EspnTeamEntry[] = [];
  for (const row of league.teams) {
    if (typeof row !== "object" || row === null) continue;
    const team = (row as Record<string, unknown>).team as Record<string, unknown> | undefined;
    if (!team || typeof team.displayName !== "string") continue;
    entries.push({
      name: team.displayName,
      abbreviation: typeof team.abbreviation === "string" ? team.abbreviation : "",
      logo: pickLogo(team.logos),
      leaguePath,
    });
  }
  return entries;
}

/** Official league badge via the scoreboard endpoint. Fails soft -> null. */
export async function fetchEspnLeagueLogo(leaguePath: string): Promise<string | null> {
  const data = await fetchJson("/" + leaguePath + "/scoreboard?limit=1");
  if (typeof data !== "object" || data === null) return null;
  const leagues = (data as Record<string, unknown>).leagues;
  if (!Array.isArray(leagues) || leagues.length === 0) return null;
  const first = leagues[0] as Record<string, unknown>;
  return pickLogo(first.logos);
}

// ---------------------------------------------------------------------------
// In-memory per-sport team index (rebuilt lazily, 6h TTL).
// ---------------------------------------------------------------------------

interface SportIndex {
  builtAt: number;
  byName: Map<string, EspnTeamEntry>;
  names: string[];
}

const indexCache = new Map<string, SportIndex>();
const building = new Map<string, Promise<SportIndex>>();

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function buildSportIndex(sportSlug: string): Promise<SportIndex> {
  const config = ESPN_SPORT_LEAGUES[sportSlug];
  const empty: SportIndex = { builtAt: Date.now(), byName: new Map(), names: [] };
  if (!config) return empty;
  const byName = new Map<string, EspnTeamEntry>();
  for (const league of config.leagues) {
    const leaguePath = config.espnSport + "/" + league;
    try {
      const teams = await fetchEspnLeagueTeams(leaguePath);
      for (const team of teams) {
        // First league wins; keep entries that actually have a logo.
        if (!byName.has(team.name) && team.logo) byName.set(team.name, team);
        if (!byName.has(team.name) && !team.logo) byName.set(team.name, team);
      }
    } catch {
      // Unknown league slug / network blip: skip, other leagues still count.
    }
    await sleep(LEAGUE_GAP_MS);
  }
  const index: SportIndex = { builtAt: Date.now(), byName, names: [...byName.keys()] };
  indexCache.set(sportSlug, index);
  return index;
}

async function getSportIndex(sportSlug: string): Promise<SportIndex> {
  const cached = indexCache.get(sportSlug);
  if (cached && Date.now() - cached.builtAt < INDEX_TTL_MS) return cached;
  const pending = building.get(sportSlug);
  if (pending) return pending;
  const job = buildSportIndex(sportSlug).finally(() => {
    building.delete(sportSlug);
  });
  building.set(sportSlug, job);
  return job;
}

export interface EspnTeamMatch {
  logo: string;
  matchedName: string;
  leaguePath: string;
}

/** Find an official ESPN badge for a team name within a sport. */
export async function findEspnTeamLogo(
  teamName: string,
  sportSlug: string,
): Promise<EspnTeamMatch | null> {
  if (!ESPN_SPORT_LEAGUES[sportSlug]) return null;
  const index = await getSportIndex(sportSlug);
  if (index.names.length === 0) return null;
  const match = matchTeamName(teamName, index.names);
  if (!match) return null;
  const entry = index.byName.get(match.candidate);
  if (!entry || !entry.logo) return null;
  return { logo: entry.logo, matchedName: entry.name, leaguePath: entry.leaguePath };
}

/** Resolve an ESPN league path from an Odds-API sport key or a league name. */
export function resolveEspnLeaguePath(input: { leagueSlug?: string | null; leagueName?: string | null }): string | null {
  const slug = (input.leagueSlug ?? "").trim().toLowerCase();
  if (slug && ODDS_KEY_TO_ESPN[slug]) return ODDS_KEY_TO_ESPN[slug] as string;
  const name = (input.leagueName ?? "").trim().toLowerCase();
  if (!name) return null;
  const squashed = name.split(" - ")[0] ?? name;
  for (const row of ESPN_LEAGUE_DIRECTORY) {
    for (const candidate of row.names) {
      if (name === candidate || squashed.trim() === candidate || name.includes(candidate)) {
        return row.path;
      }
    }
  }
  return null;
}

/** Official ESPN badge for a league (by Odds key or name). Fails soft. */
export async function findEspnLeagueLogo(input: {
  leagueSlug?: string | null;
  leagueName?: string | null;
}): Promise<string | null> {
  const path = resolveEspnLeaguePath(input);
  if (!path) return null;
  return fetchEspnLeagueLogo(path);
}

export function espnEnabled(): boolean {
  return (process.env.LOGO_ESPN_ENABLED ?? "true").toLowerCase() !== "false";
}
