/**
 * The Odds API is the only supported provider for bookmaker prices and fixtures.
 * An unrecognized provider is never assigned a positive refresh budget.
 *
 * The Odds API prices expire after 300s for upcoming matches. With 5-minute
 * mid-fixture polling, selections spend much of their life safely suspended.
 * Prioritise inexpensive grouped/base-market refreshes over slow extended
 * per-event market discovery, without altering bet authorization or freshness.
 */
export interface PrematchRefreshCadence {
  nearMs: number;
  midMs: number;
  farMs: number;
  extendedNearMs: number;
  extendedFarMs: number;
  nearLimit: number;
  midLimit: number;
  farLimit: number;
  extendedLimit: number;
}

export function prematchRefreshCadence(providerName: string, configuredExtendedLimit: number): PrematchRefreshCadence {
  const provider = providerName.trim().toLowerCase();
  if (provider === 'the_odds_api') {
    return {
      nearMs: 20_000,
      midMs: 30_000,
      farMs: 45_000,
      extendedNearMs: 2 * 60_000,
      extendedFarMs: 5 * 60_000,
      nearLimit: 16,
      midLimit: 12,
      farLimit: 12,
      // Event-detail discovery is multiple calls per match. Limit it so base
      // odds still get regular upstream request capacity.
      extendedLimit: Math.max(1, Math.min(configuredExtendedLimit, 8)),
    };
  }

  // Fail closed if a stale service configuration tries to request quotes from
  // an unauthorized source; do not consume time, quota or publish its prices.
  return {
    nearMs: Number.MAX_SAFE_INTEGER,
    midMs: Number.MAX_SAFE_INTEGER,
    farMs: Number.MAX_SAFE_INTEGER,
    extendedNearMs: Number.MAX_SAFE_INTEGER,
    extendedFarMs: Number.MAX_SAFE_INTEGER,
    nearLimit: 0,
    midLimit: 0,
    farLimit: 0,
    extendedLimit: 0,
  };
}

export interface PrematchRefreshClock {
  near: number;
  mid: number;
  far: number;
  extendedNear: number;
  extendedFar: number;
}

export function duePrematchRefreshes(now: number, last: PrematchRefreshClock, cadence: PrematchRefreshCadence) {
  const near = now - last.near >= cadence.nearMs;
  const mid = now - last.mid >= cadence.midMs;
  const far = now - last.far >= cadence.farMs;
  const extendedNear = now - last.extendedNear >= cadence.extendedNearMs;
  const extendedFar = now - last.extendedFar >= cadence.extendedFarMs;
  return {
    near,
    mid,
    far,
    extendedNear,
    extendedFar,
    next: {
      near: near ? now : last.near,
      mid: mid ? now : last.mid,
      far: far ? now : last.far,
      extendedNear: extendedNear ? now : last.extendedNear,
      extendedFar: extendedFar ? now : last.extendedFar,
    },
  };
}
