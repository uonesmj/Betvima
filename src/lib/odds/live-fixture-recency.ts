/**
 * A provider event can remain marked live long after its final active snapshot.
 * Only show/refresh fixtures with credible recency evidence; read-only policy.
 * This never edits provider results, match status, wagers or settlement.
 */
export const CURRENT_LIVE_FIXTURE_SQL = `(
  m.scheduled_at >= now() - interval '10 hours'
  or m.provider_updated_at >= now() - interval '30 minutes'
  or exists (
    select 1 from nova.markets fresh_market
      join nova.selections fresh_selection on fresh_selection.market_id = fresh_market.id
     where fresh_market.match_id = m.id
       and fresh_market.status = 'open'
       and fresh_selection.status = 'open'
       and fresh_selection.provider = 'the_odds_api'
       and fresh_selection.odds_updated_at >= now() - interval '45 seconds'
       and fresh_selection.provider_timestamp between now() - interval '45 seconds' and now() + interval '15 seconds'
  )
)`;
