/**
 * JSON serialisation of money.
 *
 * All monetary values and prices are `bigint` (minor units / odds scaled by 10^4) because
 * JavaScript numbers cannot represent them exactly. `JSON.stringify` throws on bigint, so
 * the platform installs a single global serialiser that renders them as **decimal strings**.
 *
 * Rules:
 *  - bigint -> decimal string (e.g. 12_500_000n -> "12500000"). Clients parse them back with
 *    the BigInt-safe helpers in `src/lib/i18n` and never with `Number()`.
 *  - No precision is lost in transit, and no money value ever becomes a float.
 *
 * This module is imported for its side effect by the API error handler (i.e. by every route)
 * and must be imported before any response is serialised.
 */
const install = (): void => {
  const proto = BigInt.prototype as { toJSON?: () => string };
  if (typeof proto.toJSON === 'function') return;
  Object.defineProperty(BigInt.prototype, 'toJSON', {
    value(this: bigint): string {
      return this.toString();
    },
    writable: true,
    enumerable: false,
    configurable: true,
  });
};

install();

/** Explicit serialiser for code paths that build JSON by hand (exports, CSV, webhooks). */
export function jsonSafe(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, jsonSafe(entry)]));
  }
  return value;
}

/** JSON stringify that can never throw on bigint and never emits floats for money. */
export function stringifyJsonSafe(value: unknown): string {
  return JSON.stringify(jsonSafe(value));
}
