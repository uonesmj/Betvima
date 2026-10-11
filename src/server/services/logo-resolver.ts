/**
 * Unified logo pipeline — REAL team/league badges for every sport.
 *
 * Resolution chain (teams):
 *   1. ESPN unofficial API (soccer, NBA, NFL, MLB, NHL) — official artwork.
 *   2. TheSportsDB search (volleyball, handball, cricket, lower leagues, ...)
 *      with STRICT sport verification — a wrong-sport hit resolves to null.
 *   3. null — no real badge known. Callers show an honest placeholder;
 *      we NEVER store or return fake/generated logos.
 *
 * Resolution chain (leagues):
 *   1. ESPN scoreboard league badge (by Odds-API sport key or league name).
 *   2. TheSportsDB league lookup by id.
 *   3. null.
 *
 * Results (including confirmed misses) persist in nova.logo_cache so upstream
 * APIs are hit once per name, and every stored URL is HEAD-verified to be a
 * real image before it reaches the database.
 */

import type { Db } from "@/lib/ports/db";
import { cacheKeyForName, normalizeName } from "./logo-sources/normalize";
import {
  espnEnabled,
  findEspnLeagueLogo,
  findEspnTeamLogo,
} from "./logo-sources/espn";
import {
  findSportsDbLeagueLogo,
  findSportsDbTeamLogo,
  sportsDbEnabled,
} from "./logo-sources/thesportsdb";

export type LogoSource = "espn" | "sportsdb";
export type LogoEntity = "team" | "league";

export interface ResolvedLogo {
  url: string;
  source: LogoSource;
  matchedName: string;
}

const POSITIVE_CACHE_DAYS = 30;
const NEGATIVE_CACHE_DAYS = 7;
const VERIFY_TIMEOUT_MS = 8_000;

// Short in-process memo so a single worker tick never resolves one name twice.
const memo = new Map<string, { at: number; value: ResolvedLogo | null }>();
const MEMO_TTL_MS = 10 * 60_000;

function memoGet(key: string): ResolvedLogo | null | undefined {
  const hit = memo.get(key);
  if (!hit) return undefined;
  if (Date.now() - hit.at > MEMO_TTL_MS) {
    memo.delete(key);
    return undefined;
  }
  return hit.value;
}

function memoSet(key: string, value: ResolvedLogo | null): void {
  if (memo.size > 2_000) memo.clear();
  memo.set(key, { at: Date.now(), value });
}

/** HEAD-verify that a URL is a reachable real image (worker path only). */
export async function verifyLogoUrl(url: string): Promise<boolean> {
  if (!url.startsWith("https://")) return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      headers: { "user-agent": "BetVima-logo-pipeline/1.0" },
      redirect: "follow",
    });
    if (!response.ok) return false;
    const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
    if (!contentType.startsWith("image/")) return false;
    const length = Number(response.headers.get("content-length") ?? "0");
    if (Number.isFinite(length) && length > 2_000_000) return false;
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Team resolution
// ---------------------------------------------------------------------------

export async function resolveTeamLogoDetailed(
  teamName: string,
  sportSlug?: string | null,
): Promise<ResolvedLogo | null> {
  const sport = (sportSlug ?? "").trim().toLowerCase();
  const name = teamName.trim();
  if (!name || normalizeName(name) === "") return null;
  const key = "team:" + sport + ":" + cacheKeyForName(name);
  const cached = memoGet(key);
  if (cached !== undefined) return cached;

  // 1. ESPN (covered sports only; internally fails soft).
  if (espnEnabled() && sport !== "") {
    try {
      const hit = await findEspnTeamLogo(name, sport);
      if (hit) {
        const resolved: ResolvedLogo = { url: hit.logo, source: "espn", matchedName: hit.matchedName };
        memoSet(key, resolved);
        return resolved;
      }
    } catch {
      // Fall through to the next source.
    }
  }

  // 2. TheSportsDB (sport-verified).
  if (sportsDbEnabled() && sport !== "") {
    try {
      const hit = await findSportsDbTeamLogo(name, sport);
      if (hit) {
        const resolved: ResolvedLogo = { url: hit.logo, source: "sportsdb", matchedName: hit.matchedName };
        memoSet(key, resolved);
        return resolved;
      }
    } catch {
      // Fall through to null.
    }
  }

  memoSet(key, null);
  return null;
}

/** Backwards-compatible wrapper: URL or null. */
export async function resolveTeamLogo(
  teamName: string,
  sportSlug?: string | null,
): Promise<string | null> {
  const hit = await resolveTeamLogoDetailed(teamName, sportSlug);
  return hit ? hit.url : null;
}

