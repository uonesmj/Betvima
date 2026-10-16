/**
 * An odds change is NOT consent to stake funds.
 * Consent must be a separate user interaction for one fresh signed quote
 * and an unchanged slip/user/currency/stake context.
 */
export interface SignedOddsConsent {
  quoteToken: string;
  contextKey: string;
}
export interface ChangedOdds {
  selectionId: string;
  previousOddsScaled: string;
  currentOddsScaled: string;
  direction: 'UP' | 'DOWN';
}
export function hasExplicitOddsConsent(
  consent: SignedOddsConsent | null,
  quoteToken: string | null | undefined,
  contextKey: string,
  changes: readonly ChangedOdds[] | null | undefined,
): boolean {
  if (!changes?.length) return true;
  return Boolean(
    consent &&
    quoteToken &&
    consent.quoteToken === quoteToken &&
    consent.contextKey === contextKey,
  );
}
export function actualOddsMovement(change: ChangedOdds): 'UP' | 'DOWN' | 'SAME' {
  const from = BigInt(change.previousOddsScaled);
  const to = BigInt(change.currentOddsScaled);
  return to > from ? 'UP' : to < from ? 'DOWN' : 'SAME';
}
