import { describe, expect, it } from 'vitest';
import {
  LIVE_DEBIT_MAX_CALLBACK_MINOR, LIVE_DEBIT_MIN_BET_MINOR,
  liveAccountCanBet, liveNeedsLimitUsage, livePersonalLimitsAllow,
  liveUsdDebitGate, type LiveDebitProfile,
} from '../../supabase/functions/betvima-debit-eu-canary/live-debit-parity';

const profile: LiveDebitProfile = {
  status: 'active', age_verified: true,
  kyc_status: 'verified', kyc_document_approved: true,
  currency: 'USD', self_excluded: false, restricted: false,
  max_stake_per_bet_minor: null, max_stake_per_day_minor: null,
  loss_limit_daily_minor: null, loss_limit_weekly_minor: null,
};
const wallet = { balance_minor: '500', locked_minor: '100', is_frozen: false };
const usage = { day_stake: '0', day_loss: '0', week_loss: '0' };
const baseline = () => liveUsdDebitGate(20n, 'USD', wallet, profile, usage);
const limit = (overrides: Partial<LiveDebitProfile>) => ({ ...profile, ...overrides });

describe('INERT exact 3098 ordinary USD Debit gates (no financial routing)', () => {
  it('keeps running 10c minimum and callback 1e12 ceiling, not an assumed 20c minimum', () => {
    expect(LIVE_DEBIT_MIN_BET_MINOR).toBe(10n);
    expect(LIVE_DEBIT_MAX_CALLBACK_MINOR).toBe(1_000_000_000_000n);
    expect(liveUsdDebitGate(9n, 'USD', wallet, profile, null).error).toBe(1);
    expect(liveUsdDebitGate(10n, 'USD', wallet, profile, usage).error).toBe(0);
  });
  it('returns exact available balance, never total balance, for candidate Debit', () => {
    expect(baseline()).toEqual({ error: 0, balance_minor: 400n, allowed: true });
    expect(liveUsdDebitGate(401n, 'USD', wallet, profile, null))
      .toEqual({ error: 1, balance_minor: 400n, allowed: false });
  });
  it('requires status, age, KYC verified, document approval and no exclusions/restrictions', () => {
    const cases: Partial<LiveDebitProfile>[] = [
      { status: 'suspended' }, { age_verified: false }, { kyc_status: 'pending' },
      { kyc_document_approved: false }, { self_excluded: true },
      { restricted: true },
    ];
    expect(liveAccountCanBet(profile)).toBe(true);
    for (const change of cases) {
      const p = limit(change);
      expect(liveAccountCanBet(p)).toBe(false);
      expect(liveUsdDebitGate(20n, 'USD', wallet, p, null).error).toBe(1);
    }
    expect(liveUsdDebitGate(20n, 'USD', wallet, null, null).error).toBe(1);
  });
  it('refuses a non-USD binding or a profile currency switch', () => {
    expect(liveUsdDebitGate(20n, 'IRT', wallet, profile, null).error).toBe(1);
    expect(liveUsdDebitGate(20n, 'USD', wallet, limit({ currency: 'IRT' }), null).error)
      .toBe(1);
  });
  it('frozen wallet returns 2 with zero (exact live available() semantics)', () => {
    expect(liveUsdDebitGate(
      20n, 'USD', { ...wallet, is_frozen: true }, profile, null,
    )).toEqual({ error: 2, balance_minor: 0n, allowed: false });
  });
  it('enforces immediate per-bet max even when all rolling limits are null', () => {
    const p = limit({ max_stake_per_bet_minor: '30' });
    expect(liveNeedsLimitUsage(p)).toBe(false);
    expect(livePersonalLimitsAllow(30n, p, usage)).toBe(true);
    expect(livePersonalLimitsAllow(31n, p, usage)).toBe(false);
  });
  it('keeps no fixed pilot caps but always requires the mandatory live DB usage read', () => {
    expect(liveNeedsLimitUsage(profile)).toBe(false);
    expect(livePersonalLimitsAllow(101n, profile, usage)).toBe(true);
    // Even with all rolling limits NULL, 3098 queries wallet_transactions;
    // a failed read prevents a new debit.
    expect(livePersonalLimitsAllow(101n, profile, null)).toBe(false);
    expect(liveUsdDebitGate(20n, 'USD', wallet, profile, null).error).toBe(1);
  });
  it('fails closed without wallet transaction usage when any rolling limit is set', () => {
    for (const key of [
      'max_stake_per_day_minor', 'loss_limit_daily_minor', 'loss_limit_weekly_minor',
    ] as const) {
      const p = limit({ [key]: '150' });
      expect(liveNeedsLimitUsage(p)).toBe(true);
      expect(livePersonalLimitsAllow(20n, p, null)).toBe(false);
      expect(liveUsdDebitGate(20n, 'USD', wallet, p, null).error).toBe(1);
    }
  });
  it('enforces daily stake, daily loss, and weekly loss with same bigint accounting', () => {
    const p = limit({
      max_stake_per_day_minor: '150',
      loss_limit_daily_minor: '120',
      loss_limit_weekly_minor: '100',
    });
    expect(livePersonalLimitsAllow(20n, p, {
      day_stake: '130', day_loss: '100', week_loss: '80',
    })).toBe(true);
    for (const change of [
      { day_stake:'131' }, { day_loss:'101' }, { week_loss:'81' },
    ]) {
      expect(livePersonalLimitsAllow(20n, p, {
        day_stake: '130', day_loss: '100', week_loss: '80', ...change,
      })).toBe(false);
    }
  });
  it('refuses malformed account/wallet/limit amounts and negative available balances', () => {
    expect(liveUsdDebitGate(20n,'USD',{...wallet,balance_minor:'bad'},profile,null).error)
      .toBe(2);
    expect(liveUsdDebitGate(20n,'USD',{...wallet,locked_minor:'600'},profile,null).error)
      .toBe(2);
    expect(livePersonalLimitsAllow(20n,limit({max_stake_per_day_minor:'abc'}), {
      day_stake:'2',day_loss:'2',week_loss:'2',
    })).toBe(false);
  });
  it('does not allow zero/negative amount and rejects signed oversize in gate', () => {
    expect(livePersonalLimitsAllow(0n,profile,null)).toBe(false);
    expect(liveUsdDebitGate(0n, 'USD', wallet, profile, usage).error).toBe(1);
    expect(liveUsdDebitGate(LIVE_DEBIT_MAX_CALLBACK_MINOR + 1n, 'USD', wallet, profile, null).error)
      .toBe(1);
  });
});
