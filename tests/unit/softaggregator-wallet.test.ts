import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
  let preferredCurrency = 'USD';
  let boundCurrency: string | null = 'USD';
  let kycStatus = 'verified';
  let supportApproved = true;
  let country = 'TR';
  let financialSchemaReady = true;
  const receipts = new Map<string, { identity_hash: string; response_error: 0 | 1 | 2; response_balance_minor: string; action: string; wallet_amount_minor: string; round_id: string; game_id: string; amount_minor: string; reversed: boolean }>();
  const postings: Array<Record<string, unknown>> = [];
  const rounds = new Map<string, { wallet_currency: string }>();
  const fake = {
    queryOne: vi.fn(async (sql: string, params: unknown[]) => {
      if (sql.includes("as ready") && sql.includes("sa_unique_reversed_credit")) {
        return { ready: financialSchemaReady };
      }
      if (sql.includes('from nova.softaggregator_player_wallet_bindings')) {
        return boundCurrency === null ? null : { wallet_currency: boundCurrency };
      }
      if (sql.includes('from nova.softaggregator_round_fx')) {
        return rounds.get(String(params[1]) + ':' + String(params[2])) ?? null;
      }
      if (sql.includes('from nova.softaggregator_callback_receipts r')) {
        for (const [callId, receipt] of receipts) {
          if (receipt.action === (sql.includes("r.action='credit'") ? 'credit' : 'debit') &&
              receipt.response_error === 0 &&
              receipt.round_id === params[1] && receipt.game_id === params[2] &&
              receipt.amount_minor === params[3] && !receipt.reversed) {
            return { call_id: callId, wallet_amount_minor: receipt.wallet_amount_minor };
          }
        }
        return null;
      }
      if (sql.includes('from nova.softaggregator_callback_receipts')) {
        return receipts.get(String(params[0])) ?? null;
      }
      if (sql.includes('from nova.profiles p')) {
        return {
          status: 'active', age_verified: true, kyc_status: kycStatus,
          support_approved: supportApproved,
          country, currency: preferredCurrency,
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
      if (sql.includes('insert into nova.softaggregator_round_fx')) {
        rounds.set(String(params[1]) + ':' + String(params[2]), { wallet_currency: 'USD' });
      }
      if (sql.includes('insert into nova.softaggregator_callback_receipts')) {
        receipts.set(String(params[0]), {
          identity_hash: String(params[1]),
          response_error: params[5] as 0 | 1 | 2,
          response_balance_minor: String(params[6]),
          action: String(params[3]), amount_minor: String(params[4]),
          wallet_amount_minor: String(params[9]),
          round_id: String(params[10]), game_id: String(params[11]), reversed: false,
        });
        for (const key of [params[13], params[14]]) {
          if (key) {
            const original = receipts.get(String(key));
            if (original) original.reversed = true;
          }
        }
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
  return { fake, receipts, postings, getBalance: () => balance,
    setPreferredCurrency: (currency: string) => { preferredCurrency = currency; },
    setBinding: (currency: string | null) => { boundCurrency = currency; },
    setKycStatus: (status: string) => { kycStatus = status; },
    setSupportApproved: (value: boolean) => { supportApproved = value; },
    setCountry: (value: string) => { country = value; },
    setSchemaReady: (ready: boolean) => { financialSchemaReady = ready; } };
}

describe('SoftAggregator financial callback behavior (isolated DB contract)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('SOFTAGGREGATOR_ALLOWED_COUNTRIES', 'TR');
  });
  afterEach(() => vi.unstubAllEnvs());

  it('refuses a signed money callback if the audited schema is incomplete', async () => {
    const t = makeFakeDb();
    t.setSchemaReady(false);
    vi.mocked(getDb).mockReturnValue(t.fake as unknown as Db);
    expect(await settleCasinoCallback(identity('missing-schema', 'credit', 100n)))
      .toEqual({ error: 2, balance: 0 });
    expect(t.postings).toHaveLength(0);
    expect(t.receipts.size).toBe(0);
  });

  it('does not use unrelated KYC statuses as casino support approval', async () => {
    for (const status of ['not_started', 'pending', 'rejected', 'expired']) {
      const t = makeFakeDb();
      t.setKycStatus(status);
      vi.mocked(getDb).mockReturnValue(t.fake as unknown as Db);
      const result = await settleCasinoCallback(identity('manual-review-' + status, 'debit', 20n));
      expect(result.error).toBe(0);
      expect(t.postings).toHaveLength(1);
    }
  });

  it('pays a valid earned credit after casino support access is revoked', async () => {
    const t = makeFakeDb();
    t.setSupportApproved(false);
    vi.mocked(getDb).mockReturnValue(t.fake as unknown as Db);
    expect((await settleCasinoCallback(identity('owed-previous-win', 'credit', 200n))).error).toBe(0);
    expect(t.postings[0]?.p_type).toBe('win_credit');
  });

  it('rejects USD wagers until a support reviewer approves the casino account', async () => {
    const t = makeFakeDb();
    t.setSupportApproved(false);
    vi.mocked(getDb).mockReturnValue(t.fake as unknown as Db);
    expect((await settleCasinoCallback(identity('not-reviewed', 'debit', 20n))).error).toBe(1);
    expect(t.postings).toHaveLength(0);
    t.setSupportApproved(true);
    expect((await settleCasinoCallback(identity('now-approved', 'debit', 20n))).error).toBe(0);
  });

  it('denies wagering in a country absent from operator allowlist', async () => {
    const t = makeFakeDb();
    t.setCountry('BR');
    vi.mocked(getDb).mockReturnValue(t.fake as unknown as Db);
    expect((await settleCasinoCallback(identity('unlicensed-country', 'debit', 200n))).error).toBe(1);
    expect(t.postings).toHaveLength(0);
  });

  it('rejects any cash callback before its immutable native wallet is bound', async () => {
    const t = makeFakeDb();
    t.setBinding(null);
    vi.mocked(getDb).mockReturnValue(t.fake as unknown as Db);
    expect(await settleCasinoCallback(identity('no-session-binding', 'debit', 200n)))
      .toEqual({ error: 2, balance: 0 });
    expect(t.postings).toHaveLength(0);
  });

  it('refuses callbacks whose bound wallet conflicts with an existing round', async () => {
    const t = makeFakeDb(1000n, 0n);
    vi.mocked(getDb).mockReturnValue(t.fake as unknown as Db);
    expect((await settleCasinoCallback(identity('first-usd-debit', 'debit', 200n))).error).toBe(0);
    t.setBinding('IRT');
    expect((await settleCasinoCallback(identity('contradicting-credit', 'credit', 250n))).error).toBe(2);
    expect(t.postings).toHaveLength(1);
  });

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

  it('returns original USD debit on a rollback, never twice', async () => {
    const t = makeFakeDb(1000n, 0n);
    vi.mocked(getDb).mockReturnValue(t.fake as unknown as Db);
    expect((await settleCasinoCallback(identity('debit-rollback', 'debit', 200n))).error).toBe(0);
    const refund: SignedCallback = { ...identity('credit-rollback', 'credit', 200n), rollback: true };
    expect(await settleCasinoCallback(refund)).toEqual({ error: 0, balance: 1000 });
    expect(t.postings[1]?.p_type).toBe('bet_refund');
    expect((await settleCasinoCallback({ ...refund, callId: 'credit-rollback-new',
      identityHash: 'credit:credit-rollback-new:200:rollback' })).error).toBe(2);
    expect(t.postings).toHaveLength(2);
  });

  it('settles a USD round to USD even if preferred wallet changes mid-round', async () => {
    const t = makeFakeDb(1000n, 0n);
    vi.mocked(getDb).mockReturnValue(t.fake as unknown as Db);
    expect((await settleCasinoCallback(identity('usd-first', 'debit', 200n))).error).toBe(0);
    t.setPreferredCurrency('IRT');
    expect((await settleCasinoCallback(identity('usd-win', 'credit', 400n))).error).toBe(0);
    expect(t.postings).toHaveLength(2);
    expect(t.postings.every((p) => p.p_currency === 'USD')).toBe(true);
  });

  it('reverses a USD win exactly and refuses repeated reversal', async () => {
    const t = makeFakeDb(1000n, 0n);
    vi.mocked(getDb).mockReturnValue(t.fake as unknown as Db);
    expect((await settleCasinoCallback(identity('win-original', 'credit', 75n))).error).toBe(0);
    const back = { ...identity('win-rollback', 'debit', 75n), rollback: true };
    expect((await settleCasinoCallback(back)).error).toBe(0);
    expect(t.postings[1]?.p_type).toBe('reversal');
    expect(t.postings[1]?.p_amount_minor).toBe('-75');
    expect(t.getBalance()).toBe(1000n);
    expect((await settleCasinoCallback({ ...back, callId: 'win-rollback-2',
      identityHash: 'rollback:win-rollback-2' })).error).toBe(2);
    expect(t.postings).toHaveLength(2);
  });

  it('enforces the 10-cent minimum in USD and accepts exactly 10 cents', async () => {
    const t = makeFakeDb(1000n, 0n);
    vi.mocked(getDb).mockReturnValue(t.fake as unknown as Db);
    expect((await settleCasinoCallback(identity('small-stake', 'debit', 9n))).error).toBe(1);
    expect(t.postings).toHaveLength(0);
    expect(await settleCasinoCallback(identity('ten-cent-stake', 'debit', 10n)))
      .toEqual({ error: 0, balance: 990 });
    expect(t.postings).toHaveLength(1);
    expect(t.postings[0]?.p_amount_minor).toBe('-10');
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
