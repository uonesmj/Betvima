import { withErrorHandling, jsonOk } from '@/lib/errors';
import { ApiError } from '@/lib/errors';
import { createServices } from '@/server/services/container';
import { publicActor } from '@/server/http/guard';
import { searchParams } from '@/server/http/request';

export const dynamic = 'force-dynamic';

/** Match page payload: match, markets with authoritative odds, and recent odds history. */
export const GET = withErrorHandling('matches.get', async (ctx, request: Request, params: { params: Promise<{ id: string }> }) => {
  const { id } = await params.params;
  const services = createServices();
  const actor = publicActor(request, ctx.correlationId);
  const match = await services.catalog.getMatchBySlugOrId(actor, id);
  if (!match) throw new ApiError('NOT_FOUND', 'Match not found');
  const paramsQuery = searchParams(request);
  const liveOnly = paramsQuery.get('liveOnly') === 'true';

  if (liveOnly) {
    const liveEvents = await services.catalog.listMatchEvents(match.id);
    const liveStats = await services.catalog.getMatchStats(match.id);

    const liveSnapshot =
      match.isLive && liveStats?.payload && typeof liveStats.payload === 'object'
        ? liveStats.payload as {
            minute?: number | null;
            period?: string | null;
          }
        : null;

    const liveMatch = liveSnapshot
      ? {
          ...match,
          minute: liveSnapshot.minute ?? match.minute,
          period: liveSnapshot.period ?? match.period,
        }
      : match;

    return jsonOk({
      match: liveMatch,
      liveEvents,
      liveStats,
    });
  }

  const includeSuspended = paramsQuery.get('includeSuspended') === 'true';
  const markets = await services.catalog.listMarkets(actor, match.id, { includeSuspended });
  const history = await services.db.query<Record<string, unknown>>(
    `select h.selection_id, h.odds_scaled, h.previous_odds_scaled, h.provider_timestamp
       from nova.odds_history h join nova.selections s on s.id = h.selection_id
      where s.match_id = $1 and h.provider_timestamp > now() - interval '2 hours'
      order by h.provider_timestamp desc limit 60`,
    [match.id],
  );
  const result = await services.catalog.getResult(match.id);
  const liveEvents = match.isLive
    ? await services.catalog.listMatchEvents(match.id)
    : [];
  const liveStats = match.isLive
    ? await services.catalog.getMatchStats(match.id)
    : null;

  const liveSnapshot =
    match.isLive && liveStats?.payload && typeof liveStats.payload === 'object'
      ? liveStats.payload as {
          minute?: number | null;
          period?: string | null;
        }
      : null;

  const liveMatch = liveSnapshot
    ? {
        ...match,
        minute: liveSnapshot.minute ?? match.minute,
        period: liveSnapshot.period ?? match.period,
      }
    : match;

  return jsonOk({
    match: liveMatch,
    markets,
    oddsHistory: history,
    result,
    liveEvents,
    liveStats,
  });
});
