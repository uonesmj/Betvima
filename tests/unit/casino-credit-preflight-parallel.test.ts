import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Db } from '@/lib/ports/db';
import type { SignedCallback } from '@/server/providers/softaggregator/contract';

const state = vi.hoisted(() => ({
  db: null as unknown,
  ready: Promise.resolve(true) as Promise<boolean>,
  schemaStarts: 0,
  bindingStarts: 0,
  roundStarts: 0,
}));

vi.mock('@/server/db', () => ({ getDb: () => state.db }));
vi.mock('@/server/providers/softaggregator/client', () => ({
  casinoRealMoneyUserAllowed: () => true,
}));
vi.mock('@/server/providers/softaggregator/financial-readiness', () => ({
  casinoFinancialSchemaReady: () => {
    state.schemaStarts++;
    return state.ready;
  },
}));
vi.mock('@/server/providers/softaggregator/player-wallet-binding', () => ({
  readCasinoPlayerWallet: async () => {
    state.bindingStarts++;
    return 'USD';
  },
  bindCasinoPlayerWallet: vi.fn(),
}));

import { settleCasinoCallback } from '@/server/providers/softaggregator/wallet';

const userId = '75d8396e-5277-42ca-ae4b-871036a9cc4f';
function event(action: 'debit' | 'credit', rollback = false): SignedCallback {
  return {
    action,
    username: 'bv_' + userId.replaceAll('-', ''),
    currency: 'USD',
    callId: 'signed-credit-preflight',
    amountMinor: 10n,
    roundId: 'test-round',
    gameId: 'test-game',
    identityHash: 'test-identity',
    rollback,
  };
}

describe('safe concurrent read-only preflight for Debit/Credit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.schemaStarts = 0;
    state.bindingStarts = 0;
    state.roundStarts = 0;
    state.ready = Promise.resolve(true);
    state.db = {
      queryOne: vi.fn(async (sql: string) => {
        if (sql.includes('nova.softaggregator_round_fx')) {
          state.roundStarts++;
          return null;
        }
        throw new Error('Unexpected DB query: ' + sql);
      }),
      transaction: vi.fn(async () => ({ error: 0, balance: 123 })),
    } as unknown as Db;
  });

  afterEach(() => vi.unstubAllEnvs());

  it.each(['debit', 'credit'] as const)(
    'starts binding and round reads before schema readiness resolves for ordinary %s',
    async action => {
      let release: (ready: boolean) => void = () => {};
      state.ready = new Promise<boolean>(resolve => { release = resolve; });
      const task = settleCasinoCallback(event(action));
      await Promise.resolve();
      await Promise.resolve();

      expect(state.schemaStarts).toBe(1);
      expect(state.bindingStarts).toBe(1);
      expect(state.roundStarts).toBe(1);
      expect(vi.mocked((state.db as Db).transaction)).not.toHaveBeenCalled();

      release(true);
      expect(await task).toEqual({ error: 0, balance: 123 });
      expect(vi.mocked((state.db as Db).transaction)).toHaveBeenCalledOnce();
    },
  );

  it('does not write if the readiness gate fails after parallel read-only checks', async () => {
    state.ready = Promise.resolve(false);
    expect(await settleCasinoCallback(event('credit')))
      .toEqual({ error: 2, balance: 0 });
    expect(vi.mocked((state.db as Db).transaction)).not.toHaveBeenCalled();
  });

  it('retains sequential safety checks for a rollback', async () => {
    let release: (ready: boolean) => void = () => {};
    state.ready = new Promise<boolean>(resolve => { release = resolve; });
    const task = settleCasinoCallback(event('credit', true));
    await Promise.resolve();
    expect(state.bindingStarts).toBe(0);
    expect(state.roundStarts).toBe(0);
    release(true);
    expect(await task).toEqual({ error: 0, balance: 123 });
  });
});
