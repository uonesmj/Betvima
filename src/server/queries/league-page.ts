import type { ActorContext } from '@/lib/ports/db';
import type { CatalogRepository } from '@/lib/ports/repositories';

/** A navigation list's limit must not determine whether a league URL exists. */
export async function readLeaguePageLeagues(
  catalog: Pick<CatalogRepository, 'listLeagues'>,
  context: ActorContext,
  sportKey: string,
  leagueId: string,
) {
  const leagues = await catalog.listLeagues(context, { sportKey, limit: 200 });
  let league = leagues.find((item) => item.id === leagueId && item.sportKey === sportKey);
  if (!league) {
    const selected = await catalog.listLeagues(context, { sportKey, leagueId, limit: 1 });
    league = selected.find((item) => item.id === leagueId && item.sportKey === sportKey);
  }
  return {
    league: league ?? null,
    leagues: league && !leagues.some((item) => item.id === league.id) ? [...leagues, league] : leagues,
  };
}
