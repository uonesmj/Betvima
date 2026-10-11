/**
 * TheSportsDB fallback — real badges for sports ESPN does not cover
 * (volleyball, handball, cricket, lower football leagues, ...).
 *
 * The free search endpoint is fuzzy and can return teams from the WRONG
 * sport ("LA Lakers" once matched an American-football club named Roosevelt),
 * so every candidate is verified: the provider's strSport MUST match the
 * expected sport, and the name MUST match conservatively. Anything dubious
 * resolves to null (no logo) rather than a wrong logo.
 */

import { matchTeamName, normalizeName } from "./normalize";

const TIMEOUT_MS = 10_000;
/** Minimum gap between SportsDB calls (free key is heavily rate-limited). */
const CALL_GAP_MS = 1_400;

function baseUrl(): string {
  const key = (process.env.LOGO_SPORTSDB_API_KEY ?? "123").trim() || "123";
  return "https://www.thesportsdb.com/api/v1/json/" + key;
}

/** Our sport slug -> acceptable provider strSport values (lowercased). */
const EXPECTED_SPORT: Record<string, string[]> = {
  football: ["soccer"],
  basketball: ["basketball"],
  volleyball: ["volleyball"],
  handball: ["handball"],
  baseball: ["baseball"],
  "american-football": ["american football", "american-football"],
  "ice-hockey": ["ice hockey", "ice-hockey", "hockey"],
  cricket: ["cricket"],
  "table-tennis": ["table tennis", "table-tennis"],
  esports: ["esports", "e-sports"],
};

/**
 * Individual sports have no team badges (tennis/boxing/MMA "teams" are
 * athletes). Skip the API entirely: no real logo exists, and fuzzy search
 * would only risk wrong matches.
 */
const SKIPPED_SPORTS = new Set(["tennis", "boxing", "mma"]);

// Serialize all SportsDB calls through one promise chain (concurrency 1).
let chain: Promise<void> = Promise.resolve();

async function throttled<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(async () => {
    const result = await fn();
    await new Promise<void>((resolve) => setTimeout(resolve, CALL_GAP_MS));
    return result;
  });
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function fetchJson(path: string): Promise<Record<string, unknown> | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(baseUrl() + path, {
      signal: controller.signal,
      headers: { accept: "application/json", "user-agent": "BetVima-logo-pipeline/1.0" },
    });
    if (!response.ok) return null;
    const data = (await response.json()) as unknown;
    return typeof data === "object" && data !== null ? (data as Record<string, unknown>) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function validBadge(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const url = value.trim();
  if (!url.startsWith("https://")) return null;
  if (!url.includes("thesportsdb.com")) return null;
  return url;
}

export interface SportsDbTeamMatch {
  logo: string;
  matchedName: string;
  providerSport: string;
}

/** Verified real badge for a team, or null when unsure. */
export async function findSportsDbTeamLogo(
  teamName: string,
  sportSlug: string,
): Promise<SportsDbTeamMatch | null> {
  if (SKIPPED_SPORTS.has(sportSlug)) return null;
  const expected = EXPECTED_SPORT[sportSlug];
  if (!expected || normalizeName(teamName) === "") return null;

  return throttled(async () => {
    const data = await fetchJson("/searchteams.php?t=" + encodeURIComponent(teamName.trim()));
    const teams = data && Array.isArray(data.teams) ? data.teams : [];
    // Exact-name candidates first, then the rest — all sport-verified.
    const rows = teams.filter(
      (row): row is Record<string, unknown> => typeof row === "object" && row !== null,
    );
    const names = rows.map((row) => String(row.strTeam ?? ""));
    const match = matchTeamName(teamName, names);
    const ordered = match
      ? [...rows.filter((row) => String(row.strTeam ?? "") === match.candidate), ...rows.filter((row) => String(row.strTeam ?? "") !== match.candidate)]
      : rows;
    for (const row of ordered) {
      const providerSport = String(row.strSport ?? "").trim().toLowerCase();
      if (!expected.includes(providerSport)) continue;
      const rowName = String(row.strTeam ?? "");
      const rowMatch = matchTeamName(teamName, [rowName]);
      if (!rowMatch) continue;
      const badge = validBadge(row.strBadge);
      if (!badge) continue;
      return { logo: badge, matchedName: rowName, providerSport };
    }
    return null;
  });
}

// ---------------------------------------------------------------------------
// League lookup by SportsDB id (kept from the original resolver).
// ---------------------------------------------------------------------------

