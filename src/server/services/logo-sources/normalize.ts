/**
 * Shared name normalization + matching for the logo pipeline.
 *
 * Provider team names ("Man City", "FC Koln", "Inter") rarely match badge
 * source spellings ("Manchester City", "FC Koln", "Internazionale") exactly,
 * so every lookup goes through: normalize -> strip noise -> alias -> match.
 *
 * Matching is deliberately conservative: a low-confidence candidate returns
 * null (no logo) instead of risking a WRONG badge on a team.
 */

/** Lowercase, strip diacritics, collapse punctuation to single spaces. */
export function normalizeName(value: string): string {
  const withoutDiacritics = value
    .normalize("NFD")
    .split("")
    .filter((ch) => {
      const code = ch.charCodeAt(0);
      return code < 0x0300 || code > 0x036f;
    })
    .join("");
  return withoutDiacritics
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Club affixes that carry no identity on their own (stripped on BOTH sides
 * before comparison). Identity words such as "real", "atletico", "athletic",
 * "united" or "city" are deliberately NOT in this set.
 */
const STRIPPED_TOKENS = new Set([
  "fc", "cf", "afc", "sc", "cd", "ud", "ac", "as", "ssc", "ssd", "ss",
  "tsg", "vfb", "bsc", "sv", "rcd", "ca", "rc", "sl", "sp", "ec",
]);

export function stripNoise(normalized: string): string {
  const tokens = normalized.split(" ").filter((t) => t && !STRIPPED_TOKENS.has(t));
  return tokens.join(" ");
}

/** Famous short names -> canonical normalized names (checked pre/post strip). */
export const TEAM_ALIASES: Record<string, string> = {
  "man city": "manchester city",
  "man united": "manchester united",
  "man utd": "manchester united",
  "psg": "paris saint germain",
  "paris sg": "paris saint germain",
  "paris saint germain": "paris saint germain",
  "inter": "internazionale",
  "spurs": "tottenham hotspur",
  "tottenham": "tottenham hotspur",
  "wolves": "wolverhampton wanderers",
  "lyon": "olympique lyonnais",
  "rennes": "stade rennais",
  "psv": "psv eindhoven",
  "az": "az alkmaar",
  "qpr": "queens park rangers",
  "nottm forest": "nottingham forest",
  "sheffield utd": "sheffield united",
  "leeds": "leeds united",
  "leicester": "leicester city",
  "norwich": "norwich city",
  "ipswich": "ipswich town",
  "west ham": "west ham united",
  "brighton": "brighton hove albion",
  "newcastle": "newcastle united",
  "bayern": "bayern munich",
  "dortmund": "borussia dortmund",
  "gladbach": "borussia monchengladbach",
  "mgladbach": "borussia monchengladbach",
  "schalke": "schalke 04",
  "werder": "werder bremen",
  "eintracht": "eintracht frankfurt",
  "koln": "koln",
  "cologne": "koln",
  "mainz": "mainz 05",
  "hoffenheim": "hoffenheim",
  "atletico": "atletico madrid",
  "betis": "real betis",
  "sociedad": "real sociedad",
  "alaves": "deportivo alaves",
  "celta": "celta vigo",
  "roma": "roma",
  "marseille": "olympique marseille",
  "monaco": "monaco",
  "lille": "losc lille",
  "lens": "lens",
  "nice": "ogc nice",
  "nantes": "nantes",
  "saint etienne": "saint etienne",
  "porto": "porto",
  "benfica": "benfica",
  "sporting": "sporting cp",
  "braga": "braga",
  "feyenoord": "feyenoord",
  "twente": "twente",
  "la lakers": "los angeles lakers",
  "lakers": "los angeles lakers",
  "dubs": "golden state warriors",
  "sixers": "philadelphia 76ers",
  "manila": "manila",
};

export interface NameMatch {
  /** The candidate as originally spelled. */
  candidate: string;
  /** 1.0 exact, 0.95 alias, 0.8 token-subset. */
  confidence: number;
}

/**
 * Match an input name against candidate display names.
 * Returns null when nothing reaches the confidence bar.
 */
export function matchTeamName(input: string, candidates: string[]): NameMatch | null {
  const norm = normalizeName(input);
  if (!norm) return null;
  const stripped = stripNoise(norm);
  const aliased = TEAM_ALIASES[stripped] ?? TEAM_ALIASES[norm] ?? null;

  const table = candidates.map((candidate) => {
    const cNorm = normalizeName(candidate);
    return { candidate, cNorm, cStripped: stripNoise(cNorm) };
  });

  // 1. Exact match (raw or noise-stripped).
  for (const row of table) {
    if (row.cNorm === norm || (stripped !== "" && row.cStripped === stripped)) {
      return { candidate: row.candidate, confidence: 1 };
    }
  }

  // 2. Alias match.
  if (aliased) {
    const aliasStripped = stripNoise(aliased);
    for (const row of table) {
      if (row.cNorm === aliased || row.cStripped === aliasStripped) {
        return { candidate: row.candidate, confidence: 0.95 };
      }
    }
  }

  // 3. Token-subset match: every token of the shorter side appears in the
  // longer side ("brighton" ⊂ "brighton hove albion"). Single-token inputs
  // must be at least 4 chars to avoid junk matches ("as", "rc", ...).
  const inputTokens = (stripped || norm).split(" ").filter(Boolean);
  if (inputTokens.length === 1 && (inputTokens[0] ?? "").length < 4 && !aliased) {
    return null;
  }
  for (const row of table) {
    const candTokens = (row.cStripped || row.cNorm).split(" ").filter(Boolean);
    const [shorter, longer] =
      inputTokens.length <= candTokens.length ? [inputTokens, candTokens] : [candTokens, inputTokens];
    if (shorter.length === 0) continue;
    const longerSet = new Set(longer);
    if (shorter.every((t) => longerSet.has(t))) {
      return { candidate: row.candidate, confidence: 0.8 };
    }
  }

  return null;
}

/** Cache key for a name: stripped normalized form (aliases resolved). */
export function cacheKeyForName(name: string): string {
  const norm = normalizeName(name);
  const stripped = stripNoise(norm);
  return TEAM_ALIASES[stripped] ?? TEAM_ALIASES[norm] ?? stripped ?? norm;
}


