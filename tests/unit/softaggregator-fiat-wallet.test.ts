import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Db } from '@/lib/ports/db';
import { getUsdIrtRate } from '@/server/providers/arzhaam/client';
import { fiatCasinoBalance as providerBalance, settleFiatCasinoCallback as providerSettle } from '@/server/providers/softaggregator/fiat-wallet';
import type { SignedCallback } from '@/server/providers/softaggregator/contract';

vi.mock('@/server/providers/arzhaam/client', () => ({ getUsdIrtRate: vi.fn() }));
const userId = '16d08a54-4223-484d-aaf8-0055bc1e57e1';
const username = 'bv_' + userId.replace(/-/g, '');
const nativeCurrencies = new WeakMap<Db, 'IRT' | 'IRR'>();
const fiatCasinoBalance = (db: Db, uid: string) =>
  providerBalance(db, uid, nativeCurrencies.get(db)!);
const settleFiatCasinoCallback = (db: Db, uid: string, event: SignedCallback) =>
  providerSettle(db, uid, event, nativeCurrencies.get(db)!);

function fakeDb(walletCurrency: 'IRT' | 'IRR' = 'IRT', original = 2_500_000n) {
  let balance = original;
  let preferred: string = walletCurrency;
  let kycStatus = 'verified';
  let documentApproved = true;
  let country = 'DE';
  const perCurrencyStakeLimit = new Map<string, bigint>();
  const posted: Array<Record<string, unknown>> = [];
  const entries = new Map<string, Record<string, unknown>>();
  const receipts = new Map<string, Record<string, unknown>>();
  const rounds = new Map<string, Record<string, unknown>>();
  const db = {
    queryOne: vi.fn(async (sql: string, args: unknown[] = []) => {
      if (sql.includes('from nova.profiles p')) return {
        status: 'active', age_verified: true, kyc_status: kycStatus,
        kyc_document_approved: documentApproved,
        currency: preferred, country,
        restricted: false, self_excluded: false,
        max_stake_per_bet_minor: perCurrencyStakeLimit.get(String(args[1] ?? preferred))?.toString() ?? null,
        max_stake_per_day_minor: null,
        loss_limit_daily_minor: null, loss_limit_weekly_minor: null,
      };
      if (sql.includes('from nova.wallets')) {
        return { balance_minor: String(balance), locked_minor: '0', is_frozen: false };
      }
      if (sql.includes('from nova.wallet_transactions')) {
        return { day_stake: '0', day_loss: '0', week_loss: '0' };
      }
      if (sql.includes('from nova.softaggregator_round_fx')) {
        return rounds.get(String(args[1]) + ':' + String(args[2])) ?? null;
      }
      if (sql.includes('from nova.softaggregator_callback_receipts r')) {
        for (const [key, receipt] of receipts) {
          if (receipt.action === (sql.includes("r.action='credit'") ? 'credit' : 'debit') &&
            receipt.response_error === 0 &&
            receipt.round_id === args[1] && receipt.game_id === args[2] &&
            receipt.amount_minor === args[3] && !receipt.reversed) {
            return { call_id: key, wallet_amount_minor: receipt.wallet_amount_minor };
          }
        }
        return null;
      }
      if (sql.includes('from nova.softaggregator_callback_receipts')) {
        return receipts.get(String(args[0])) ?? null;
      }
      throw new Error('UNEXPECTED_SQL_QUERY: ' + sql);
    }),
    query: vi.fn(async (sql: string, args: unknown[] = []) => {
      if (sql.includes('insert into nova.softaggregator_round_fx')) {
        rounds.set(String(args[1]) + ':' + String(args[2]), {
          wallet_currency: args[3], rate_irt_per_usd: args[4], rate_observed_at: args[5],
        });
      }
      if (sql.includes('insert into nova.softaggregator_callback_receipts')) {
        const receipt = {
          identity_hash: args[1], response_error: args[5],
          response_balance_minor: args[6], wallet_amount_minor: args[9],
          action: args[3], amount_minor: args[4],
          round_id: args[10], game_id: args[11], reversed: false,
        };
        receipts.set(String(args[0]), receipt);
        for (const key of [args[13], args[14]]) {
          if (key) {
            const original = receipts.get(String(key));
            if (original) original.reversed = true;
          }
        }
      }
      return [];
    }),
    rpc: vi.fn(async (_function: string, args: Record<string, unknown>) => {
      posted.push(args);
      balance += BigInt(String(args.p_amount_minor));
      const id = String(posted.length);
      entries.set(id, args);
      return { transaction_id: id, balance_after_minor: String(balance) };
    }),
    transaction: async (cb: (db: Db) => Promise<unknown>) => cb(db as unknown as Db),
  };
  nativeCurrencies.set(db as unknown as Db, walletCurrency);
  return { db: db as unknown as Db, posted, receipts, getBalance: () => balance,
    setPreferredCurrency: (currency: string) => { preferred = currency; },
    setKycStatus: (status: string) => { kycStatus = status; },
    setDocumentApproved: (value: boolean) => { documentApproved = value; },
    setCountry: (value: string) => { country = value; },
    setStakeLimit: (currency: string, minor: bigint) => { perCurrencyStakeLimit.set(currency, minor); } };
}

