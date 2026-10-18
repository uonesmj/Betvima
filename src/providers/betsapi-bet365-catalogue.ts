/** Bet365 catalogue adapter: preserves every explicitly quoted bookmaker market.
 * Catalogue data is never authoritative for staking until each market has
 * verified rules and stable provider identity. */
import { parseBet365LivePreview, parseBet365PrematchPreview } from './betsapi-bet365-preview';
import { string, safePrice } from './betsapi-normalization';

/** Strict, read-only candidates; not a permission to take wagers.
 * Period, line, selection side and authoritative settlement must be validated separately. */
export function identifyBet365SettlementCandidate(name: string): string | null {
  const normalized = name.toLowerCase().trim().replace(/\s+/g, ' ');
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
    'goals odd/even': 'GOALS_ODD_EVEN',
    'last team to score': 'LAST_TEAM_TO_SCORE',
  };
  return exact[normalized] ?? null;
}
/** Diagnostic selection code only. Never infer a side from the team name or
 * from fuzzy text. Goal lines must be explicitly present and numeric. */
export function identifyBet365SelectionCandidate(marketType: string | null, label: string, line: string | null): string | null {
  if (!marketType) return null;
  const name = label.trim().toLowerCase().replace(/\s+/g, ' ');
  const sides: Record<string, string> = { home: 'HOME', draw: 'DRAW', away: 'AWAY' };
  if (marketType === '1X2') return sides[name] ?? null;
  if (marketType === 'DOUBLE_CHANCE') {
    const codes: Record<string, string> = {
      '1x': 'HOME_DRAW', '12': 'HOME_AWAY', 'x2': 'DRAW_AWAY',
      'home or draw': 'HOME_DRAW', 'home or away': 'HOME_AWAY', 'draw or away': 'DRAW_AWAY',
    };
    return codes[name] ?? null;
  }
  if (marketType === 'BTTS') return name === 'yes' ? 'YES' : name === 'no' ? 'NO' : null;
  if (marketType === 'GOALS_ODD_EVEN') return name === 'odd' ? 'ODD' : name === 'even' ? 'EVEN' : null;
  if (marketType === 'LAST_TEAM_TO_SCORE') return name === 'home' ? 'HOME' : name === 'away' ? 'AWAY' : name === 'neither' ? 'NEITHER' : null;
  if (marketType === 'OVER_UNDER') {
    const raw = line?.trim() || /^((?:over|under))\s+([0-9]+(?:\.[0-9]+)?)$/.exec(name)?.[2] || '';
    if (!/^[0-9]{1,2}(?:\.(?:0|25|5|50|75))?$/.test(raw)) return null;
    const side = /^(over|under)(?:\s|$)/.exec(name)?.[1];
    return side ? side.toUpperCase() + '_' + raw.replace('.', '_') : null;
  }
  return null;
}
export type Bet365CatalogueMarket = {
  id: string; name: string; mode: 'live' | 'upcoming';
  settlementCandidate: string | null;
  status: 'open' | 'suspended';
  selections: Array<{ id: string; name: string; odds: string; status: 'open' | 'suspended'; line: string | null; selectionCandidate: string | null }>;
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
    const settlementCandidate = identifyBet365SettlementCandidate(market.title);
    const selections = market.selections.filter(s => !!safePrice(s.decimal) && !!s.id && !unlabelled(s.label))
      .filter(s => { if (usedSelections.has(s.id)) return false; usedSelections.add(s.id); return true; })
      .map(s => ({ id: `${market.key}:${s.id}`, name: s.label, odds: s.decimal,
        status: market.status === 'suspended' || s.status === 'suspended' ? 'suspended' as const : 'open' as const,
        line: s.line ?? lineFromLabel(s.label),
        selectionCandidate: identifyBet365SelectionCandidate(settlementCandidate, s.label, s.line ?? lineFromLabel(s.label)) }));
    if (!selections.length) continue;
    markets.push({ id: market.key, name: market.title, mode,
      settlementCandidate,
      status: market.status === 'suspended' ? 'suspended' : 'open', selections });
  }
  return { fi, mode, marketCount: markets.length,
    selectionCount: markets.reduce((sum, m) => sum + m.selections.length, 0),
    markets, readOnly: true };
}
/** Aggregate diagnostics only: never authorizes quote placement or settlement. */
export function summarizeBet365Catalogue(catalogue: Bet365Catalogue) {
  const totals = {
    marketGroups: catalogue.markets.length,
    selections: 0,
    openPricedSelections: 0,
    suspendedSelections: 0,
    exactMappedSelections: 0,
    unresolvedSelections: 0,
    readOnly: true as const,
    wageringEligible: false as const,
  };
  for (const market of catalogue.markets) {
    for (const selection of market.selections) {
      totals.selections++;
      if (market.status === 'suspended' || selection.status === 'suspended') {
        totals.suspendedSelections++;
        continue;
      }
      totals.openPricedSelections++;
      if (market.settlementCandidate && selection.selectionCandidate) totals.exactMappedSelections++;
      else totals.unresolvedSelections++;
    }
  }
  return totals;
}
/** FI and Events API identities inhabit different namespaces.
 * This helper is deliberately conservative: matching numeric suffixes is NOT
 * evidence that two fixtures are identical. */
export function validateBet365FixtureLink(fi: string, eventsProviderId: string, verified: { fi: string; eventsProviderId: string } | null): boolean {
  if (!/^\d{1,16}$/.test(fi) || !/^\d{1,3}:\d{1,16}$/.test(eventsProviderId)) return false;
  if (!verified) return false;
  return verified.fi === fi && verified.eventsProviderId === eventsProviderId;
}
/** Read-only identity reconciliation. A candidate is never a verified mapping:
 * independent operator/provider corroboration is required before wager linkage. */
export type Bet365FixtureIdentity = {
  id: string;
  home: string;
  away: string;
  startsAt: string;
};
export type Bet365Reconciliation = {
  candidate: boolean;
  reasons: string[];
  requiresIndependentVerification: true;
};
const canonicalTeam = (value: string): string =>
  value.normalize('NFKC').trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').replace(/\s+/g, ' ').trim();
export function compareBet365FixtureIdentity(fi: Bet365FixtureIdentity, event: Bet365FixtureIdentity): Bet365Reconciliation {
  const reasons: string[] = [];
  if (!/^\d{1,16}$/.test(fi.id) || !/^\d{1,3}:\d{1,16}$/.test(event.id)) reasons.push('INVALID_ID');
  const fHome = canonicalTeam(fi.home), fAway = canonicalTeam(fi.away);
  const eHome = canonicalTeam(event.home), eAway = canonicalTeam(event.away);
  if (!fHome || !fAway || !eHome || !eAway) reasons.push('MISSING_TEAM');
  else if (fHome !== eHome || fAway !== eAway) reasons.push('TEAM_MISMATCH');
  if (fHome && fAway && fHome === fAway) reasons.push('INVALID_TEAMS');
  const a = Date.parse(fi.startsAt), b = Date.parse(event.startsAt);
  if (!Number.isFinite(a) || !Number.isFinite(b)) reasons.push('INVALID_KICKOFF');
  else if (Math.abs(a - b) > 5 * 60_000) reasons.push('KICKOFF_MISMATCH');
  return { candidate: reasons.length === 0, reasons, requiresIndependentVerification: true };
}
/** Runtime guard against accidentally publishing unverified market catalogues
 * to the canonical wager-selection and settlement tables. */
export function canPublishBet365CatalogueToWagering(): false { return false; }
