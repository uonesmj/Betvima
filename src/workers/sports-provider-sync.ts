import type { Db } from "@/lib/ports/db";
import { pgArray } from "@/server/db/rows";
import type {
  ProviderMatch,
  ProviderOddsBundle,
  ProviderResult,
  SportsDataProvider,
} from "@/lib/ports/providers";

export const MATCH_SOURCE_ODDS = "the_odds_api";
export const MATCH_SOURCE_FALLBACK = "5dollarfootballapi";
export const CROSS_SOURCE_KICKOFF_TOLERANCE_MS = 10 * 60_000;

export interface CrossProviderMatchCandidate {
  id: string;
  provider_id: string;
  scheduled_at: string;
  sport: string;
  league_name: string;
  country_code: string | null;
  home_team: string;
  away_team: string;
}

export interface FiveDollarMatchRow {
  match_id: string;
  provider_id: string;
  match_provider: string | null;
  home_team_id: string | null;
  away_team_id: string | null;
}

export function normalizeMatchIdentity(value: string | null | undefined): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(fc|cf|sc|afc|ac|ec|club)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export async function findCrossProviderMatchCandidate(
  db: Db,
  incoming: ProviderMatch,
  targetProvider: string,
): Promise<CrossProviderMatchCandidate | null> {
  const kickoff = new Date(incoming.scheduledAt);
  const kickoffMs = kickoff.getTime();
  const incomingLeague = normalizeMatchIdentity(incoming.leagueName);
  const incomingHome = normalizeMatchIdentity(incoming.homeTeamName);
  const incomingAway = normalizeMatchIdentity(incoming.awayTeamName);
  if (!Number.isFinite(kickoffMs) || !incomingLeague || !incomingHome || !incomingAway) return null;

  const candidates = await db.query<CrossProviderMatchCandidate>(
    `select m.id, m.provider_id, m.scheduled_at, s.slug as sport,
            l.name as league_name, c.code as country_code,
            ht.name as home_team, at.name as away_team
       from nova.matches m
       join nova.sports s on s.id = m.sport_id
       join nova.leagues l on l.id = m.league_id
       left join nova.countries c on c.id = l.country_id
       join nova.teams ht on ht.id = m.home_team_id
       join nova.teams at on at.id = m.away_team_id
      where m.provider = $1
        and m.provider_id is not null
        and s.slug = $2
        and m.scheduled_at between $3::timestamptz - interval '10 minutes'
                               and $3::timestamptz + interval '10 minutes'`,
    [targetProvider, incoming.sport, incoming.scheduledAt],
  );

  const matches = candidates.filter((candidate) => {
    const candidateCountry = candidate.country_code?.trim().toUpperCase() ?? null;
    const incomingCountry = incoming.countryCode?.trim().toUpperCase() ?? null;
    return candidate.sport === incoming.sport &&
      normalizeMatchIdentity(candidate.league_name) === incomingLeague &&
      normalizeMatchIdentity(candidate.home_team) === incomingHome &&
      normalizeMatchIdentity(candidate.away_team) === incomingAway &&
      (!candidateCountry || !incomingCountry || candidateCountry === incomingCountry) &&
      Math.abs(new Date(candidate.scheduled_at).getTime() - kickoffMs) <= CROSS_SOURCE_KICKOFF_TOLERANCE_MS;
  });

  // Ambiguous candidates (for example, doubleheaders) are left separate.
  return matches.length === 1 ? matches[0]! : null;
}

export async function attachProviderMatchIdentity(
  db: Db,
  provider: string,
  providerId: string,
  internalId: string,
): Promise<boolean> {
  const row = await db.queryOne<{ internal_id: string }>(
    `insert into nova.provider_entities
       (provider, entity_type, provider_id, internal_id, last_seen_at)
     values ($1, 'match', $2, $3, now())
     on conflict (provider, entity_type, provider_id)
     do update set last_seen_at = now()
       where nova.provider_entities.internal_id = excluded.internal_id
     returning internal_id`,
    [provider, providerId, internalId],
  );
  return row?.internal_id === internalId;
}

export async function linkCrossProviderMatch(
  db: Db,
  incoming: ProviderMatch,
  sourceProvider: string,
  targetProvider: string,
): Promise<{ status: "not_found" } | { status: "linked" | "conflict"; matchId: string }> {
  const candidate = await findCrossProviderMatchCandidate(db, incoming, targetProvider);
  if (!candidate) return { status: "not_found" };
  const attached = await attachProviderMatchIdentity(
    db,
    sourceProvider,
    incoming.providerId,
    candidate.id,
  );
  return attached
    ? { status: "linked", matchId: candidate.id }
    : { status: "conflict", matchId: candidate.id };
}

export function fiveDollarBookmakerPricesEnabled(): boolean {
  // Deliberately disabled in production until financial SQL quote/settlement
  // guards are reviewed for this additional source. No implicit env fallback.
  return process.env.FIVEDOLLAR_BETTING_ODDS_ENABLED === "true";
}

export function resolveSportsOddsProvider(
  matchProvider: string,
  sportsProviders: SportsDataProvider[] | undefined,
  primaryProvider: SportsDataProvider,
): SportsDataProvider | null {
  if (matchProvider !== MATCH_SOURCE_ODDS &&
    !(matchProvider === MATCH_SOURCE_FALLBACK && fiveDollarBookmakerPricesEnabled())) return null;
  return sportsProviders?.find((provider) => provider.name === matchProvider) ??
    (primaryProvider.name === matchProvider ? primaryProvider : null);
}

export function fiveDollarProviderEventId(fixtureProviderId: string, eventIdentity: string): string {
  return `5dollar:${fixtureProviderId}:${eventIdentity}`;
}

export async function fetchOddsForOwningProvider(
  provider: SportsDataProvider,
  providerId: string,
  prefetched?: ProviderResult<ProviderOddsBundle[]>,
): Promise<ProviderResult<ProviderOddsBundle[]>> {
  if (provider.name !== MATCH_SOURCE_ODDS &&
    !(provider.name === MATCH_SOURCE_FALLBACK && fiveDollarBookmakerPricesEnabled())) {
    return {
      ok: false,
      value: null,
      errorCode: "ODDS_PROVIDER_NOT_AUTHORIZED",
      errorMessage: "Betting price source is not enabled for the requested provider",
      retryable: false,
    };
  }
  return prefetched ?? provider.fetchOdds([providerId]);
}

export async function resolveFiveDollarMatchRows(
  db: Db,
  providerIds: string[],
  providerName = MATCH_SOURCE_FALLBACK,
): Promise<FiveDollarMatchRow[]> {
  if (providerIds.length === 0) return [];
  return db.query<FiveDollarMatchRow>(
    `select distinct on (f.provider_id)
            m.id as match_id, f.provider_id, m.provider as match_provider,
            m.home_team_id, m.away_team_id
       from unnest($2::text[]) as f(provider_id)
       left join nova.matches direct_match
         on direct_match.provider = $1 and direct_match.provider_id = f.provider_id
       left join nova.provider_entities pe
         on pe.provider = $1 and pe.entity_type = 'match' and pe.provider_id = f.provider_id
       join nova.matches m on m.id = coalesce(direct_match.id, pe.internal_id)
      order by f.provider_id, (direct_match.id is null)`,
    [providerName, pgArray(providerIds)],
  );
}
