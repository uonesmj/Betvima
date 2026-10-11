/**
 * NOVA SPORTSBOOK - MONEY PRIMITIVE (authoritative)
 *
 * ABSOLUTE RULES ENFORCED HERE
 *  - Money is ALWAYS { amount: bigint } in MINOR UNITS + an explicit currency code.
 *  - JavaScript floating point is NEVER accepted for an authoritative amount.
 *    `toMinorUnits()` throws for `number` inputs to make accidental misuse loud.
 *  - A single documented rounding policy applies everywhere: HALF_UP away from zero.
 *
 * ROUNDING POLICY (docs/WALLET_LEDGER.md §Rounding):
 *   ROUND_HALF_UP_AWAY_FROM_ZERO - deterministic, symmetric for credit/debit,
 *   applied identically to stakes, payouts, commissions, affiliate settlement nets
 *   and reconciliation deltas. No other rounding mode exists in the codebase for
 *   monetary values (the only exception is `floorDiv`, used exclusively for
 *   non-monetary index/bucket math and explicitly named).
 */

export type RoundingMode = 'HALF_UP' | 'DOWN' | 'UP';

export interface CurrencyMeta {
  readonly code: string;
  /** Number of minor units per major unit (0 for IRT/IRR, 2 for EUR/USD). */
  readonly minorUnits: number;
  readonly symbol: string;
  readonly symbolFirst: boolean;
}

export const CURRENCIES: Readonly<Record<string, CurrencyMeta>> = Object.freeze({
  IRT: { code: 'IRT', minorUnits: 0, symbol: 'تومان', symbolFirst: false },
  IRR: { code: 'IRR', minorUnits: 0, symbol: 'ریال', symbolFirst: false },
  EUR: { code: 'EUR', minorUnits: 2, symbol: '€', symbolFirst: false },
  USD: { code: 'USD', minorUnits: 2, symbol: '$', symbolFirst: true },
  GBP: { code: 'GBP', minorUnits: 2, symbol: '£', symbolFirst: true },
  USDT: { code: 'USDT', minorUnits: 2, symbol: 'USDT', symbolFirst: false },
});

export const DEFAULT_CURRENCY = 'IRR';

export function currencyMeta(code: string): CurrencyMeta {
  const meta = CURRENCIES[code];
  if (!meta) throw new MoneyError(`UNKNOWN_CURRENCY: ${code}`);
  return meta;
}

export function isSupportedCurrency(code: string): boolean {
  return Object.prototype.hasOwnProperty.call(CURRENCIES, code);
}

export class MoneyError extends Error {
  readonly code: string;
  constructor(code: string, message?: string) {
    super(message ?? code);
    this.name = 'MoneyError';
    this.code = code;
  }
}

export interface Money {
  readonly amount: bigint;
  readonly currency: string;
}

export function money(amount: bigint, currency: string): Money {
  currencyMeta(currency); // validate early
  return { amount, currency };
}

export const ZERO_OF = (currency: string): Money => money(0n, currency);

/* ------------------------------------------------------------------ *
 * Rounding                                                           *
 * ------------------------------------------------------------------ */

/** Deterministic division of bigints with an explicit, documented rounding mode. */
export function roundDiv(numerator: bigint, denominator: bigint, mode: RoundingMode = 'HALF_UP'): bigint {
  if (denominator === 0n) throw new MoneyError('DIVISION_BY_ZERO');
  const negative = numerator < 0n !== denominator < 0n;
  const absN = numerator < 0n ? -numerator : numerator;
  const absD = denominator < 0n ? -denominator : denominator;
  let q = absN / absD;
  const r = absN % absD;
  if (mode === 'UP') {
    if (r > 0n) q += 1n;
  } else if (mode === 'HALF_UP') {
    if (r * 2n >= absD) q += 1n;
  }
  return negative ? -q : q;
}

/** Non-monetary helper: integer floor division (buckets, indexes). Never used for money. */
export function floorDiv(a: bigint, b: bigint): bigint {
  if (b === 0n) throw new MoneyError('DIVISION_BY_ZERO');
  const q = a / b;
  return a % b !== 0n && a < 0n !== b < 0n ? q - 1n : q;
}

/* ------------------------------------------------------------------ *
 * Parsing / serialisation                                            *
 * ------------------------------------------------------------------ */

const DECIMAL_RE = /^-?\d{1,3}(?:\d{3})*(?:\.\d+)?$|^-?\d+(?:\.\d+)?$/;

/**
 * Parse a human/admin supplied decimal string into minor units.
 * Rejects: numbers (float authority), NaN, exponent notation, unsupported precision.
 */
export function parseMoneyToMinorUnits(input: string, currency: string): bigint {
  if (typeof input !== 'string') throw new MoneyError('MONEY_MUST_BE_STRING');
  const meta = currencyMeta(currency);
  const cleaned = input.trim().replace(/[\u066B\u066C]/g, '').replace(/,/g, '');
  if (cleaned === '' || !DECIMAL_RE.test(cleaned)) throw new MoneyError(`INVALID_MONEY_FORMAT: ${input}`);
  const negative = cleaned.startsWith('-');
  const unsigned = negative ? cleaned.slice(1) : cleaned;
  const [intPart = '0', fracRaw = ''] = unsigned.split('.');
  if (fracRaw.length > meta.minorUnits && /[^0]/.test(fracRaw.slice(meta.minorUnits))) {
    throw new MoneyError(`PRECISION_EXCEEDED: ${currency} supports ${meta.minorUnits} decimals`);
  }
  const frac = fracRaw.slice(0, meta.minorUnits).padEnd(meta.minorUnits, '0');
  const minor = BigInt(intPart + frac);
  return negative ? -minor : minor;
}

