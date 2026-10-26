import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ db: null as unknown }));

vi.mock('@/server/db', () => ({ getDb: () => state.db }));
vi.mock('@/server/providers/softaggregator/client', () => ({
  casinoRealMoneyUserAllowed: () => true,
}));
vi.mock('@/server/providers/softaggregator/financial-readiness', () => ({
  casinoFinancialSchemaReady: async () => true,
}));
vi.mock('@/server/providers/softaggregator/player-wallet-binding', () => ({
  readCasinoPlayerWallet: async () => 'USD',
  bindCasinoPlayerWallet: vi.fn(),
}));

import { PostgresDb } from '../../src/server/db/postgres';
import { settleCasinoCallback } from '../../src/server/providers/softaggregator/wallet';
import { settleFiatCasinoCallback } from '../../src/server/providers/softaggregator/fiat-wallet';
import type { SignedCallback } from '../../src/server/providers/softaggregator/contract';

const uuid = '75d8396e-5277-42ca-ae4b-871036a9cc4f';
const username = 'bv_' + uuid.replaceAll('-', '');
const event = (
  action: 'balance' | 'debit' | 'credit',
  rollback = false,
): SignedCallback => ({
  action,
  username,
  currency: 'USD',
  callId: action === 'balance' ? null : 'test-call-id',
  amountMinor: action === 'balance' ? null : 10n,
  roundId: action === 'balance' ? null : 'test-round',
  gameId: action === 'balance' ? null : 'test-game',
  rollback,
  identityHash: action === 'balance' ? null : 'test-hash',
});

describe('signed casino callback transaction routing', () => {
  let db: PostgresDb;
  let fast: ReturnType<typeof vi.spyOn>;
  let regular: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    db = new PostgresDb({ connectionString: 'postgres://fake' });
    state.db = db;
    vi.spyOn(db, 'queryOne').mockResolvedValue(null);
    fast = vi.spyOn(db, 'transactionForCasinoCallback')
      .mockResolvedValue({ error: 0, balance: 123 });
    regular = vi.spyOn(db, 'transaction')
      .mockResolvedValue({ error: 0, balance: 123 });
  });

  it.each(['debit', 'credit'] as const)(
    'uses the optimized transaction only for normal USD %s',
    async action => {
      expect(await settleCasinoCallback(event(action))).toEqual({ error: 0, balance: 123 });
      expect(fast).toHaveBeenCalledOnce();
      expect(regular).not.toHaveBeenCalled();
    },
  );

  it.each(['debit', 'credit'] as const)(
    'keeps original transaction for rollback USD %s',
    async action => {
      expect(await settleCasinoCallback(event(action, true))).toEqual({ error: 0, balance: 123 });
      expect(regular).toHaveBeenCalledOnce();
      expect(fast).not.toHaveBeenCalled();
    },
  );

  it('does not start a transaction for a rejected balance callback', async () => {
    expect(await settleCasinoCallback(event('balance'))).toEqual({ error: 2, balance: 0 });
    expect(regular).not.toHaveBeenCalled();
    expect(fast).not.toHaveBeenCalled();
  });

  it.each(['debit', 'credit'] as const)(
    'uses transport-only optimization for ordinary fiat %s without changing rate or wallet resolution',
    async action => {
      vi.spyOn(db, 'queryOne').mockResolvedValue({
        wallet_currency: 'IRR', rate_irt_per_usd: '100000', rate_observed_at: new Date().toISOString(),
      });
      expect(await settleFiatCasinoCallback(db, uuid, event(action), 'IRR'))
        .toEqual({ error: 0, balance: 123 });
      expect(fast).toHaveBeenCalledOnce();
      expect(regular).not.toHaveBeenCalled();
    },
  );

  it('preserves the existing fiat rollback transaction route', async () => {
    vi.spyOn(db, 'queryOne').mockResolvedValue({
      wallet_currency: 'IRR', rate_irt_per_usd: '100000', rate_observed_at: new Date().toISOString(),
    });
    expect(await settleFiatCasinoCallback(db, uuid, event('credit', true), 'IRR'))
      .toEqual({ error: 0, balance: 123 });
    expect(regular).toHaveBeenCalledOnce();
    expect(fast).not.toHaveBeenCalled();
  });
});
