/**
 * Stable client-only fingerprints. The signed quote is still verified on the
 * server; these identifiers prevent the UI from submitting a quote belonging
 * to a previous stake, currency, funding source or set of picks.
 */
export interface PlacementFingerprintInput {
  userId: string | null;
  currency: string;
  stakeMinor: string;
  fundingSource: string;
  bonusGrantId: string | null;
  items: ReadonlyArray<{
    selectionId: string;
    marketId: string;
    matchId: string;
    oddsScaled: string;
    oddsVersionSeen: number;
  }>;
}

function identity(input: PlacementFingerprintInput) {
  return {
    userId: input.userId ?? '',
    currency: input.currency,
    stakeMinor: input.stakeMinor,
    fundingSource: input.fundingSource,
    bonusGrantId: input.bonusGrantId,
    type: input.items.length > 1 ? 'MULTIPLE' : 'SINGLE',
    selections: [...input.items].map((item) => ({
      selectionId: item.selectionId,
      marketId: item.marketId,
      matchId: item.matchId,
    })).sort((a, b) => a.selectionId.localeCompare(b.selectionId)),
  };
}

/** Remains stable across an accepted odds movement; use for retry deduplication. */
export function placementIntentFingerprint(input: PlacementFingerprintInput): string {
  return JSON.stringify(identity(input));
}

/** Changes whenever the displayed odds or odds version changes. */
export function quoteContextFingerprint(input: PlacementFingerprintInput): string {
  return JSON.stringify({
    ...identity(input),
    versions: [...input.items].map((item) => ({
      selectionId: item.selectionId,
      oddsScaled: item.oddsScaled,
      oddsVersionSeen: item.oddsVersionSeen,
    })).sort((a,b) => a.selectionId.localeCompare(b.selectionId)),
  });
}

export function isCurrentQuote(
  quote: { contextKey?: string; expiresAt?: string } | null,
  contextKey: string,
  nowMs: number = Date.now(),
): boolean {
  return Boolean(
    quote && quote.contextKey === contextKey &&
    quote.expiresAt && Number.isFinite(Date.parse(quote.expiresAt)) &&
    Date.parse(quote.expiresAt) > nowMs
  );
}
