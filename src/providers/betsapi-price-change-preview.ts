/** Pure read-only price-change decision, deliberately not a wagering quote. */
import { safePrice } from './betsapi-normalization';
import type { Bet365Catalogue } from './betsapi-bet365-catalogue';

export type PreviewPriceDecision = {
  state: 'unchanged' | 'changed_requires_acceptance' | 'unavailable';
  currentOdds: string | null;
  previousOdds: string | null;
  executable: false;
  reason: string | null;
};

/**
 * A selection must be re-read from the *latest* bookmaker catalogue.
 * No source timestamp or identity verification => never authorize a stake.
 */
export function compareBet365PreviewPrice(
  catalogue: Bet365Catalogue,
  marketId: string,
  selectionId: string,
  previouslySeenOdds: string,
): PreviewPriceDecision {
  const unavailable = (reason: string): PreviewPriceDecision => ({
    state: 'unavailable', currentOdds: null, previousOdds: safePrice(previouslySeenOdds),
    executable: false, reason,
  });
  if (!catalogue.readOnly || !/^bet365:\d{1,16}:.+/.test(marketId) ||
      !marketId.startsWith('bet365:' + catalogue.fi + ':') ||
      !selectionId.startsWith(marketId + ':')) return unavailable('IDENTITY_UNVERIFIED');
  const market = catalogue.markets.find(x => x.id === marketId);
  const selection = market?.selections.find(x => x.id === selectionId);
  if (!market || !selection) return unavailable('SELECTION_MISSING');
  if (market.status !== 'open' || selection.status !== 'open') return unavailable('SELECTION_SUSPENDED');
  const current = safePrice(selection.odds);
  const previous = safePrice(previouslySeenOdds);
  if (!current || !previous) return unavailable('INVALID_ODDS');
  return {
    state: Number(current) === Number(previous) ? 'unchanged' : 'changed_requires_acceptance',
    currentOdds: current, previousOdds: previous, executable: false, reason: null,
  };
}
