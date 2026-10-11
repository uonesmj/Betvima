/**
 * NOVA SPORTSBOOK - ODDS PRIMITIVE
 *
 * Odds are stored and transported as INTEGER scaled values (scale = 10_000),
 * i.e. decimal 2.5000 -> 25000. Client-supplied odds are never authoritative:
 * they are treated as "the odds the user saw" and are only used for comparison
 * against the server's authoritative value (see BetslipEngine / placeBet).
 */

export const ODDS_SCALE = 10_000n;
export const MIN_DECIMAL_ODDS = 10_100n; // 1.01 (a price of 1.00 or below is not a valid bet)
export const MAX_DECIMAL_ODDS = 10_000_000n; // 1000.00

export type OddsScaled = bigint;

export class OddsError extends Error {
  readonly code: string;
  constructor(code: string, message?: string) {
    super(message ?? code);
    this.name = 'OddsError';
    this.code = code;
  }
}

export function oddsFromDecimalString(input: string): OddsScaled {
  const cleaned = input.trim().replace(/,/g, '');
  if (!/^\d+(\.\d{1,4})?$/.test(cleaned)) throw new OddsError(`INVALID_ODDS_FORMAT: ${input}`);
  const [intPart = '0', frac = ''] = cleaned.split('.');
  return BigInt(intPart) * ODDS_SCALE + BigInt(frac.padEnd(4, '0').slice(0, 4));
}

export function oddsFromNumberSafe(n: number): OddsScaled {
  if (!Number.isFinite(n) || n <= 0) throw new OddsError(`INVALID_ODDS: ${n}`);
  return oddsFromDecimalString(n.toFixed(4));
}

export function oddsToDecimalString(o: OddsScaled): string {
  const int = o / ODDS_SCALE;
  const frac = (o % ODDS_SCALE).toString().padStart(4, '0').replace(/0+$/, '');
  return frac.length ? `${int}.${frac}` : `${int}.0`;
}

export function oddsToDisplayString(o: OddsScaled, digits = 2): string {
  return (Number(o) / Number(ODDS_SCALE)).toFixed(digits);
}

export function isSaneOdds(o: OddsScaled): boolean {
  return o >= MIN_DECIMAL_ODDS && o <= MAX_DECIMAL_ODDS;
}

/** Implied probability in basis points (1/odds). */
export function impliedProbabilityBps(o: OddsScaled): bigint {
  if (o <= 0n) throw new OddsError('ODDS_MUST_BE_POSITIVE');
  return (ODDS_SCALE * 10_000n) / o;
}

/** Overround (bookmaker margin) of a complete market, in bps. */
export function overroundBps(odds: readonly OddsScaled[]): bigint {
  return odds.reduce<bigint>((acc, o) => acc + impliedProbabilityBps(o), 0n) - 10_000n;
}

/**
 * Combined accumulator odds as an exact rational:
 *   numerator = Π odds_i (scaled), denominator = ODDS_SCALE^(n-1)
 * Rounding happens ONCE, when the payout is computed, so accumulator pricing is
 * deterministic and free of cumulative float/rounding drift.
 */
export function accumulatorNumerator(odds: readonly OddsScaled[]): bigint {
  if (odds.length === 0) throw new OddsError('EMPTY_ACCUMULATOR');
  return odds.reduce<bigint>((acc, o) => acc * o, 1n);
}

export function accumulatorDenominator(legCount: number): bigint {
  if (legCount < 1) throw new OddsError('INVALID_LEG_COUNT');
  return ODDS_SCALE ** BigInt(legCount - 1);
}

export function accumulatorOddsScaled(odds: readonly OddsScaled[]): OddsScaled {
  const num = accumulatorNumerator(odds);
  const den = accumulatorDenominator(odds.length);
  return (num + den / 2n) / den; // HALF_UP on positive values
}

/** Signed movement in bps between two odds values (>0 means odds increased). */
export function oddsMovementBps(previous: OddsScaled, current: OddsScaled): bigint {
  if (previous <= 0n) return 0n;
  return ((current - previous) * 10_000n) / previous;
}

export type OddsMovementClass = 'INCREASED' | 'DECREASED' | 'UNCHANGED' | 'SIGNIFICANT';

