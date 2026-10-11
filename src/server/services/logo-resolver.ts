const BASE = "https://www.thesportsdb.com/api/v1/json/123";
const TIMEOUT_MS = 8000;
const teamCache = new Map<string, string | null>();
const leagueCache = new Map<string, string | null>();

function normalize(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

async function fetchJson(path: string): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(BASE + path, { signal: controller.signal, headers: { accept: "application/json" } });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function resolveTeamLogo(teamName: string): Promise<string | null> {
  const name = normalize(teamName);
  if (!name) return null;
  const key = name.toLowerCase();
  if (teamCache.has(key)) return teamCache.get(key) ?? null;
  const data = await fetchJson("/searchteams.php?t=" + encodeURIComponent(name));
  const teams = Array.isArray(data?.teams) ? data.teams : [];
  const exact = teams.find((team: any) => normalize(String(team?.strTeam ?? "")).toLowerCase() === key);
  const candidate = exact ?? teams[0];
  const logo = typeof candidate?.strBadge === "string" && candidate.strBadge.startsWith("http") ? candidate.strBadge : null;
  teamCache.set(key, logo);
  return logo;
}


const SPORTSDb_LEAGUE_IDS: Record<string, number> = {"soccer_epl": 4328, "soccer_efl_champ": 4329, "soccer_england_efl_cup": 4570, "soccer_germany_bundesliga": 4331, "soccer_germany_bundesliga2": 4399, "soccer_france_ligue_one": 4334, "soccer_france_ligue_two": 4401, "soccer_italy_serie_a": 4332, "soccer_italy_serie_b": 4394, "soccer_spain_la_liga": 4335, "soccer_netherlands_eredivisie": 4337, "soccer_belgium_first_div": 4338, "soccer_spl": 4330, "soccer_austria_bundesliga": 4621, "soccer_denmark_superliga": 4340, "soccer_norway_eliteserien": 4358, "soccer_sweden_allsvenskan": 4347, "soccer_poland_ekstraklasa": 4422, "soccer_usa_mls": 4346, "soccer_mexico_ligamx": 4350, "soccer_korea_kleague1": 4689,
  "soccer_japan_j_league": 4633, "soccer_china_superleague": 4359, "soccer_finland_veikkausliiga": 4636, "soccer_russia_premier_league": 4355, "soccer_greece_super_league": 4336, "soccer_brazil_campeonato": 4351, "soccer_brazil_serie_b": 4404, "soccer_portugal_primeira_liga": 4344, "soccer_argentina_primera_division": 4406, "soccer_sweden_superettan": 4403, "soccer_switzerland_superleague": 4675, "soccer_turkey_super_league": 4339, "soccer_league_of_ireland": 4643, "soccer_england_league1": 4396, "soccer_england_league2": 4397, "soccer_spain_segunda_division": 4400, "soccer_uefa_europa_league": 4481, "soccer_uefa_nations_league": 4490};
const LEAGUE_ALIASES: Record<string, string> = {"epl": "soccer_epl", "championship": "soccer_efl_champ", "efl cup": "soccer_england_efl_cup", "bundesliga - germany": "soccer_germany_bundesliga", "bundesliga 2 - germany": "soccer_germany_bundesliga2", "ligue 1 - france": "soccer_france_ligue_one", "ligue 2 - france": "soccer_france_ligue_two", "serie a - italy": "soccer_italy_serie_a", "serie b - italy": "soccer_italy_serie_b", "la liga - spain": "soccer_spain_la_liga", "dutch eredivisie": "soccer_netherlands_eredivisie", "belgium first div": "soccer_belgium_first_div", "premiership - scotland": "soccer_spl", "austrian football bundesliga": "soccer_austria_bundesliga", "denmark superliga": "soccer_denmark_superliga", "eliteserien - norway": "soccer_norway_eliteserien", "allsvenskan - sweden": "soccer_sweden_allsvenskan", "ekstraklasa - poland": "soccer_poland_ekstraklasa", "mls": "soccer_usa_mls", "liga mx": "soccer_mexico_ligamx", "k league 1": "soccer_korea_kleague1",
 "j league": "soccer_japan_j_league", "super league - china": "soccer_china_superleague", "veikkausliiga - finland": "soccer_finland_veikkausliiga",
 "turkey super league": "soccer_turkey_super_league",
 "premier league - russia": "soccer_russia_premier_league",
 "brazil série a": "soccer_brazil_campeonato",
 "superettan - sweden": "soccer_sweden_superettan",
 "brazil série b": "soccer_brazil_serie_b",
 "swiss superleague": "soccer_switzerland_superleague",
 "primeira liga - portugal": "soccer_portugal_primeira_liga",
 "primera división - argentina": "soccer_argentina_primera_division",
 "super league - greece": "soccer_greece_super_league",
 "league of ireland": "soccer_league_of_ireland", "league 1": "soccer_england_league1", "league 2": "soccer_england_league2", "la liga 2 - spain": "soccer_spain_segunda_division", "uefa europa league": "soccer_uefa_europa_league", "uefa nations league": "soccer_uefa_nations_league"};

export async function resolveLeagueLogo(leagueName: string): Promise<string | null> {
  const name = normalize(leagueName);
  if (!name) return null;

  const key = name.toLowerCase();

  if (leagueCache.has(key)) {
    return leagueCache.get(key) ?? null;
  }

  const sportKey = LEAGUE_ALIASES[key];
  const id = sportKey ? SPORTSDb_LEAGUE_IDS[sportKey] : undefined;

  if (!id) {
    leagueCache.set(key, null);
    return null;
  }

  const data = await fetchJson("/lookupleague.php?id=" + id);
  const leagues = Array.isArray(data?.leagues) ? data.leagues : [];
  const league = leagues[0];

  const badge =
    typeof league?.strBadge === "string" && league.strBadge.startsWith("http")
      ? league.strBadge
      : null;

  const logo =
    typeof league?.strLogo === "string" && league.strLogo.startsWith("http")
      ? league.strLogo
      : null;

  const resolvedLogo = badge ?? logo;
  leagueCache.set(key, resolvedLogo);
  return resolvedLogo;
}
