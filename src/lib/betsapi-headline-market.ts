/**
 * Show bookmaker-supplied, explicitly labelled selections only.
 * Do not interpret unidentified Bet365 PA rows as executable outcomes.
 */
export interface BetsPreviewMarket {
  key: string;
  title: string;
  selections: Array<{ id: string; label: string; decimal: string }>;
}
export function pickHeadlineMarket(markets: BetsPreviewMarket[]): BetsPreviewMarket | null {
  const priced = markets
    .map(m => ({
      ...m,
      selections: m.selections.filter(s =>
        Boolean(s.id) && Number.isFinite(Number(s.decimal)) &&
        Number(s.decimal) > 1 &&
        Boolean(s.label.trim()) && !/Unlabelled outcome/i.test(s.label),
      ),
    }))
    .filter(m => m.selections.length);
  const rank = (name: string): number => {
    const n = name.toLowerCase().trim();
    if (/^(full ?time result|match result|match winner|1x2|3.way result|money ?line)$/.test(n)) return 0;
    if (/^(winner|to win|match betting|two.way result)$/.test(n)) return 1;
    if (/^(double chance|total goals|match goals|total points|over\/under)/.test(n)) return 2;
    if (/^(result|game winner|handicap|spread)/.test(n)) return 3;
    return 10;
  };
  priced.sort((a,b) => rank(a.title) - rank(b.title));
  return priced[0] ?? null;
}