export function classifyMovement(
  previous: OddsScaled,
  current: OddsScaled,
  significantThresholdBps = 1500n,
): OddsMovementClass {
  const movement = oddsMovementBps(previous, current);
  const abs = movement < 0n ? -movement : movement;
  if (abs === 0n) return 'UNCHANGED';
  if (abs >= significantThresholdBps) return 'SIGNIFICANT';
  return movement > 0n ? 'INCREASED' : 'DECREASED';
}

/* ------------------------------------------------------------------ *
 * Odds sanity / anomaly detection (see docs/ODDS_ENGINE.md)          *
 * ------------------------------------------------------------------ */

export type AnomalyCode =
  | 'INVALID_FORMAT'
  | 'OUT_OF_RANGE'
  | 'NEGATIVE_OR_ZERO'
  | 'ABNORMAL_JUMP'
  | 'STALE_TIMESTAMP'
  | 'FUTURE_TIMESTAMP'
  | 'PROVIDER_INCONSISTENT'
  | 'IMPOSSIBLE_PROBABILITY';

export interface Anomaly {
  readonly code: AnomalyCode;
  readonly detail: string;
  /** Rejection is stronger than suspension. */
  readonly severity: 'REJECT' | 'SUSPEND';
}

export interface OddsSanityInput {
  readonly odds: OddsScaled;
  readonly previousOdds?: OddsScaled | null;
  readonly providerTimestamp: Date;
  readonly ingestedAt: Date;
  readonly maxAgeSeconds: number;
  readonly maxJumpBps?: bigint;
  readonly outOfBandLow?: OddsScaled;
  readonly outOfBandHigh?: OddsScaled;
}

/**
 * Pure sanity check run by the odds ingestion worker BEFORE publishing.
 * Suspicious values are rejected or the selection is suspended - never published blindly.
 */
export function detectOddsAnomalies(input: OddsSanityInput): Anomaly[] {
  const anomalies: Anomaly[] = [];
  const { odds, previousOdds, providerTimestamp, ingestedAt, maxAgeSeconds } = input;
  const maxJumpBps = input.maxJumpBps ?? 6000n; // 60% move between consecutive ticks

  if (odds <= 0n) anomalies.push({ code: 'NEGATIVE_OR_ZERO', detail: `odds=${odds}`, severity: 'REJECT' });
  if (!isSaneOdds(odds)) anomalies.push({ code: 'OUT_OF_RANGE', detail: `odds=${oddsToDecimalString(odds)}`, severity: 'REJECT' });
  if (input.outOfBandLow !== undefined && odds < input.outOfBandLow) {
    anomalies.push({ code: 'IMPOSSIBLE_PROBABILITY', detail: 'below configured band low', severity: 'SUSPEND' });
  }
  if (input.outOfBandHigh !== undefined && odds > input.outOfBandHigh) {
    anomalies.push({ code: 'IMPOSSIBLE_PROBABILITY', detail: 'above configured band high', severity: 'SUSPEND' });
  }

  const ageMs = ingestedAt.getTime() - providerTimestamp.getTime();
  if (ageMs > maxAgeSeconds * 1000) {
    anomalies.push({ code: 'STALE_TIMESTAMP', detail: `age=${Math.round(ageMs / 1000)}s limit=${maxAgeSeconds}s`, severity: 'SUSPEND' });
  }
  if (ageMs < -60_000) {
    anomalies.push({ code: 'FUTURE_TIMESTAMP', detail: `age=${Math.round(ageMs / 1000)}s`, severity: 'REJECT' });
  }

  if (previousOdds && previousOdds > 0n) {
    const movement = oddsMovementBps(previousOdds, odds);
    const abs = movement < 0n ? -movement : movement;
    if (abs > maxJumpBps) {
      anomalies.push({
        code: 'ABNORMAL_JUMP',
        detail: `${oddsToDecimalString(previousOdds)} -> ${oddsToDecimalString(odds)} (${abs}bps)`,
        severity: 'SUSPEND',
      });
    }
  }
  return anomalies;
}

export function hasRejecting(anomalies: readonly Anomaly[]): boolean {
  return anomalies.some((a) => a.severity === 'REJECT');
}

export function hasSuspending(anomalies: readonly Anomaly[]): boolean {
  return anomalies.some((a) => a.severity === 'SUSPEND');
}

export function isStale(providerTimestamp: Date, now: Date, maxAgeSeconds: number): boolean {
  return now.getTime() - providerTimestamp.getTime() > maxAgeSeconds * 1000;
}
