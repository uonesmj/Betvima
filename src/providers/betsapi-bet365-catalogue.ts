/** Bet365 catalogue adapter: preserves every explicitly quoted bookmaker market.
 * Catalogue data is never authoritative for staking until each market has
 * verified rules and stable provider identity. */
import { parseBet365LivePreview, parseBet365PrematchPreview } from './betsapi-bet365-preview';
import { string, safePrice } from './betsapi-normalization';

/** Strict, read-only candidates; not a permission to take wagers.
 * Period, line, selection side and authoritative settlement must be validated separately. */
export function identifyBet365SettlementCandidate(name: string): string | null {
  const normalized = name.toLowerCase().trim().replace(/\\s+/g, ' ');
  const exact: Record<string, string> = {
    'fulltime result': '1X2',
    'full time result': '1X2',
    'match result': '1X2',
    'double chance': 'DOUBLE_CHANCE',
    'draw no bet': 'DRAW_NO_BET',
    'both teams to score': 'BTTS',
    'correct score': 'CORRECT_SCORE',
    'asian handicap': 'ASIAN_HANDICAP',
    'goals over/under': 'OVER_UNDER',
    'half time result': 'HALF_TIME',
  };
  return exact[normalized] ?? null;
}
export type Bet365CatalogueMarket = {
  id: string; name: string; mode: 'live' | 'upcoming';
  settlementCandidate: string | null;
  status: 'open' | 'suspended';
  selections: Array<{ id: string; name: string; odds: string; status: 'open' | 'suspended'; line: string | null }>;
};
export type Bet365Catalogue = {
  fi: string; mode: 'live' | 'upcoming'; marketCount: number;
  selectionCount: number; markets: Bet365CatalogueMarket[];
  readOnly: true;
};
const safeId = (x: unknown) => /^\d{1,16}$/.test(string(x));
const unlabelled = (x: string) => /^Unlabelled outcome #/i.test(x);
const lineFromLabel = (name: string) => {
  const match = /\((-?\d+(?:\.\d+)?(?:,-?\d+(?:\.\d+)?)?)\)$/.exec(name);
  return match?.[1] ?? null;
};
/** Deterministic IDs are namespace scoped to FI and bookmaker market. */
export function parseBet365Catalogue(fi: string, mode: 'live' | 'upcoming', response: unknown): Bet365Catalogue {
  if (!safeId(fi)) throw new Error('INVALID_BET365_FI');
  const parsed = mode === 'live' ? parseBet365LivePreview(fi, response, true) : parseBet365PrematchPreview(fi, response, true);
  const seen = new Set<string>();
  const markets: Bet365CatalogueMarket[] = [];
  for (const market of parsed.markets) {
    if (!market.key || seen.has(market.key)) continue;
    seen.add(market.key);
    const usedSelections = new Set<string>();
    const selections = market.selections.filter(s => !!safePrice(s.decimal) && !!s.id && !unlabelled(s.label))
      .filter(s => { if (usedSelections.has(s.id)) return false; usedSelections.add(s.id); return true; })
      .map(s => ({ id: `${market.key}:${s.id}`, name: s.label, odds: s.decimal,
        status: market.status === 'suspended' || s.status === 'suspended' ? 'suspended' as const : 'open' as const,
        line: s.line ?? lineFromLabel(s.label) }));
    if (!selections.length) continue;
    markets.push({ id: market.key, name: market.title, mode,
      settlementCandidate: identifyBet365SettlementCandidate(market.title),
      status: market.status === 'suspended' ? 'suspended' : 'open', selections });
  }
  return { fi, mode, marketCount: markets.length,
    selectionCount: markets.reduce((sum, m) => sum + m.selections.length, 0),
    markets, readOnly: true };
}
/** Runtime guard against accidentally publishing unverified market catalogues
 * to the canonical wager-selection and settlement tables. */
export function canPublishBet365CatalogueToWagering(): false { return false; }
