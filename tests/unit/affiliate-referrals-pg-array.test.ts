import { describe, expect, it } from 'vitest';
import { param, pgArray } from '@/server/db/rows';

describe('referrals lifetime finance query parameter encoding', () => {
  const ids = [
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000002',
  ];

  it('passes UUIDs as a native postgres array for ANY($5::uuid[])', () => {
    const bound = param(pgArray(ids));
    expect(Array.isArray(bound)).toBe(true);
    expect(bound).toEqual(ids);
  });

  it('does not accidentally send a JSON array to the UUID-array SQL parameter', () => {
    expect(param(ids)).toBe(JSON.stringify(ids));
    expect(param(pgArray(ids))).not.toBe(JSON.stringify(ids));
  });

  it('preserves an empty pgArray and does not mutate the originating IDs', () => {
    expect(param(pgArray([]))).toEqual([]);
    const source = [...ids];
    pgArray(source);
    expect(source).toEqual(ids);
  });
});
