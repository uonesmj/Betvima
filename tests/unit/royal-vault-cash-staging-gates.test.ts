import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Db } from '@/lib/ports/db';
import {
  originalsStagingDatabaseReady,
  settleRoyalVaultStagingRound,
  validateStagingRoyalInput,
} from '@/server/originals/royal-vault-cash-staging';

const userId = '20d3d3d3-3e44-4d44-9444-123456789012';
const requestId = '49a58a23-4a95-49a5-bc11-123456789012';
const input = { userId, clientRequestId: requestId, stakeMinor: 10n, verifiedGeoCountry: 'DE' };
function mockDb(kind: Db['kind'] = 'postgres', ready = true): Db {
  return {
    kind,
    queryOne: vi.fn(async () => ({
      db_name: 'betvima_originals_staging_qa', ready,
    })),
  } as unknown as Db;
}

describe('Royal Vault CASH staging hard gates', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('rejects malformed ids, stakes and geo claims before any DB access', () => {
    expect(() => validateStagingRoyalInput(input)).not.toThrow();
    expect(() => validateStagingRoyalInput({ ...input, userId: 'someone' })).toThrow();
    expect(() => validateStagingRoyalInput({ ...input, clientRequestId: 'same id' })).toThrow();
    expect(() => validateStagingRoyalInput({ ...input, stakeMinor: 7n })).toThrow();
    expect(() => validateStagingRoyalInput({ ...input, stakeMinor: 2005n })).toThrow();
    expect(() => validateStagingRoyalInput({ ...input, verifiedGeoCountry: 'XX1' })).toThrow();
  });

  it('rejects any cash use when staging environment is unset', async () => {
    vi.stubEnv('BETVIMA_ORIGINALS_FINANCIAL_STAGE', '');
    vi.stubEnv('BETVIMA_ORIGINALS_LICENSE_REVIEW_COMPLETE', '');
    expect(await originalsStagingDatabaseReady(mockDb())).toBe(false);
    await expect(settleRoyalVaultStagingRound(mockDb(), input))
      .rejects.toThrow('ORIGINALS_STAGE_PLAYER_NOT_ALLOWED');
  });

  it('always refuses Supabase/production driver even if all staging flags are set', async () => {
    vi.stubEnv('BETVIMA_ORIGINALS_FINANCIAL_STAGE', 'isolated-staging-only');
    vi.stubEnv('BETVIMA_ORIGINALS_LICENSE_REVIEW_COMPLETE', 'true');
    vi.stubEnv('BETVIMA_ORIGINALS_STAGING_DB_NAME', 'betvima_originals_staging_qa');
    expect(await originalsStagingDatabaseReady(mockDb('supabase'))).toBe(false);
  });

  it('rejects a wrong database identity and missing schema readiness', async () => {
    vi.stubEnv('BETVIMA_ORIGINALS_FINANCIAL_STAGE', 'isolated-staging-only');
    vi.stubEnv('BETVIMA_ORIGINALS_LICENSE_REVIEW_COMPLETE', 'true');
    vi.stubEnv('BETVIMA_ORIGINALS_STAGING_DB_NAME', 'betvima_originals_staging_other');
    expect(await originalsStagingDatabaseReady(mockDb('postgres',true))).toBe(false);
    vi.stubEnv('BETVIMA_ORIGINALS_STAGING_DB_NAME', 'betvima_originals_staging_qa');
    expect(await originalsStagingDatabaseReady(mockDb('postgres',false))).toBe(false);
  });

  it('keeps staging operations locked to one allowlisted player and country', async () => {
    vi.stubEnv('BETVIMA_ORIGINALS_FINANCIAL_STAGE', 'isolated-staging-only');
    vi.stubEnv('BETVIMA_ORIGINALS_LICENSE_REVIEW_COMPLETE', 'true');
    vi.stubEnv('BETVIMA_ORIGINALS_STAGING_DB_NAME', 'betvima_originals_staging_qa');
    vi.stubEnv('BETVIMA_ORIGINALS_PILOT_USER_ID', userId);
    vi.stubEnv('BETVIMA_ORIGINALS_ALLOWED_COUNTRIES', 'DE');
    const db = mockDb();
    await expect(settleRoyalVaultStagingRound(db, {
      ...input, verifiedGeoCountry:'TR',
    })).rejects.toThrow('ORIGINALS_STAGE_COUNTRY_NOT_ALLOWED');
    await expect(settleRoyalVaultStagingRound(db, {
      ...input, userId:'20d3d3d3-3e44-4d44-9444-123456789013',
    })).rejects.toThrow('ORIGINALS_STAGE_PLAYER_NOT_ALLOWED');
    expect(await originalsStagingDatabaseReady(db)).toBe(true);
    expect((db.queryOne as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1);
  });

  it('accepts no fake DB if staging DB identity query errors', async () => {
    vi.stubEnv('BETVIMA_ORIGINALS_FINANCIAL_STAGE', 'isolated-staging-only');
    vi.stubEnv('BETVIMA_ORIGINALS_LICENSE_REVIEW_COMPLETE', 'true');
    vi.stubEnv('BETVIMA_ORIGINALS_STAGING_DB_NAME', 'betvima_originals_staging_qa');
    const db = { kind:'postgres', queryOne: async () => { throw new Error('offline'); } } as unknown as Db;
    expect(await originalsStagingDatabaseReady(db)).toBe(false);
  });
});
