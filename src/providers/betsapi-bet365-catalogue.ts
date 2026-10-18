/** Bet365 catalogue adapter: preserves every explicitly quoted bookmaker market.
 * Catalogue data is never authoritative for staking until each market has
 * verified rules and stable provider identity. */
import { parseBet365LivePreview, parseBet365PrematchPreview } from './betsapi-bet365-preview';
import { object, string, safePrice } from './betsapi-normalization';

export type Bet365CatalogueMarket = {
  id: string; name: string; mode: 'live' | 'upcoming';
  status: 'open' | 'suspended';
  selections: Array<{ id: string; name: string; odds: string; status: 'open' | 'suspended'; line: string | null }>;
};
export type Bet365Catalogue = {
  fi: string; mode: 'live' | 'upcoming'; marketCount: number;
  selectionCount: number; markets: Bet365CatalogueMarket[];
  readOnly: true;
};
const safeId = (x: unknown) => /^\d{1,16}$/.test(string(x));
const suspended = (x: Record<string, unknown>) =>
  x.SU === '1' || x.suspended === true || x.status === 'suspended' || x.locked === true;
const unlabelled = (x: string) => /^Unlabelled outcome #/i.test(x);
const lineFromLabel = (name: string) => {
  const match = /\((-?\d+(?:\.\d+)?(?:,-?\d+(?:\.\d+)?)?)\)$/.exec(name);
  return match?.[1] ?? null;
};
/** Deterministic IDs are namespace scoped to FI and bookmaker market. */
export function parseBet365Catalogue(fi: string, mode: 'live' | 'upcoming', response: unknown): Bet365Catalogue {
  if (!safeId(fi)) throw new Error('INVALID_BET365_FI');
  const parsed = mode === 'live' ? parseBet365LivePreview(fi, response) : parseBet365PrematchPreview(fi, response);
  const seen = new Set<string>();
  const markets: Bet365CatalogueMarket[] = [];
  for (const market of parsed.markets) {
    if (!market.key || seen.has(market.key)) continue;
    seen.add(market.key);
    const selections = market.selections.filter(s => !!safePrice(s.decimal) && !!s.id && !unlabelled(s.label))
      .map(s => ({ id: `${market.key}:${s.id}`, name: s.label, odds: s.decimal, status: 'open' as const, line: lineFromLabel(s.label) }));
    if (!selections.length) continue;
    markets.push({ id: market.key, name: market.title, mode, status: 'open', selections });
  }
  return { fi, mode, marketCount: markets.length,
    selectionCount: markets.reduce((sum, m) => sum + m.selections.length, 0),
    markets, readOnly: true };
}
/** Runtime guard against accidentally publishing unverified market catalogues
 * to the canonical wager-selection and settlement tables. */
export function canPublishBet365CatalogueToWagering(): false { return false; }
