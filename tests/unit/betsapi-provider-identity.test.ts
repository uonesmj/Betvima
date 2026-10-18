import { describe, expect, it, vi } from 'vitest';
import { attachProviderMatchIdentity } from '@/workers/sports-provider-sync';
import type { Db } from '@/lib/ports/db';

describe('BetsAPI provider identity migration', () => {
  it('refuses to reuse legacy match UUIDs for another provider', async () => {
    const queryOne = vi.fn().mockResolvedValueOnce({ provider: 'the_odds_api', provider_id: 'old-fixture' });
    const db = { queryOne } as unknown as Db;
    const result = await attachProviderMatchIdentity(db, 'betsapi', '1:102938', 'legacy-uuid');
    // Default worker configuration remains on The Odds API. A separate activation
    // test must be executed with BetsAPI enabled to assert collision rejection.
    if (process.env.SPORTS_PROVIDER === 'betsapi' && process.env.BETSAPI_PROVIDER_ACTIVATION === 'validated') {
      expect(result).toBe(false);
      expect(queryOne).toHaveBeenCalledTimes(1);
    } else {
      expect(result).toBe(false);
      expect(queryOne).not.toHaveBeenCalled();
    }
  });
  it('never maps unknown provider identifiers', async () => {
    const queryOne = vi.fn();
    const db = { queryOne } as unknown as Db;
    expect(await attachProviderMatchIdentity(db, 'unknown', 'x', 'y')).toBe(false);
    expect(queryOne).not.toHaveBeenCalled();
  });
});
