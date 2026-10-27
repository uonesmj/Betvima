import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CASINO_PRE_KYC_LIFETIME_STAKE_USD_MINOR,
  casinoPreKycAllowsDebit,
  casinoPreKycPermitted,
  casinoPreKycRemaining,
} from '../../src/server/providers/softaggregator/pre-kyc';

afterEach(() => vi.unstubAllEnvs());

function allowAuthorizedPilot() {
  vi.stubEnv('SOFTAGGREGATOR_ALLOWED_COUNTRIES', 'GB');
  vi.stubEnv('SOFTAGGREGATOR_PRE_KYC_ALLOWED_COUNTRIES', 'GB');
  vi.stubEnv('SOFTAGGREGATOR_PRE_KYC_ENABLED', 'true');
  vi.stubEnv('SOFTAGGREGATOR_PRE_KYC_LEGAL_APPROVAL', 'true');
}

const freshProfile = { kyc_status: 'not_started', country: 'GB' };

describe('one-dollar lifetime casino pre-KYC policy (staged only)', () => {
  it('sets a strict 100-cent total turnover cap, not per-spin, balance or losses', () => {
    expect(CASINO_PRE_KYC_LIFETIME_STAKE_USD_MINOR).toBe(100n);
  });

  it('is fail-closed without an independent legal approval gate', () => {
    vi.stubEnv('SOFTAGGREGATOR_ALLOWED_COUNTRIES', 'GB');
    vi.stubEnv('SOFTAGGREGATOR_PRE_KYC_ALLOWED_COUNTRIES', 'GB');
    vi.stubEnv('SOFTAGGREGATOR_PRE_KYC_ENABLED', 'true');
    expect(casinoPreKycPermitted(freshProfile)).toBe(false);
    vi.stubEnv('SOFTAGGREGATOR_PRE_KYC_LEGAL_APPROVAL', 'true');
    expect(casinoPreKycPermitted(freshProfile)).toBe(true);
  });

  it('denies jurisdictions absent from either explicit allowlist', () => {
    allowAuthorizedPilot();
    expect(casinoPreKycPermitted({ ...freshProfile, country: 'US' })).toBe(false);
    expect(casinoPreKycPermitted({ ...freshProfile, country: null })).toBe(false);
    vi.stubEnv('SOFTAGGREGATOR_PRE_KYC_ALLOWED_COUNTRIES', '');
    expect(casinoPreKycPermitted(freshProfile)).toBe(false);
  });

  it('rejects previously rejected or expired identity applications', () => {
    allowAuthorizedPilot();
    expect(casinoPreKycPermitted({ ...freshProfile, kyc_status: 'rejected' })).toBe(false);
    expect(casinoPreKycPermitted({ ...freshProfile, kyc_status: 'expired' })).toBe(false);
  });

  it('sums successful original debit receipts and ignores wins/refunds for cap replenishment', async () => {
    allowAuthorizedPilot();
    const queryOne = vi.fn(async (sql: string) => {
      expect(sql).toContain("action='debit'");
      expect(sql).toContain('rollback=false');
      expect(sql).toContain('response_error=0');
      expect(sql).not.toContain('game_id=');
      return { total_minor: '90' };
    });
    const db = { queryOne } as never;
    expect(await casinoPreKycRemaining(db, 'user-test')).toBe(10n);
    expect(await casinoPreKycAllowsDebit(db, 'user-test', freshProfile, 10n)).toBe(true);
    expect(await casinoPreKycAllowsDebit(db, 'user-test', freshProfile, 11n)).toBe(false);
    expect(await casinoPreKycAllowsDebit(db, 'user-test', freshProfile, 0n)).toBe(false);
  });

  it('blocks new debits when historic stake total already reached the cap', async () => {
    allowAuthorizedPilot();
    const db = { queryOne: async () => ({ total_minor: '100' }) } as never;
    expect(await casinoPreKycRemaining(db, 'user-test')).toBe(0n);
    expect(await casinoPreKycAllowsDebit(db, 'user-test', freshProfile, 1n)).toBe(false);
  });

  it('refuses wager if database cannot read lifetime receipts', async () => {
    allowAuthorizedPilot();
    const db = { queryOne: async () => null } as never;
    await expect(casinoPreKycAllowsDebit(db, 'user-test', freshProfile, 1n))
      .rejects.toThrow('CASINO_PRE_KYC_USAGE_UNAVAILABLE');
  });
});
