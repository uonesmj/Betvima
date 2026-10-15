import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Db } from '@/lib/ports/db';
import { getDb } from '@/server/db';
import { settleCasinoCallback } from '@/server/providers/softaggregator/wallet';
import type { SignedCallback } from '@/server/providers/softaggregator/contract';

vi.mock('@/server/db', () => ({ getDb: vi.fn() }));
vi.mock('@/server/providers/softaggregator/client', () => ({
  casinoRealMoneyEnabled: () => true,
  casinoRealMoneyUserAllowed: () => true,
}));

const userId = '7aa50699-cba1-4767-b7b4-dcd644399816';
const username = 'bv_' + userId.replace(/-/g, '');
const identity = (callId: string, action: 'credit' | 'debit', amount: bigint): SignedCallback => ({
  action, username, currency: 'USD', callId, amountMinor: amount,
  roundId: 'round-test', gameId: 'provider/game', rollback: false,
  identityHash: action + ':' + callId + ':' + amount,
});

function makeFakeDb(initial = 1000n, held = 200n) {
  let balance = initial;
  const receipts = new Map<string, { identity_hash: string; response_error: 0 | 1 | 2; response_balance_minor: string }>();
  const postings: Array<Record<string, unknown>> = [];
  const fake = {
    queryOne: vi.fn(async (sql: string, params: unknown[]) => {
      if (sql.includes('from nova.softaggregator_callback_receipts')) {
        return receipts.get(String(params[0])) ?? null;
      }
      if (sql.includes('from nova.profiles p')) {
        return {
          status: 'active', age_verified: true, country: 'DE', currency: 'USD',
          self_excluded: false, restricted: false,
          max_stake_per_bet_minor: null, max_stake_per_day_minor: null,
          loss_limit_daily_minor: null, loss_limit_weekly_minor: null,
        };
      }
      if (sql.includes('from nova.wallets')) {
        return { balance_minor: balance.toString(), locked_minor: held.toString(), is_frozen: false };
      }
      if (sql.includes('from nova.wallet_transactions')) {
        return { day_stake: '0', day_loss: '0', week_loss: '0' };
      }
      throw new Error('Unexpected query: ' + sql);
    }),
    query: vi.fn(async (sql: string, params: unknown[]) => {
      if (sql.includes('insert into nova.softaggregator_callback_receipts')) {
        receipts.set(String(params[0]), {
          identity_hash: String(params[1]),
          response_error: params[5] as 0 | 1 | 2,
          response_balance_minor: String(params[6]),
        });
      }
      return [];
    }),
    rpc: vi.fn(async (_function: string, args: Record<string, unknown>) => {
      postings.push(args);
      balance += BigInt(String(args.p_amount_minor));
      return { transaction_id: '11111111-1111-4111-8111-111111111111', balance_after_minor: balance.toString() };
    }),
    transaction: async (fn: (db: Db) => Promise<unknown>) => fn(fake as unknown as Db),
  };
  return { fake, receipts, postings, getBalance: () => balance };
}

describe('SoftAggregator financial callback behavior (isolated DB contract)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('debits available funds and replays the same transaction exactly once', async () => {
    const t = makeFakeDb();
    vi.mocked(getDb).mockReturnValue(t.fake as unknown as Db);
    const evt = identity('call-one', 'debit', 250n);
    expect(await settleCasinoCallback(evt)).toEqual({ error: 0, balance: 550 });
    expect(await settleCasinoCallback(evt)).toEqual({ error: 0, balance: 550 });
    expect(t.postings).toHaveLength(1);
    expect(t.getBalance()).toBe(750n);
    expect(t.postings[0]?.p_type).toBe('bet_debit');
    expect(t.postings[0]?.p_balance_floor).toBe('200');
  });

  it('credits a win even without a preceding bet (e.g. free spins)', async () => {
    const t = makeFakeDb();
    vi.mocked(getDb).mockReturnValue(t.fake as unknown as Db);
    expect(await settleCasinoCallback(identity('free-spin-win', 'credit', 500n)))
      .toEqual({ error: 0, balance: 1300 });
    expect(t.postings[0]?.p_type).toBe('win_credit');
  });

  it('persists rejected insufficient-balance results, even if the wallet later grows', async () => {
    const t = makeFakeDb();
    vi.mocked(getDb).mockReturnValue(t.fake as unknown as Db);
    const refused = identity('call-insufficient', 'debit', 900n);
    expect(await settleCasinoCallback(refused)).toEqual({ error: 1, balance: 800 });
    expect(await settleCasinoCallback(identity('separate-credit', 'credit', 1000n)))
      .toEqual({ error: 0, balance: 1800 });
    expect(await settleCasinoCallback(refused)).toEqual({ error: 1, balance: 800 });
    expect(t.postings).toHaveLength(1);
  });

  it('rejects conflicting reuse of the same provider transaction ID', async () => {
    const t = makeFakeDb();
    vi.mocked(getDb).mockReturnValue(t.fake as unknown as Db);
    const original = identity('call-id-collision', 'credit', 100n);
    expect((await settleCasinoCallback(original)).error).toBe(0);
    expect(await settleCasinoCallback(identity('call-id-collision', 'credit', 1000n)))
      .toEqual({ error: 2, balance: 0 });
    expect(t.postings).toHaveLength(1);
  });
});
