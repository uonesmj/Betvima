/** A quarantined Bet365 projection for ingestion QA only; no wagers or DB writes. */
import type { ProviderOddsBundle, ProviderOddsMarket } from '@/lib/ports/providers';
import type { Bet365Catalogue } from './betsapi-bet365-catalogue';
import { safePrice } from './betsapi-normalization';

export type Bet365Projection = {
  bookmakerFixtureId: string;
  observedAt: string;
  preview: ProviderOddsBundle;
  rejectedSelections: number;
  diagnosticsOnly: true;
  executable: false;
};

/** Never pass a preview identity into the production UUID-based quote endpoint. */
export function projectBet365ReadOnly(catalogue: Bet365Catalogue, observedAt: Date): Bet365Projection {
  if (!/^\d{1,16}$/.test(catalogue.fi) || !Number.isFinite(observedAt.getTime())) {
    throw new Error('INVALID_PREVIEW_IDENTITY');
  }
  const markets: ProviderOddsMarket[] = [];
  let rejectedSelections = 0;
  for (const market of catalogue.markets) {
    if (!market.settlementCandidate || !market.id.startsWith('bet365:' + catalogue.fi + ':')) {
      rejectedSelections += market.selections.length;
      continue;
    }
    const selections = market.selections.flatMap(selection => {
      const odds = safePrice(selection.odds);
      if (!selection.selectionCandidate || !odds || !selection.id.startsWith(market.id + ':')) {
        rejectedSelections++;
        return [];
      }
      return [{
        providerId: 'bet365-preview:' + catalogue.fi + ':' + selection.id,
        code: selection.selectionCandidate,
        name: selection.name,
        odds,
        line: selection.line,
        status: market.status === 'suspended' || selection.status === 'suspended' ? 'suspended' : 'open',
      }];
    });
    if (!selections.length) continue;
    markets.push({
      providerId: 'bet365-preview:' + catalogue.fi + ':' + market.id,
      key: market.settlementCandidate,
      type: market.settlementCandidate,
      specifier: null,
      isLive: catalogue.mode === 'live',
      status: market.status,
      sourceUpdatedAt: observedAt.toISOString(),
      selections,
    });
  }
  const iso = observedAt.toISOString();
  return {
    bookmakerFixtureId: catalogue.fi,
    observedAt: iso,
    preview: { matchProviderId: 'bet365-preview:' + catalogue.fi, updatedAt: iso, markets },
    rejectedSelections,
    diagnosticsOnly: true,
    executable: false,
  };
}