function event(id: string, action: 'debit' | 'credit', amountMinor: bigint, rollback = false): SignedCallback {
  return {
    action, username, currency: 'USD', callId: id, amountMinor,
    gameId: 'aviator', roundId: 'round-1', rollback,
    identityHash: [id, action, String(amountMinor), String(rollback)].join(':'),
  };
}

describe('Casino fiat settle staging contract', () => {
  afterEach(() => vi.unstubAllEnvs());
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('SOFTAGGREGATOR_ALLOWED_COUNTRIES', 'DE');
    vi.mocked(getUsdIrtRate).mockResolvedValue({
      value: '250000.00000000', timestamp: new Date().toISOString(),
    });
  });

  it('quotes existing IRT wallet as USD without changing funds', async () => {
    const t = fakeDb('IRT');
    expect(await fiatCasinoBalance(t.db, userId)).toEqual({ error: 0, balance: 1000 });
    expect(t.getBalance()).toBe(2_500_000n);
    expect(t.posted).toHaveLength(0);
  });

  it('blocks IRT and IRR wagers until KYC is verified', async () => {
    for (const currency of ['IRT', 'IRR'] as const) {
      const t = fakeDb(currency, currency === 'IRR' ? 25_000_000n : 2_500_000n);
      t.setKycStatus('pending');
      expect((await fiatCasinoBalance(t.db, userId)).error).toBe(2);
      expect((await settleFiatCasinoCallback(t.db, userId, event('kyc-denied', 'debit', 20n))).error).toBe(1);
      expect(t.posted).toHaveLength(0);
      t.setKycStatus('verified');
      expect((await settleFiatCasinoCallback(t.db, userId, event('kyc-approved', 'debit', 20n))).error).toBe(0);
      expect(t.posted).toHaveLength(1);
    }
  });

  it('rejects flag-only KYC without operator-reviewed identity documents for fiat wager', async () => {
    const t = fakeDb();
    t.setDocumentApproved(false);
    expect((await settleFiatCasinoCallback(t.db, userId, event('no-document', 'debit', 20n))).error).toBe(1);
    expect(t.posted).toHaveLength(0);
  });

  it('refuses a fiat casino debit outside configured countries', async () => {
    const t = fakeDb();
    t.setCountry('FR');
    const result = await settleFiatCasinoCallback(t.db, userId, event('wrong-market', 'debit', 20n));
    expect(result.error).toBe(1);
    expect(t.posted).toHaveLength(0);
  });

  it('makes a USD bet, credits a USD win, preserves IRT ledger and duplicate safety', async () => {
    const t = fakeDb('IRT');
    const debit = event('bet-one', 'debit', 20n);
    expect(await settleFiatCasinoCallback(t.db, userId, debit)).toEqual({ error: 0, balance: 980 });
    expect(t.posted[0]?.p_currency).toBe('IRT');
    expect(t.posted[0]?.p_amount_minor).toBe('-50000');
    expect(await settleFiatCasinoCallback(t.db, userId, debit)).toEqual({ error: 0, balance: 980 });
    expect(t.posted).toHaveLength(1);
    const credit = event('win-one', 'credit', 40n);
    expect(await settleFiatCasinoCallback(t.db, userId, credit)).toEqual({ error: 0, balance: 1020 });
    expect(t.posted[1]?.p_amount_minor).toBe('100000');
    expect(t.getBalance()).toBe(2_550_000n);
  });

  it('keeps the original IRT round currency after preferred account switches', async () => {
    const t = fakeDb('IRT');
    expect((await settleFiatCasinoCallback(t.db, userId, event('local-debit', 'debit', 20n))).error).toBe(0);
    t.setPreferredCurrency('USD');
    expect((await settleFiatCasinoCallback(t.db, userId, event('local-win', 'credit', 40n))).error).toBe(0);
    expect(t.posted.every((p) => p.p_currency === 'IRT')).toBe(true);
  });

  it('keeps IRT wager limits after a mid-round preference switch to USD', async () => {
    const t = fakeDb('IRT');
    expect((await settleFiatCasinoCallback(t.db, userId, event('limit-stake-1', 'debit', 20n))).error).toBe(0);
    t.setStakeLimit('IRT', 40_000n);
    t.setPreferredCurrency('USD');
    const blocked = await settleFiatCasinoCallback(t.db, userId, event('limit-stake-2', 'debit', 20n));
    expect(blocked.error).toBe(1);
    expect(t.posted).toHaveLength(1);
  });

  it('refunds the exact original IRT amount and refuses a duplicate rollback', async () => {
    const t = fakeDb('IRT');
    const debit = event('bet-two', 'debit', 20n);
    expect((await settleFiatCasinoCallback(t.db, userId, debit)).error).toBe(0);
    vi.mocked(getUsdIrtRate).mockResolvedValue({
      value: '300000.00000000', timestamp: new Date().toISOString(),
    });
    expect((await settleFiatCasinoCallback(t.db, userId, event('refund-one', 'credit', 20n, true))).error).toBe(0);
    expect(t.posted[1]?.p_amount_minor).toBe('50000');
    expect(t.getBalance()).toBe(2_500_000n);
    expect((await settleFiatCasinoCallback(t.db, userId, event('refund-two', 'credit', 20n, true))).error).toBe(2);
  });

  it('reverses a credited win at exact historic IRT value and rejects double reversal', async () => {
    const t = fakeDb('IRT');
    expect((await settleFiatCasinoCallback(t.db, userId, event('win-credit', 'credit', 40n))).error).toBe(0);
    vi.mocked(getUsdIrtRate).mockResolvedValue({
      value: '350000.00000000', timestamp: new Date().toISOString(),
    });
    const rollback = event('win-reversal-1', 'debit', 40n, true);
    expect((await settleFiatCasinoCallback(t.db, userId, rollback)).error).toBe(0);
    expect(t.posted[1]?.p_type).toBe('reversal');
    expect(t.posted[1]?.p_amount_minor).toBe('-100000');
    expect(t.getBalance()).toBe(2_500_000n);
    expect((await settleFiatCasinoCallback(t.db, userId, event('win-reversal-2', 'debit', 40n, true))).error).toBe(2);
    expect(t.posted).toHaveLength(2);
  });

  it('denies wagers with insufficient available funds or under 10 USD cents', async () => {
    const t = fakeDb('IRR', 1000n);
    expect((await settleFiatCasinoCallback(t.db, userId, event('too-small', 'debit', 9n))).error).toBe(1);
    expect((await settleFiatCasinoCallback(t.db, userId, event('no-funds', 'debit', 200n))).error).toBe(1);
    expect(t.posted).toHaveLength(0);
  });

  it('debits exactly the native value of the USD 0.10 minimum for IRT and IRR', async () => {
    for (const [currency, initial, debited] of [
      ['IRT', 2_500_000n, '-25000'],
      ['IRR', 25_000_000n, '-250000'],
    ] as const) {
      const t = fakeDb(currency, initial);
      expect((await settleFiatCasinoCallback(t.db, userId,
        event('ten-cent-' + currency, 'debit', 10n))).error).toBe(0);
      expect(t.posted).toHaveLength(1);
      expect(t.posted[0]?.p_amount_minor).toBe(debited);
    }
  });

  it('rejects missing round IDs before making any ledger change', async () => {
    const t = fakeDb();
    expect(await settleFiatCasinoCallback(t.db, userId, { ...event('missing-round', 'debit', 50n), roundId: null }))
      .toEqual({ error: 2, balance: 0 });
    expect(t.posted).toHaveLength(0);
  });
  it('counts casino win reversals in IRT and IRR daily and weekly net-loss limits', async () => {
    for (const currency of ['IRT', 'IRR'] as const) {
      const scenario = fakeDb(currency);
      const result = await settleFiatCasinoCallback(scenario.db, userId,
        event('loss-limit-reversal-' + currency, 'debit', 20n));
      expect(result.error).toBe(0);
      const usageQuery = vi.mocked(scenario.db.queryOne).mock.calls
        .map((call) => String(call[0]))
        .find((sql) => sql.includes('from nova.wallet_transactions'));
      expect(usageQuery).toBeDefined();
      expect(usageQuery).toContain("type='reversal' and reference like 'softaggregator:%'");
      expect(usageQuery).toContain('as day_loss');
      expect(usageQuery).toContain('as week_loss');
    }
  });

});
