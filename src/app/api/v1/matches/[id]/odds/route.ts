import { withErrorHandling, jsonOk } from '@/lib/errors';
import { ApiError } from '@/lib/errors';
import { createServices } from '@/server/services/container';
import { publicActor } from '@/server/http/guard';
import { effectiveSelectionStatus } from '@/lib/live-odds-availability';

export const dynamic = 'force-dynamic';

export const GET = withErrorHandling(
  'matches.odds',
  async (
    ctx,
    request: Request,
    params: { params: Promise<{ id: string }> },
  ) => {
    const { id } = await params.params;
    const services = createServices();
    const actor = publicActor(request, ctx.correlationId);
    const url = new URL(request.url);
    const liveOnly = url.searchParams.get('live') === '1';

    if (liveOnly) {
      const row = await services.db.queryOne<{
        match_id: string;
        status: string;
        minute: number | null;
        period: string | null;
        home_score: number | null;
        away_score: number | null;
        markets: unknown;
      }>(
        `select
           m.id as match_id,
           m.status,
           m.minute, m.period,
           m.home_score,
           m.away_score,
           coalesce(
             (
               select jsonb_agg(
                 jsonb_build_object(
                   'id', mk.id,
                   'key', mk.key,
                   'status', mk.status,
                   'specifier', mk.specifier,
                    'isLive', mk.is_live,
                   'selections',
                   coalesce(
                     (
                       select jsonb_agg(
                         jsonb_build_object(
                           'id', sel.id,
                           'code', sel.code,
                           'name', sel.name,
                           'oddsScaled', sel.odds_scaled,
                           'previousOddsScaled', sel.previous_odds_scaled,
                           'status', sel.status,
                           'version', sel.odds_version,
                          'oddsUpdatedAt', sel.odds_updated_at,
                          'providerTimestamp', sel.provider_timestamp,
                          'provider', sel.provider
                         )
                         order by sel.participant_type, sel.code
                       )
                       from nova.selections sel
                       where sel.market_id = mk.id
                     ),
                     '[]'::jsonb
                   )
                 )
                 order by mk.display_order, mk.key
               )
               from nova.markets mk
               where mk.match_id = m.id
                 and mk.status <> 'manual_review'
             ),
             '[]'::jsonb
           ) as markets
         from nova.matches m
         where m.id = $1 and m.provider = 'the_odds_api'`,
        [id],
      );

      if (!row) {
        throw new ApiError('NOT_FOUND', 'Match not found');
      }

      const markets = Array.isArray(row.markets) ? row.markets : [];

      const normalizedMarkets = markets.map((market: any) => ({
        id: String(market.id),
        key: market.key ?? '',
        status: market.status ?? 'open',
        specifier:
          market.specifier == null ? null : String(market.specifier),
        isLive: Boolean(market.isLive),
        selections: Array.isArray(market.selections)
          ? market.selections.map((selection: any) => ({
              id: String(selection.id),
              code: selection.code ?? '',
              name: selection.name ?? selection.code ?? '',
              oddsScaled: String(selection.oddsScaled ?? '0'),
              previousOddsScaled:
                selection.previousOddsScaled == null
                  ? null
                  : String(selection.previousOddsScaled),
              status: effectiveSelectionStatus({
                status: String(selection.status ?? 'open'),
                oddsUpdatedAt: selection.oddsUpdatedAt == null ? null : String(selection.oddsUpdatedAt),
                providerTimestamp: selection.providerTimestamp == null ? null : String(selection.providerTimestamp),
                provider: selection.provider == null ? null : String(selection.provider),
              }, String(row.status), Boolean(market.isLive)),
              movement: (() => {
                const nextOdds = String(selection.oddsScaled ?? '0');
                const previous =
                  selection.previousOddsScaled == null
                    ? null
                    : String(selection.previousOddsScaled);

                if (previous == null || previous === nextOdds) {
                  return 'STABLE';
                }

                const prev = Number(previous);
                const next = Number(nextOdds);

                return next > prev
                  ? 'UP'
                  : next < prev
                    ? 'DOWN'
                    : 'STABLE';
              })(),
              version: Number(selection.version ?? 0),
            }))
          : [],
      }));

      const version = normalizedMarkets.reduce(
        (marketTotal, market) =>
          marketTotal +
          market.selections.reduce(
            (selectionTotal: number, selection: any) =>
              selectionTotal + Number(selection.version ?? 0),
            0,
          ),
        0,
      );

      return jsonOk({
        matchId: row.match_id,
        status: row.status,
        minute: row.minute,
        period: row.period,
        homeScore: row.home_score,
        awayScore: row.away_score,
        version,
        markets: normalizedMarkets,
      });
    }

    const row = await services.db.queryOne<{
      match_id: string;
      status: string;
      minute: number | null;
      home_score: number | null;
      away_score: number | null;
      markets: unknown;
    }>(
      `select
         m.id as match_id,
         m.status,
         m.minute,
         m.home_score,
         m.away_score,
         coalesce(
           (
             select jsonb_agg(
               jsonb_build_object(
                 'id', mk.id,
                 'key', mk.key,
                 'status', mk.status,
                 'specifier', mk.specifier,
                    'isLive', mk.is_live,
                 'selections',
                 coalesce(
                   (
                     select jsonb_agg(
                       jsonb_build_object(
                         'id', sel.id,
                         'code', sel.code,
                         'name', sel.name,
                         'oddsScaled', sel.odds_scaled,
                         'previousOddsScaled', sel.previous_odds_scaled,
                         'status', sel.status,
                         'version', sel.odds_version,
                          'oddsUpdatedAt', sel.odds_updated_at,
                          'providerTimestamp', sel.provider_timestamp,
                          'provider', sel.provider
                       )
                       order by sel.participant_type, sel.code
                     )
                     from nova.selections sel
                     where sel.market_id = mk.id
                   ),
                   '[]'::jsonb
                 )
               )
               order by mk.is_live desc, mk.display_order, mk.key
             )
             from nova.markets mk
             where mk.match_id = m.id
               and mk.status <> 'manual_review'
           ),
           '[]'::jsonb
         ) as markets
       from nova.matches m
       where m.id = $1 and m.provider = 'the_odds_api'`,
      [id],
    );

    if (!row) {
      throw new ApiError('NOT_FOUND', 'Match not found');
    }

    const markets = Array.isArray(row.markets) ? row.markets : [];

    const normalizedMarkets = markets.map((market: any) => ({
      id: String(market.id),
      key: market.key ?? '',
      status: market.status ?? 'open',
      specifier:
        market.specifier == null ? null : String(market.specifier),
      isLive: Boolean(market.isLive),
      selections: Array.isArray(market.selections)
        ? market.selections.map((selection: any) => ({
            id: String(selection.id),
            code: selection.code ?? '',
            name: selection.name ?? selection.code ?? '',
            oddsScaled: String(selection.oddsScaled ?? '0'),
            previousOddsScaled:
              selection.previousOddsScaled == null
                ? null
                : String(selection.previousOddsScaled),
            movement: (() => {
              const next = String(selection.oddsScaled ?? '0');
              const previous =
                selection.previousOddsScaled == null
                  ? null
                  : String(selection.previousOddsScaled);
              if (previous == null || previous === next) return 'STABLE';
              return Number(next) > Number(previous) ? 'UP' : 'DOWN';
            })(),
            status: effectiveSelectionStatus({
                status: String(selection.status ?? 'open'),
                oddsUpdatedAt: selection.oddsUpdatedAt == null ? null : String(selection.oddsUpdatedAt),
                providerTimestamp: selection.providerTimestamp == null ? null : String(selection.providerTimestamp),
                provider: selection.provider == null ? null : String(selection.provider),
              }, String(row.status), Boolean(market.isLive)),
            version: Number(selection.version ?? 0),
          }))
        : [],
    }));

    const version = normalizedMarkets.reduce(
      (total, market) =>
        total +
        market.selections.reduce(
          (sum: number, selection: any) =>
            sum + Number(selection.version ?? 0),
          0,
        ),
      0,
    );

    return jsonOk({
      matchId: row.match_id,
      status: row.status,
      minute: row.minute,
      homeScore: row.home_score,
      awayScore: row.away_score,
      version,
      markets: normalizedMarkets,
    });
  },
);
