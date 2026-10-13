import type { Db } from "@/lib/ports/db";
import type {
  ProviderOddsBundle,
  ProviderResult,
  SportsDataProvider,
} from "@/lib/ports/providers";

/** Single authorized sportsbook data and bookmaker source. */
export const MATCH_SOURCE_ODDS = "the_odds_api";

/** Preserve the canonical match mapping used by existing settled and pending bets. */
export async function attachProviderMatchIdentity(
  db: Db,
  provider: string,
  providerId: string,
  internalId: string,
): Promise<boolean> {
  if (provider !== MATCH_SOURCE_ODDS) return false;
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

export function resolveSportsOddsProvider(
  matchProvider: string,
  sportsProviders: SportsDataProvider[] | undefined,
  primaryProvider: SportsDataProvider,
): SportsDataProvider | null {
  if (matchProvider !== MATCH_SOURCE_ODDS) return null;
  return sportsProviders?.find((provider) => provider.name === MATCH_SOURCE_ODDS) ??
    (primaryProvider.name === MATCH_SOURCE_ODDS ? primaryProvider : null);
}

export async function fetchOddsForOwningProvider(
  provider: SportsDataProvider,
  providerId: string,
  prefetched?: ProviderResult<ProviderOddsBundle[]>,
): Promise<ProviderResult<ProviderOddsBundle[]>> {
  if (provider.name !== MATCH_SOURCE_ODDS) {
    return {
      ok: false,
      value: null,
      errorCode: "ODDS_PROVIDER_NOT_AUTHORIZED",
      errorMessage: "Only The Odds API may supply sportsbook prices",
      retryable: false,
    };
  }
  return prefetched ?? provider.fetchOdds([providerId]);
}
