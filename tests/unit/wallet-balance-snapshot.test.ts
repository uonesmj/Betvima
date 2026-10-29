import { describe, expect, it, vi } from 'vitest';
import type { Db } from '@/lib/ports/db';
import { readWalletBalanceSnapshot } from '@/server/wallet/balance-snapshot';

describe('lightweight wallet balance query', () => {
  it('reads only the authenticated user canonical-currency snapshot', async () => {
    const snapshot = {
      currency: 'USD', balanceMinor: '8000', heldMinor: '500',
      availableMinor: '7500', version: '12',
    };
    const queryOne = vi.fn().mockResolvedValue(snapshot);
    const db = { queryOne } as unknown as Db;
    expect(await readWalletBalanceSnapshot(db,
      '11111111-1111-4111-8111-111111111111', 'USD')).toEqual(snapshot);
    expect(queryOne).toHaveBeenCalledTimes(1);
    expect(queryOne.mock.calls[0][0]).toContain('from nova.wallets');
    expect(queryOne.mock.calls[0][0]).not.toContain('wallet_transactions');
    expect(queryOne.mock.calls[0][0]).not.toContain('payments');
    expect(queryOne.mock.calls[0][0]).toContain('greatest(balance_minor-locked_minor, 0)');
    expect(queryOne.mock.calls[0][1]).toEqual([
      '11111111-1111-4111-8111-111111111111', 'USD'
    ]);
  });

  it('does not create or fabricate a missing wallet', async () => {
    const queryOne = vi.fn().mockResolvedValue(null);
    const db = { queryOne } as unknown as Db;
    expect(await readWalletBalanceSnapshot(db, 'user', 'USD')).toBeNull();
    expect(queryOne).toHaveBeenCalledTimes(1);
  });

  it('propagates read errors without guessing a balance', async () => {
    const db = { queryOne: vi.fn().mockRejectedValue(new Error('database offline')) } as unknown as Db;
    await expect(readWalletBalanceSnapshot(db, 'user', 'USD'))
      .rejects.toThrow('database offline');
  });
});