// ---------------------------------------------------------------------------
// League resolution
// ---------------------------------------------------------------------------

export interface LeagueLogoInput {
  leagueSlug?: string | null;
  leagueName?: string | null;
}

export async function resolveLeagueLogoDetailed(
  input: LeagueLogoInput | string,
): Promise<ResolvedLogo | null> {
  const params: LeagueLogoInput = typeof input === "string" ? { leagueName: input } : input;
  const name = (params.leagueName ?? "").trim();
  const slug = (params.leagueSlug ?? "").trim();
  if (!name && !slug) return null;
  const key = "league:" + slug.toLowerCase() + ":" + cacheKeyForName(name || slug);
  const cached = memoGet(key);
  if (cached !== undefined) return cached;

  if (espnEnabled()) {
    try {
      const url = await findEspnLeagueLogo({ leagueSlug: slug || null, leagueName: name || null });
      if (url) {
        const resolved: ResolvedLogo = { url, source: "espn", matchedName: name || slug };
        memoSet(key, resolved);
        return resolved;
      }
    } catch {
      // Fall through.
    }
  }

  if (sportsDbEnabled()) {
    try {
      const url = await findSportsDbLeagueLogo({ leagueSlug: slug || null, leagueName: name || null });
      if (url) {
        const resolved: ResolvedLogo = { url, source: "sportsdb", matchedName: name || slug };
        memoSet(key, resolved);
        return resolved;
      }
    } catch {
      // Fall through.
    }
  }

  memoSet(key, null);
  return null;
}

/** Backwards-compatible wrapper: URL or null. */
export async function resolveLeagueLogo(
  leagueName: string,
  extra?: { leagueSlug?: string | null },
): Promise<string | null> {
  const hit = await resolveLeagueLogoDetailed({ leagueName, leagueSlug: extra?.leagueSlug ?? null });
  return hit ? hit.url : null;
}

// ---------------------------------------------------------------------------
// Persistent cache (nova.logo_cache)
// ---------------------------------------------------------------------------

export type CachedLogo =
  | { status: "hit"; url: string; source: string | null }
  | { status: "miss" };

export async function readLogoCache(
  db: Db,
  entity: LogoEntity,
  sport: string,
  name: string,
): Promise<CachedLogo | null> {
  try {
    const row = await db.queryOne<{ logo_url: string | null; source: string | null }>(
      `select logo_url, source from nova.logo_cache
        where entity_type = $1 and sport = $2 and name_key = $3
          and expires_at > now()
        limit 1`,
      [entity, sport, cacheKeyForName(name)],
    );
    if (!row) return null;
    if (row.logo_url) return { status: "hit", url: row.logo_url, source: row.source };
    return { status: "miss" };
  } catch {
    return null;
  }
}

export async function writeLogoCache(
  db: Db,
  entity: LogoEntity,
  sport: string,
  name: string,
  resolved: ResolvedLogo | null,
): Promise<void> {
  const days = resolved ? POSITIVE_CACHE_DAYS : NEGATIVE_CACHE_DAYS;
  await db
    .query(
      `insert into nova.logo_cache
         (entity_type, sport, name_key, name, logo_url, source, verified_at, expires_at)
       values ($1, $2, $3, $4, $5, $6, case when $5 is null then null else now() end,
               now() + ($7 || ' days')::interval)
       on conflict (entity_type, sport, name_key)
       do update set
         name = excluded.name,
         logo_url = excluded.logo_url,
         source = excluded.source,
         verified_at = excluded.verified_at,
         expires_at = excluded.expires_at,
         updated_at = now()`,
      [entity, sport, cacheKeyForName(name), name, resolved ? resolved.url : null, resolved ? resolved.source : null, String(days)],
    )
    .catch(() => undefined);
}

/**
 * Hot-path helper for the odds worker: attach an already-cached logo to a
 * freshly upserted team/league. Reads the cache ONLY — never touches the
 * network, never blocks ingestion. Resolves true when a logo was attached.
 */
export async function attachCachedLogo(
  db: Db,
  entity: LogoEntity,
  entityId: string,
  sport: string,
  name: string,
): Promise<boolean> {
  try {
    const cached = await readLogoCache(db, entity, sport, name);
    if (!cached || cached.status !== "hit") return false;
    const table = entity === "team" ? "nova.teams" : "nova.leagues";
    await db.query(
      "update " + table + " set logo = $1, updated_at = now() where id = $2 and logo is null",
      [cached.url, entityId],
    );
    return true;
  } catch {
    return false;
  }
}