export function tryParseMoneyToMinorUnits(input: string, currency: string): bigint | null {
  try {
    return parseMoneyToMinorUnits(input, currency);
  } catch {
    return null;
  }
}

/** Major-unit decimal string (no grouping, no symbol). Safe for JSON transport as string. */
export function formatMinorUnits(amount: bigint, currency: string): string {
  const meta = currencyMeta(currency);
  const negative = amount < 0n;
  const abs = negative ? -amount : amount;
  const digits = abs.toString().padStart(meta.minorUnits + 1, '0');
  const intPart = meta.minorUnits === 0 ? digits : digits.slice(0, digits.length - meta.minorUnits);
  const frac = meta.minorUnits === 0 ? '' : '.' + digits.slice(digits.length - meta.minorUnits);
  return `${negative ? '-' : ''}${intPart}${frac}`;
}

/** Localised, grouped display string. Uses Intl only for presentation, never for storage. */
export function formatMoney(m: Money, locale = 'en-US', opts: { symbol?: boolean } = {}): string {
  const meta = currencyMeta(m.currency);
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: meta.minorUnits,
    maximumFractionDigits: meta.minorUnits,
    useGrouping: true,
  }).format(Number(formatMinorUnits(m.amount, m.currency)));
  if (opts.symbol === false) return formatted;
  return meta.symbolFirst ? `${meta.symbol}${formatted}` : `${formatted} ${meta.symbol}`;
}

export function formatMoneyShort(m: Money, locale = 'en-US'): string {
  const meta = currencyMeta(m.currency);
  const abs = m.amount < 0n ? -m.amount : m.amount;
  const major = Number(formatMinorUnits(abs, m.currency));
  const sign = m.amount < 0n ? '-' : '';
  if (major >= 1_000_000_000) return `${sign}${(major / 1_000_000_000).toFixed(2)}B ${meta.code}`;
  if (major >= 1_000_000) return `${sign}${(major / 1_000_000).toFixed(2)}M ${meta.code}`;
  if (major >= 10_000) return `${sign}${(major / 1_000).toFixed(1)}K ${meta.code}`;
  return `${sign}${formatMoney(money(abs, m.currency), locale, { symbol: false })} ${meta.code}`;
}

/* ------------------------------------------------------------------ *
 * Arithmetic (currency-safe, overflow-safe by construction)          *
 * ------------------------------------------------------------------ */

function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) throw new MoneyError(`CURRENCY_MISMATCH: ${a.currency} vs ${b.currency}`);
}

export function add(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.amount + b.amount, a.currency);
}

export function sub(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.amount - b.amount, a.currency);
}

export function negate(a: Money): Money {
  return money(-a.amount, a.currency);
}

export function abs(a: Money): Money {
  return money(a.amount < 0n ? -a.amount : a.amount, a.currency);
}

export function scale(a: Money, factor: bigint): Money {
  return money(a.amount * factor, a.currency);
}

/** Multiply by a rational factor (num/den) with the global rounding policy. */
export function mulRatio(a: Money, num: bigint, den: bigint, mode: RoundingMode = 'HALF_UP'): Money {
  if (den === 0n) throw new MoneyError('DIVISION_BY_ZERO');
  return money(roundDiv(a.amount * num, den, mode), a.currency);
}

/** Apply a basis-point rate (3500 bps = 35%) with the global rounding policy. */
export function applyBps(a: Money, bps: bigint, mode: RoundingMode = 'HALF_UP'): Money {
  return money(roundDiv(a.amount * bps, 10_000n, mode), a.currency);
}

export function compare(a: Money, b: Money): -1 | 0 | 1 {
  assertSameCurrency(a, b);
  return a.amount === b.amount ? 0 : a.amount > b.amount ? 1 : -1;
}

export const isZero = (a: Money): boolean => a.amount === 0n;
export const isNegative = (a: Money): boolean => a.amount < 0n;
export const isPositive = (a: Money): boolean => a.amount > 0n;

export function maxMoney(a: Money, b: Money): Money {
  return compare(a, b) >= 0 ? a : b;
}

export function minMoney(a: Money, b: Money): Money {
  return compare(a, b) <= 0 ? a : b;
}

/** Sum with explicit currency so an empty list still yields a typed zero. */
export function sum(currency: string, items: readonly Money[]): Money {
  let total = 0n;
  for (const item of items) {
    assertSameCurrency({ amount: 0n, currency }, item);
    total += item.amount;
  }
  return money(total, currency);
}

/** Serialise for DB/JSON transport: amount as a decimal string, never a JS number. */
export function toTransport(m: Money): { amount: string; currency: string } {
  return { amount: formatMinorUnits(m.amount, m.currency), currency: m.currency };
}

export function fromTransport(t: { amount: string; currency: string }): Money {
  return money(parseMoneyToMinorUnits(t.amount, t.currency), t.currency);
}

/** Return value clamped at zero (used for MODEL B floor-zero payable balances ONLY). */
export function clampAtZero(a: Money): Money {
  return a.amount < 0n ? money(0n, a.currency) : a;
}
