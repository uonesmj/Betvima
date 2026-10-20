/**
 * Browser-only, coalesced read of wallet-authoritative BetsAPI 1X2 offers.
 * The Bet365 FI listing is display-only; only this endpoint provides real
 * match/market/selection UUIDs for the normal bet slip.
 *
 * Requests shared by all visible cards, not one query per card. The server
 * independently enforces the 35-second quote/source timestamp window.
 */
export interface CanonicalBetsApiSelection {
  selectionId: string;
  code: 'HOME' | 'DRAW' | 'AWAY';
  oddsScaled: string;
  oddsVersion: number;
}
export interface CanonicalBetsApiMarket {
  providerId: string;
  matchId: string;
  marketId: string;
  home: string;
  away: string;
  expiresAt: string;
  selections: CanonicalBetsApiSelection[];
}

let lastRequestedAt = 0;
let sharedRequest: Promise<CanonicalBetsApiMarket[]> | null = null;
const SHARED_TTL_MS = 8_000;

export async function readCanonicalBetsApiMarkets(): Promise<CanonicalBetsApiMarket[]> {
  const now = Date.now();
  if (sharedRequest && now - lastRequestedAt < SHARED_TTL_MS) return sharedRequest;
  lastRequestedAt = now;
  sharedRequest = (async () => {
    try {
      const response = await fetch('/api/v1/betsapi/canonical-wagers', { cache: 'no-store' });
      if (!response.ok) return [];
      const payload = await response.json() as {
        ok?: boolean;
        data?: { markets?: CanonicalBetsApiMarket[] };
      };
      return payload.ok && Array.isArray(payload.data?.markets) ? payload.data.markets : [];
    } catch {
      return [];
    }
  })();
  return sharedRequest;
}

export function canonicalBetsApiMarketForEvent(
  eventId: string | null | undefined,
  markets: readonly CanonicalBetsApiMarket[],
  now = Date.now(),
): CanonicalBetsApiMarket | null {
  if (!eventId || !/^[0-9]{1,16}$/.test(eventId)) return null;
  const expectedProviderId = '1:' + eventId;
  return markets.find(market => {
    if (market.providerId !== expectedProviderId ||
        !Number.isFinite(Date.parse(market.expiresAt)) ||
        Date.parse(market.expiresAt) <= now + 2000 ||
        market.selections.length !== 3) return false;
    const codes = new Set(market.selections.map(s => s.code));
    return codes.size === 3 &&
      codes.has('HOME') && codes.has('DRAW') && codes.has('AWAY') &&
      market.selections.every(s =>
        s.oddsVersion > 0 &&
        Number(s.oddsScaled) >= 10_100 &&
        Number.isFinite(Number(s.oddsScaled)) &&
        Boolean(s.selectionId));
  }) ?? null;
}
