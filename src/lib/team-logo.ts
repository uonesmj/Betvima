const FALLBACK = "/sports-new/svg/football.svg";

function validLogo(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  if (v.startsWith("/")) return v;
  return null;
}

export function getTeamLogo(team: any): string {
  return (
    validLogo(team?.logoUrl) ??
    validLogo(team?.logo) ??
    validLogo(team?.image) ??
    validLogo(team?.badge) ??
    validLogo(team?.icon) ??
    FALLBACK
  );
}

// ---------------------------------------------------------------------------
// Unified logo helpers (teams + leagues)
// ---------------------------------------------------------------------------

/** Local sport icon for a given sportKey (always available offline). */
const SPORT_ICONS: Record<string, string> = {
  football: "/sports-new/svg/football.svg",
  soccer: "/sports-new/svg/football.svg",
  basketball: "/sports-new/svg/basketball.svg",
  tennis: "/sports-new/svg/tennis.svg",
  cricket: "/sports-new/svg/cricket.svg",
  "ice-hockey": "/sports-new/svg/ice-hockey.svg",
  hockey: "/sports-new/svg/ice-hockey.svg",
  baseball: "/sports-new/svg/baseball.svg",
  "table-tennis": "/sports-new/svg/table-tennis.svg",
  volleyball: "/sports-new/svg/volleyball.svg",
  handball: "/sports-new/svg/handball.svg",
  boxing: "/sports-new/svg/boxing.svg",
  mma: "/sports-new/svg/mma.svg",
  esports: "/sports-new/svg/esports.svg",
  "american-football": "/sports-new/svg/american-football.svg",
};

export function getSportIcon(sportKey?: string | null): string {
  if (!sportKey) return FALLBACK;
  return SPORT_ICONS[sportKey.trim().toLowerCase()] ?? FALLBACK;
}

/**
 * Local (bundled) league badges for the most popular leagues.
 * These always work offline and never depend on external providers.
 */
const LOCAL_LEAGUE_LOGOS: Record<string, string> = {
  // England
  "premier league": "/sports/leagues/premier-league.svg",
  epl: "/sports/leagues/premier-league.svg",
  "english premier league": "/sports/leagues/premier-league.svg",
  // Spain
  "la liga": "/sports/leagues/laliga.svg",
  laliga: "/sports/leagues/laliga.svg",
  "primera division": "/sports/leagues/laliga.svg",
  "primera división": "/sports/leagues/laliga.svg",
  // Germany
  bundesliga: "/sports/leagues/bundesliga.svg",
  // Italy
  "serie a": "/sports/leagues/serie-a.svg",
  // France
  "ligue 1": "/sports/leagues/ligue-1.png",
  // Netherlands
  eredivisie: "/sports/leagues/eredivisie.svg",
  "dutch eredivisie": "/sports/leagues/eredivisie.svg",
  // Portugal
  "primeira liga": "/sports/leagues/liga-portugal.svg",
  "liga portugal": "/sports/leagues/liga-portugal.svg",
  // USA
  mls: "/sports/leagues/mls.svg",
  "major league soccer": "/sports/leagues/mls.svg",
  // Europe
  "champions league": "/sports/leagues/champions-league.svg",
  "uefa champions league": "/sports/leagues/champions-league.svg",
  ucl: "/sports/leagues/champions-league.svg",
  "europa league": "/sports/leagues/europa-league.svg",
  "uefa europa league": "/sports/leagues/europa-league.svg",
  uel: "/sports/leagues/europa-league.svg",
  // Basketball
  nba: "/sports/leagues/nba.svg",
  // Sport-level fallbacks
  cricket: "/sports/leagues/cricket.svg",
  esports: "/sports/leagues/esports.svg",
  mma: "/sports/leagues/mma.svg",
  tennis: "/sports/leagues/tennis.svg",
  volleyball: "/sports/leagues/volleyball.svg",
};

function normalizeLeagueName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Find a bundled local badge for a league name.
 * Handles provider formats like "Serie A - Italy" or "La Liga - Spain".
 */
export function getLocalLeagueLogo(leagueName?: string | null): string | null {
  if (!leagueName) return null;
  const normalized = normalizeLeagueName(leagueName);
  if (!normalized) return null;

  // 1. Exact match.
  if (LOCAL_LEAGUE_LOGOS[normalized]) return LOCAL_LEAGUE_LOGOS[normalized];

  // 2. Strip " - Country" suffix (e.g. "Serie A - Italy" -> "Serie A").
  const beforeDash = (normalized.split(" - ")[0] ?? normalized).trim();
  const dashed = LOCAL_LEAGUE_LOGOS[beforeDash];
  if (beforeDash && dashed) return dashed;

  // 3. Substring match (e.g. "England Premier League 2024" contains "premier league").
  for (const key of Object.keys(LOCAL_LEAGUE_LOGOS)) {
    if (normalized.includes(key) || beforeDash.includes(key)) {
      const hit = LOCAL_LEAGUE_LOGOS[key];
      if (hit) return hit;
    }
  }

  return null;
}

export interface LeagueLogoInput {
  url?: string | null;
  name?: string | null;
  sportKey?: string | null;
}

/**
 * Resolve the best league logo with a consistent fallback chain:
 * explicit provider URL -> bundled local badge -> local sport icon.
 */
export function getLeagueLogo(input: LeagueLogoInput): string {
  const explicit = validLogo(input.url);
  if (explicit) return explicit;
  const local = getLocalLeagueLogo(input.name);
  if (local) return local;
  return getSportIcon(input.sportKey);
}

/** First visible letter of a name (for avatar fallbacks). */
export function logoInitial(name?: string | null): string {
  const clean = (name ?? "").trim();
  if (!clean) return "?";
  return clean.slice(0, 1).toUpperCase();
}

/** Deterministic palette index 0..7 derived from a name. */
export function logoColorIndex(name?: string | null): number {
  const value = (name ?? "?").toLowerCase();
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash % 8;
}
