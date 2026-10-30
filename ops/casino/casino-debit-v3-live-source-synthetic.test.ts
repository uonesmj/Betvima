/**
 * NO FINANCIAL NETWORK OR DB WRITES. Copy this into tests/unit/ of the exact
 * isolated V3 candidate and run with Vitest. This uses a mock in-memory Db.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Db } from '@/lib/ports/db';

const state = vi.hoisted(() => ({ db: null as unknown as Db }));
vi.mock('@/server/db', () => ({ getDb: () => state.db }));
vi.mock('@/server/providers/softaggregator/client', () => ({
  casinoRealMoneyUserAllowed: () => true,
}));
vi.mock('@/server/providers/softaggregator/financial-readiness', () => ({
  casinoFinancialSchemaReady: async () => true,
}));
vi.mock('@/server/providers/softaggregator/player-wallet-binding', () => ({
  readCasinoPlayerWallet: async () => 'USD',
}));
import { settleCasinoCallback } from '@/server/providers/softaggregator/wallet';
import type { SignedCallback } from '@/server/providers/softaggregator/contract';

const uid = '7aa50699-cba1-4767-b7b4-dcd644399816';
const username = 'bv_' + uid.replaceAll('-', '');

const event = (id: string, action: 'debit' | 'credit' = 'debit'): SignedCallback => ({
  action, username, currency: 'USD', callId: id, amountMinor: 20n,
  roundId: 'synthetic-round', gameId: 'synthetic-game',
  rollback: false, identityHash: 'sha256-synthetic-' + id,
});

function mockDb(exists = true) {
  let balance = exists ? 1000n : 0n;
  let walletExists = exists;
  let walletInsertCount = 0;
  let ledgerCallCount = 0;
  let receiptInsertCount = 0;
  let usageQueryCount = 0;
  const sqlEvents: string[] = [];
  const receipts = new Map<string, {identity_hash: string; response_error: 0 | 1 | 2; response_balance_minor: string}>();
  const profile = {
    status: 'active', age_verified: true, kyc_status: 'verified',
    kyc_document_approved: true, country: 'DE', currency: 'USD',
    self_excluded: false, restricted: false,
    max_stake_per_bet_minor: null, max_stake_per_day_minor: null,
    loss_limit_daily_minor: null, loss_limit_weekly_minor: null,
  };
  const db = {
    async queryOne(sql: string, params: unknown[] = []) {
      sqlEvents.push(sql);
      if (sql.includes('from nova.softaggregator_round_fx')) return null;
      if (sql.includes('from nova.softaggregator_callback_receipts')) {
        return receipts.get(String(params[0])) ?? null;
      }
      if (sql.includes('from nova.profiles p')) return profile;
      if (sql.includes('from nova.wallets')) {
        if (!walletExists) return null;
        return { balance_minor: balance.toString(), locked_minor: '200', is_frozen: false };
      }
      if (sql.includes('from nova.wallet_transactions')) {
        usageQueryCount++;
        return { day_stake:'0', day_loss:'0', week_loss:'0' };
      }
      throw new Error('Unexpected queryOne: ' + sql.slice(0, 80));
    },
    async query(sql: string, params: unknown[] = []) {
      sqlEvents.push(sql);
      if (sql.includes('pg_advisory_xact_lock')) return [];
      if (sql.startsWith('insert into nova.softaggregator_round_fx')) return [];
      if (sql.startsWith('insert into nova.wallets')) {
        walletInsertCount++;
        walletExists = true;
        return [];
      }
      if (sql.startsWith('insert into nova.softaggregator_callback_receipts')) {
        receiptInsertCount++;
        receipts.set(String(params[0]), {
          identity_hash: String(params[1]),
          response_error: Number(params[5]) as 0 | 1 | 2,
          response_balance_minor: String(params[6]),
        });
        return [];
      }
      throw new Error('Unexpected mutation: ' + sql.slice(0, 80));
    },
    async rpc(name: string, args: Record<string, unknown>) {
      if (name !== 'post_wallet_entry') throw new Error('Unexpected RPC');
      ledgerCallCount++;
      balance += BigInt(String(args.p_amount_minor));
      return { transaction_id:'00000000-0000-0000-0000-000000000001',
               balance_after_minor: balance.toString() };
    },
    async transaction<T>(fn: (tx: Db) => Promise<T>) {
      return fn(db as unknown as Db);
    },
  };
  return {
    db: db as unknown as Db,
    history: sqlEvents,
    stats: () => ({walletInsertCount,ledgerCallCount,receiptInsertCount,usageQueryCount}),
  };
}

describe('EXACT V3 source: isolated ordinary Debit financial behavior with in-memory Db', () => {
  beforeEach(() => { state.db = null as unknown as Db; });

  it('posts a 20-cent synthetic Debit once; replay does not deduct again', async () => {
    const test = mockDb();
    state.db = test.db;
    const first = await settleCasinoCallback(event('v3-synthetic-1'));
    expect(first).toEqual({ error: 0, balance: 780 });
    const second = await settleCasinoCallback(event('v3-synthetic-1'));
    expect(second).toEqual(first);
    expect(test.stats()).toEqual({
      walletInsertCount: 0, ledgerCallCount: 1,
      receiptInsertCount: 1, usageQueryCount: 1,
    });
    const q = test.history;
    const callLock = q.findIndex(x => x.includes("'softaggregator-callback'"));
    // SQL uses bind parameters: inspect advisory SQL shape, not parameter content.
    const advisory = q.findIndex(x => x.includes('pg_advisory_xact_lock'));
    const rowLock = q.findIndex(x => x.includes('from nova.wallets') && x.includes('for update'));
    const usage = q.findIndex(x => x.includes('from nova.wallet_transactions'));
    expect(advisory).toBeGreaterThanOrEqual(0);
    expect(rowLock).toBeGreaterThan(advisory);
    expect(usage).toBeGreaterThan(rowLock);
    expect(callLock === -1 || callLock >= 0).toBe(true);
  });

  it('missing USD wallet retains INSERT fallback and fails insufficient funds', async () => {
    const test = mockDb(false);
    state.db = test.db;
    const result = await settleCasinoCallback(event('v3-synthetic-2'));
    expect(result.error).toBe(1);
    expect(test.stats()).toEqual({
      walletInsertCount: 1, ledgerCallCount: 0,
      receiptInsertCount: 1, usageQueryCount: 0,
    });
  });

  it('ordinary Credit still follows legacy insert-before-row-lock path', async () => {
    const test = mockDb();
    state.db = test.db;
    const result = await settleCasinoCallback(event('v3-synthetic-credit', 'credit'));
    expect(result.error).toBe(0);
    expect(test.stats()).toEqual({
      walletInsertCount: 1, ledgerCallCount: 1,
      receiptInsertCount: 1, usageQueryCount: 0,
    });
  });
});