const SPORTSDB_LEAGUE_IDS: Record<string, number> = {
  soccer_epl: 4328, soccer_efl_champ: 4329, soccer_england_efl_cup: 4570,
  soccer_germany_bundesliga: 4331, soccer_germany_bundesliga2: 4399,
  soccer_france_ligue_one: 4334, soccer_france_ligue_two: 4401,
  soccer_italy_serie_a: 4332, soccer_italy_serie_b: 4394,
  soccer_spain_la_liga: 4335, soccer_netherlands_eredivisie: 4337,
  soccer_belgium_first_div: 4338, soccer_spl: 4330,
  soccer_austria_bundesliga: 4621, soccer_denmark_superliga: 4340,
  soccer_norway_eliteserien: 4358, soccer_sweden_allsvenskan: 4347,
  soccer_poland_ekstraklasa: 4422, soccer_usa_mls: 4346,
  soccer_mexico_ligamx: 4350, soccer_korea_kleague1: 4689,
  soccer_japan_j_league: 4633, soccer_china_superleague: 4359,
  soccer_finland_veikkausliiga: 4636, soccer_russia_premier_league: 4355,
  soccer_greece_super_league: 4336, soccer_brazil_campeonato: 4351,
  soccer_brazil_serie_b: 4404, soccer_portugal_primeira_liga: 4344,
  soccer_argentina_primera_division: 4406, soccer_sweden_superettan: 4403,
  soccer_switzerland_superleague: 4675, soccer_turkey_super_league: 4339,
  soccer_league_of_ireland: 4643, soccer_england_league1: 4396,
  soccer_england_league2: 4397, soccer_spain_segunda_division: 4400,
  soccer_uefa_europa_league: 4481, soccer_uefa_nations_league: 4490,
};

const LEAGUE_ALIASES: Record<string, string> = {
  epl: "soccer_epl", championship: "soccer_efl_champ",
  "efl cup": "soccer_england_efl_cup",
  "bundesliga - germany": "soccer_germany_bundesliga",
  "bundesliga 2 - germany": "soccer_germany_bundesliga2",
  "ligue 1 - france": "soccer_france_ligue_one",
  "ligue 2 - france": "soccer_france_ligue_two",
  "serie a - italy": "soccer_italy_serie_a",
  "serie b - italy": "soccer_italy_serie_b",
  "la liga - spain": "soccer_spain_la_liga",
  "dutch eredivisie": "soccer_netherlands_eredivisie",
  "belgium first div": "soccer_belgium_first_div",
  "premiership - scotland": "soccer_spl",
  "austrian football bundesliga": "soccer_austria_bundesliga",
  "denmark superliga": "soccer_denmark_superliga",
  "eliteserien - norway": "soccer_norway_eliteserien",
  "allsvenskan - sweden": "soccer_sweden_allsvenskan",
  "ekstraklasa - poland": "soccer_poland_ekstraklasa",
  mls: "soccer_usa_mls", "liga mx": "soccer_mexico_ligamx",
  "k league 1": "soccer_korea_kleague1",
  "j league": "soccer_japan_j_league",
  "super league - china": "soccer_china_superleague",
  "veikkausliiga - finland": "soccer_finland_veikkausliiga",
  "turkey super league": "soccer_turkey_super_league",
  "premier league - russia": "soccer_russia_premier_league",
  "brazil serie a": "soccer_brazil_campeonato",
  "superettan - sweden": "soccer_sweden_superettan",
  "brazil serie b": "soccer_brazil_serie_b",
  "swiss superleague": "soccer_switzerland_superleague",
  "primeira liga - portugal": "soccer_portugal_primeira_liga",
  "primera division - argentina": "soccer_argentina_primera_division",
  "super league - greece": "soccer_greece_super_league",
  "league of ireland": "soccer_league_of_ireland",
  "league 1": "soccer_england_league1",
  "league 2": "soccer_england_league2",
  "la liga 2 - spain": "soccer_spain_segunda_division",
  "uefa europa league": "soccer_uefa_europa_league",
  "uefa nations league": "soccer_uefa_nations_league",
};

export function resolveSportsDbLeagueId(input: {
  leagueSlug?: string | null;
  leagueName?: string | null;
}): number | null {
  const slug = (input.leagueSlug ?? "").trim().toLowerCase();
  if (slug && SPORTSDB_LEAGUE_IDS[slug]) return SPORTSDB_LEAGUE_IDS[slug] as number;
  const name = normalizeName(input.leagueName ?? "");
  if (!name) return null;
  const direct = LEAGUE_ALIASES[name];
  if (direct && SPORTSDB_LEAGUE_IDS[direct]) return SPORTSDB_LEAGUE_IDS[direct] as number;
  const squashed = (name.split(" - ")[0] ?? name).trim();
  const viaSquashed = LEAGUE_ALIASES[squashed];
  if (viaSquashed && SPORTSDB_LEAGUE_IDS[viaSquashed]) {
    return SPORTSDB_LEAGUE_IDS[viaSquashed] as number;
  }
  return null;
}

/** Official league badge via SportsDB id lookup. Fails soft -> null. */
export async function findSportsDbLeagueLogo(input: {
  leagueSlug?: string | null;
  leagueName?: string | null;
}): Promise<string | null> {
  const id = resolveSportsDbLeagueId(input);
  if (!id) return null;
  return throttled(async () => {
    const data = await fetchJson("/lookupleague.php?id=" + id);
    const leagues = data && Array.isArray(data.leagues) ? data.leagues : [];
    const first = leagues[0] as Record<string, unknown> | undefined;
    if (!first) return null;
    return validBadge(first.strBadge) ?? validBadge(first.strLogo);
  });
}

export function sportsDbEnabled(): boolean {
  return (process.env.LOGO_SPORTSDB_ENABLED ?? "true").toLowerCase() !== "false";
}
