/**
 * Money must survive JSON serialisation exactly. Every API route returns bigint balances and
 * prices, so the global serialiser is a correctness requirement, not a convenience.
 */
import { describe, expect, it } from 'vitest';
import { jsonSafe, stringifyJsonSafe } from '@/server/json';

describe('bigint JSON serialisation', () => {
  it('serialises top-level and nested bigints as decimal strings', () => {
    // The global patch is installed on import of '@/server/json'.
    expect(JSON.stringify({ balanceMinor: 12_500_000n })).toBe('{"balanceMinor":"12500000"}');
    const payload = JSON.stringify({
      ok: true,
      data: {
        wallet: { balanceMinor: 9007199254740993n, currency: 'IRT' },
        bets: [{ stakeMinor: 50_000n, payoutMinor: 237_500n }],
      },
    });
    expect(JSON.parse(payload).data.wallet.balanceMinor).toBe('9007199254740993');
    expect(JSON.parse(payload).data.bets[0].payoutMinor).toBe('237500');
  });

  it('does not lose precision beyond Number.MAX_SAFE_INTEGER', () => {
    const huge = 9_007_199_254_740_993n; // MAX_SAFE_INTEGER + 2
    const roundTrip = JSON.parse(JSON.stringify({ value: huge })).value as string;
    expect(BigInt(roundTrip)).toBe(huge);
    expect(BigInt(Number(huge))).not.toBe(huge); // proof: Number() would have corrupted it
  });

  it('keeps the serialiser non-enumerable and idempotent', () => {
    expect(Object.keys(BigInt.prototype)).toHaveLength(0);
    expect(JSON.stringify([0n, -3500n])).toBe('["0","-3500"]');
  });

  it('jsonSafe handles mixed structures for exports', () => {
    const value = jsonSafe({ at: new Date(0), rows: [{ total: 1000n }, null] }) as { at: Date; rows: unknown[] };
    expect(value.rows[0]).toEqual({ total: '1000' });
    expect(stringifyJsonSafe({ a: 1n })).toBe('{"a":"1"}');
  });
});
