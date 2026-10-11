/** Row coercion helpers: Postgres returns int8/numeric as strings; money must stay exact. */
export type Row = Record<string, unknown>;

export function toBig(value: unknown, fallback = 0n): bigint {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') {
    if (!Number.isInteger(value)) throw new Error(`EXACT_INTEGER_REQUIRED: ${value}`);
    return BigInt(value);
  }
  if (typeof value === 'string') {
    if (!/^-?\d+$/.test(value.trim())) {
      const n = Number(value);
      if (!Number.isFinite(n)) throw new Error(`INVALID_INTEGER: ${value}`);
      return BigInt(Math.round(n));
    }
    return BigInt(value.trim());
  }
  if (typeof value === 'boolean') return value ? 1n : 0n;
  throw new Error(`INVALID_INTEGER: ${String(value)}`);
}

export const toBigOrNull = (value: unknown): bigint | null =>
  value === null || value === undefined ? null : toBig(value);

export function toNum(value: unknown, fallback = 0): number {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'number') return value;
  if (typeof value === 'bigint') return Number(value);
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export const toNumOrNull = (value: unknown): number | null =>
  value === null || value === undefined ? null : toNum(value);

export function toBool(value: unknown, fallback = false): boolean {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value === 'true' || value === 't' || value === '1';
  if (typeof value === 'number') return value !== 0;
  return fallback;
}

export function toStr(value: unknown, fallback = ''): string {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string') return value;
  if (typeof value === 'bigint' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

export const toStrOrNull = (value: unknown): string | null =>
  value === null || value === undefined ? null : toStr(value);

export function toIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  const s = toStr(value);
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : d.toISOString();
}

export function toIsoOrNull(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return toIso(value);
}

export function toJson<T = Record<string, unknown>>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string') {
    try { return JSON.parse(value) as T; } catch { return fallback; }
  }
  return value as T;
}

/**
 * Wrapper marking a JS array as a Postgres ARRAY parameter.
 * Plain JS arrays are JSON (that is what every jsonb argument needs), so `pgArray`
 * exists to disambiguate the `= any($n::uuid[])` style queries.
 */
export class PgArray {
  constructor(readonly values: string[]) {}
}
export const pgArray = (values: readonly string[]): PgArray => new PgArray(values.map((v) => String(v)));

/** Convert a JS value to a `pg`-safe parameter (money/odds become decimal strings). */
export function param(value: unknown): string | number | boolean | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'boolean' || typeof value === 'number') return value;
  if (value instanceof Date) return value.toISOString();
  // Postgres arrays are passed through; every other array is JSON (jsonb arguments).
  if (value instanceof PgArray) return value.values as unknown as string;
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
