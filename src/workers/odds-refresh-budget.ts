/**
 * Bounds a single awaited Odds API bulk tick so regular price updates don't
 * get stuck behind a several-hundred-fixture resync. These are hard maximums,
 * not a guarantee of freshness: the normal database guards still reject
 * stale prices, suspended markets and closed fixtures.
 */
export const PREMATCH_REFRESH_LIMITS = Object.freeze({
  near: 24,
  mid: 12,
  far: 4,
  maxPerCoreTick: 40,
  detachedExtendedDefault: 40,
  detachedExtendedMaximum: 80,
} as const);

export function extendedRefreshBudget(raw: string | undefined): number {
  const configured = Number(raw);
  if (!raw || !Number.isFinite(configured)) return PREMATCH_REFRESH_LIMITS.detachedExtendedDefault;
  return Math.max(1, Math.min(PREMATCH_REFRESH_LIMITS.detachedExtendedMaximum, Math.floor(configured)));
}
