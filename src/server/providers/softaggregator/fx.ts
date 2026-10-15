// Exact USD-cent to Iranian fiat-unit calculations (pure, no wallet writes).
export type CasinoCurrency = 'USD' | 'IRT' | 'IRR';
const SCALE = 100_000_000n;
export function parseIrtUsdRate(text: string): bigint {
  if (!/^\d{1,8}(?:\.\d{1,8})?$/.test(text)) throw new Error('INVALID_FX_RATE');
  const [whole, frac = ''] = text.split('.');
  const rate = BigInt(whole!) * SCALE + BigInt(frac.padEnd(8, '0'));
  if (rate < 1000n * SCALE || rate > 10000000n * SCALE) throw new Error('INVALID_FX_RANGE');
  return rate;
}
function multiplier(currency: CasinoCurrency): bigint {
  if (currency === 'IRT') return 1n;
  if (currency === 'IRR') return 10n;
  if (currency === 'USD') return 0n;
  throw new Error('UNSUPPORTED_CURRENCY');
}
export function casinoUsdToLocalMinor(cents: bigint, currency: CasinoCurrency, rate: string, round: 'up' | 'down'): bigint {
  if (cents < 0n || cents > 1000000000000n) throw new Error('INVALID_USD_AMOUNT');
  if (currency === 'USD') return cents;
  const numerator = cents * parseIrtUsdRate(rate) * multiplier(currency);
  const divisor = 100n * SCALE;
  return round === 'up' ? (numerator + divisor - 1n) / divisor : numerator / divisor;
}
export function casinoLocalMinorToUsd(available: bigint, currency: CasinoCurrency, rate: string): bigint {
  if (available < 0n) throw new Error('INVALID_BALANCE');
  if (currency === 'USD') return available;
  return (available * 100n * SCALE) / (parseIrtUsdRate(rate) * multiplier(currency));
}
export function exactCasinoRefund(originalLocalDebit: bigint, originalUsdDebit: bigint, refundedUsd: bigint): bigint {
  if (originalLocalDebit <= 0n || originalUsdDebit <= 0n || originalUsdDebit !== refundedUsd)
    throw new Error('ORIGINAL_DEBIT_REQUIRED');
  return originalLocalDebit;
}

export type CasinoFxSnapshot = Readonly<{
  source: 'arzhaam';
  rateIrtPerUsd: string;
  observedAt: string;
  fetchedAt: string;
}>;

/** Fail closed on missing, stale, or future-dated rate observations. */
export function validateCasinoFxSnapshot(snapshot: CasinoFxSnapshot, now = Date.now()): bigint {
  if (snapshot.source !== 'arzhaam') throw new Error('INVALID_CASINO_FX_SOURCE');
  const rate = parseIrtUsdRate(snapshot.rateIrtPerUsd);
  const observedAt = Date.parse(snapshot.observedAt);
  const fetchedAt = Date.parse(snapshot.fetchedAt);
  if (!Number.isFinite(observedAt) || !Number.isFinite(fetchedAt) ||
      observedAt > now + 10_000 || fetchedAt > now + 10_000 ||
      observedAt < now - 120_000 || fetchedAt < now - 30_000 ||
      fetchedAt + 10_000 < observedAt) throw new Error('STALE_CASINO_FX_QUOTE');
  return rate;
}
