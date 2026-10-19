import { withErrorHandling, jsonOk } from '@/lib/errors';
import { withAdmin } from '@/server/http/guard';
import { enforceRateLimit } from '@/server/http/request';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface FreshSelection {
  matchId: string;
  marketId: string;
  selectionId: string;
  code: 'HOME' | 'DRAW' | 'AWAY';
  oddsScaled: string;
  oddsVersion: number;
  providerTimestamp: string;
  home: string;
  away: string;
}

/**
 * Administrator-only SINGLE test surface. The browser never supplies a
 * Bet365 FI or translates an external ID into a wager UUID.
 *
 * Return ONE complete canonical football full-time 1X2 market that already
 * exists in the wallet-authoritative DB. No sportsbook state is mutated.
 * Quote/placement must still pass the existing signed-quote, identity,
 * account eligibility, operation-switch and source-timestamp checks.
 */
export const GET = withErrorHandling('admin.betsapi.single.test', async (ctx, request: Request) => {
  const { services, user } = await withAdmin(request, ctx, 'settings.view');
  await enforceRateLimit(`betsapi-single-test:${user.id}`, 20, 60);

  const rows = await services.db.query<FreshSelection>(
    `with complete_market as (
      select m.id as match_id, mk.id as market_id,
             min(s.odds_updated_at) as earliest_received
        from nova.matches m
        join nova.markets mk on mk.match_id = m.id
        join nova.selections s on s.market_id = mk.id and s.match_id = m.id
       where m.provider = 'betsapi'
         and m.provider_id ~ '^1:[0-9]{1,16}$'
         and m.status::text = 'live'
         and m.provider_updated_at >= now() - interval '120 seconds'
         and mk.provider = 'betsapi'
         and mk.key = 'h2h' and mk.type = '1X2'
         and mk.is_live and mk.status::text = 'open'
         and s.provider = 'betsapi'
         and s.is_live and s.status::text = 'open'
         and s.code in ('HOME', 'DRAW', 'AWAY')
         and s.odds_scaled between 10100 and 10000000
         and s.odds_version > 0
         and s.odds_updated_at between now() - interval '35 seconds' and now() + interval '5 seconds'
         and s.provider_timestamp between now() - interval '35 seconds' and now() + interval '15 seconds'
       group by m.id, mk.id
      having count(*) = 3 and count(distinct s.code) = 3
      order by min(s.odds_updated_at) desc
      limit 1
    )
    select c.match_id::text as "matchId", c.market_id::text as "marketId",
           s.id::text as "selectionId", s.code, s.odds_scaled::text as "oddsScaled",
           s.odds_version as "oddsVersion",
           s.provider_timestamp::text as "providerTimestamp",
           ht.name as home, at.name as away
      from complete_market c
      join nova.matches m on m.id = c.match_id
      join nova.teams ht on ht.id = m.home_team_id
      join nova.teams at on at.id = m.away_team_id
      join nova.selections s on s.market_id = c.market_id and s.match_id = m.id
     where s.provider = 'betsapi' and s.status::text = 'open'
       and s.code in ('HOME', 'DRAW', 'AWAY')
       and s.is_live and s.odds_version > 0
       and s.odds_updated_at between now() - interval '35 seconds' and now() + interval '5 seconds'
       and s.provider_timestamp between now() - interval '35 seconds' and now() + interval '15 seconds'
     order by case s.code when 'HOME' then 0 when 'DRAW' then 1 else 2 end`,
  );
  // Queries are time-sensitive; never return a partial market or suggest
  // anything wagerable if the provider quote expired mid-read.
  if (rows.length !== 3 || new Set(rows.map(r => r.code)).size !== 3) {
    return jsonOk({ available: false, match: null, message: 'NO_FRESH_CANONICAL_1X2' });
  }
  const oldestQuote = Math.min(...rows.map(row => Date.parse(row.providerTimestamp)));
  if (!Number.isFinite(oldestQuote) || Date.now() - oldestQuote > 35_000) {
    return jsonOk({ available: false, match: null, message: 'QUOTE_EXPIRED' });
  }
  return jsonOk({
    available: true,
    match: {
      home: rows[0]!.home,
      away: rows[0]!.away,
      matchId: rows[0]!.matchId,
      marketId: rows[0]!.marketId,
      marketLabel: 'Full-time result (1X2)',
      expiresAt: new Date(oldestQuote + 45_000).toISOString(),
      selections: rows.map(row => ({
        code: row.code, selectionId: row.selectionId,
        oddsScaled: row.oddsScaled, oddsVersion: row.oddsVersion,
      })),
    },
  });
});
