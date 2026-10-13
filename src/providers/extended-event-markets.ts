/**
 * Event-detail requests are more expensive than grouped featured odds.
 * Only request configured non-featured markets observed from bookmakers
 * for this particular event. Never turn an unavailable market into a quote.
 */
/**
 * Never spend premium event-detail requests on bookmaker markets the
 * current BetVima settlement/rules engine explicitly classifies as
 * manual_review. A later rules/settlement implementation must deliberately
 * update this list before enabling any such market for real-money betting.
 */
const NOT_AUTOMATICALLY_SETTLEABLE = new Set([
  'h2h_lay',
  'h2h_3_way_lay',
  'corners_1x2',
  'to_qualify',
  'odd_even',
  'odd_even_h1',
  'alternate_spreads_corners',
  'alternate_totals_corners',
  'alternate_spreads_cards',
  'alternate_totals_cards',
  'alternate_team_totals_corners',
  'player_goal_scorer_anytime',
  'player_first_goal_scorer',
  'player_last_goal_scorer',
  'player_to_receive_card',
  'player_to_receive_red_card',
  'player_shots_on_target',
  'player_shots',
  'player_assists',
]);

export function isAutomatedSettlementMarket(marketKey: string): boolean {
  return !NOT_AUTOMATICALLY_SETTLEABLE.has(marketKey.trim().toLowerCase());
}

export function selectExtendedEventMarkets(
  configured: string,
  discovered: readonly string[],
  featured: string,
  limit = 20,
): string[] {
  const available = new Set(discovered.map((key) => key.trim()).filter(Boolean));
  const featuredMarkets = new Set(featured.split(',').map((key) => key.trim()).filter(Boolean));
  const unique = new Set<string>();
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(20, Math.floor(limit))) : 20;
  for (const raw of configured.split(',')) {
    const key = raw.trim();
    if (!key || featuredMarkets.has(key) || !available.has(key) || !isAutomatedSettlementMarket(key)) continue;
    unique.add(key);
    if (unique.size >= safeLimit) break;
  }
  return [...unique];
}
