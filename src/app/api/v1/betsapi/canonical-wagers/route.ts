import { jsonOk, withErrorHandling } from '@/lib/errors';
import { createServices } from '@/server/services/container';
import { wagerFeedEnabled } from '@/server/betsapi-wager-bridge';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface CanonicalRow {
  matchId: string;
  marketId: string;
  selectionId: string;
  home: string;
  away: string;
  code: string;
  oddsScaled: string;
  oddsVersion: number;
  validUntil: string;
}

export const GET = withErrorHandling('betsapi.canonical.wagers', async () => {
  // Separately approved wagering flag is mandatory. Public preview and the
  // presence of an API token alone must never authorize real-money wagers.
  if (!wagerFeedEnabled()) {
    return jsonOk({ available: false, markets: [], reason: 'WAGER_INGEST_DISABLED' });
  }

  // These are wallet-authoritative database IDs and prices, not the external
  // Bet365 FI or a displayed/guessed market. Exact, complete in-play 1X2 only.
  // A quote must independently pass the bet-slip service and SQL placement
  // source-timestamp checks at the instant a user submits a real wager.
  const rows = await createServices().db.query<CanonicalRow>(
    `with eligible as (
       select m.id as match_id, mk.id as market_id,
              min(s.provider_timestamp) as oldest_quote,
              max(s.odds_updated_at) as last_received
         from nova.matches m
         join nova.markets mk on mk.match_id = m.id
         join nova.selections s on s.market_id = mk.id and s.match_id = m.id
        where m.provider = 'betsapi'
          and m.provider_id ~ '^1:[0-9]{1,16}$'
          and m.status::text = 'live'
          and m.provider_updated_at between now() - interval '4 minutes' and now() + interval '15 seconds'
          and mk.provider = 'betsapi' and mk.key = 'h2h' and mk.type = '1X2'
          and mk.is_live = true and mk.status::text = 'open'
          and s.provider = 'betsapi'
          and s.is_live = true and s.status::text = 'open'
          and s.code in ('HOME','DRAW','AWAY')
          and s.odds_version > 0
          and s.odds_scaled between 10100 and 10000000
          and s.odds_updated_at between now() - interval '35 seconds' and now() + interval '5 seconds'
          and s.provider_timestamp between now() - interval '35 seconds' and now() + interval '15 seconds'
        group by m.id, mk.id
       having count(*) = 3 and count(distinct s.code) = 3
        order by max(s.odds_updated_at) desc
        limit 20
     )
     select e.match_id::text as "matchId", e.market_id::text as "marketId",
            s.id::text as "selectionId", s.code, s.odds_scaled::text as "oddsScaled",
            s.odds_version as "oddsVersion",
            ht.name as home, at.name as away,
            (least(s.provider_timestamp, e.oldest_quote) + interval '45 seconds')::text as "validUntil"
       from eligible e
       join nova.matches m on m.id = e.match_id
       join nova.teams ht on ht.id = m.home_team_id
       join nova.teams at on at.id = m.away_team_id
       join nova.selections s on s.market_id = e.market_id and s.match_id = m.id
      where s.provider = 'betsapi' and s.status::text = 'open'
        and s.is_live and s.code in ('HOME','DRAW','AWAY')
        and s.odds_version > 0
        and s.odds_updated_at between now() - interval '35 seconds' and now() + interval '5 seconds'
        and s.provider_timestamp between now() - interval '35 seconds' and now() + interval '15 seconds'
      order by e.last_received desc,
               case s.code when 'HOME' then 0 when 'DRAW' then 1 else 2 end`,
  );

  const byMatch = new Map<string, {
    matchId: string; marketId: string; home: string; away: string;
    expiresAt: string;
    selections: Array<{ selectionId: string; code: string; oddsScaled: string; oddsVersion: number }>;
  }>();
  for (const row of rows) {
    const key = row.matchId + ':' + row.marketId;
    const candidate = byMatch.get(key) ?? {
      matchId: row.matchId, marketId: row.marketId,
      home: row.home, away: row.away, expiresAt: row.validUntil,
      selections: [],
    };
    if (Date.parse(row.validUntil) < Date.parse(candidate.expiresAt)) {
      candidate.expiresAt = row.validUntil;
    }
    candidate.selections.push({
      selectionId: row.selectionId, code: row.code,
      oddsScaled: row.oddsScaled, oddsVersion: row.oddsVersion,
    });
    byMatch.set(key, candidate);
  }

  const markets = [...byMatch.values()].filter(market =>
    Date.parse(market.expiresAt) > Date.now() + 1000 &&
    market.selections.length === 3 &&
    new Set(market.selections.map(s => s.code)).size === 3
  );
  return jsonOk({
    available: markets.length > 0,
    markets,
    reason: markets.length ? null : 'NO_FRESH_CANONICAL_1X2',
  });
});
