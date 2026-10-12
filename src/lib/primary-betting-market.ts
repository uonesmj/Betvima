/**
 * Pick the most useful actually open market. In-play 1X2 may be suspended
 * while other bookmaker markets still have fresh, available prices.
 */
export function primaryBettingMarket<
  T extends { key: string; status: string; selections: readonly { status: string }[] },
>(markets: readonly T[] | undefined, isLive: boolean): T | undefined {
  if (!markets?.length) return undefined;

  const openCount = (market: T) =>
    market.status === 'open'
      ? market.selections.filter((selection) => selection.status === 'open').length
      : 0;
  const bettable = markets.filter((market) => openCount(market) > 0);
  const complete = bettable.filter((market) => openCount(market) >= 2);
  const candidates = complete.length ? complete : bettable.length ? bettable : markets;

  const preferredKeys = isLive
    ? ['h2h', 'double_chance', 'totals', 'btts', 'spreads']
    : ['h2h', 'totals', 'spreads', 'btts'];
  const priority = (market: T) => {
    const key = market.key.toLowerCase();
    const index = preferredKeys.indexOf(key);
    if (index >= 0) return index;
    if (key === 'h2h_lay' || key.startsWith('alternate_')) return 100;
    return 10;
  };

  return [...candidates].sort((a, b) =>
    priority(a) - priority(b) || openCount(b) - openCount(a),
  )[0];
}
