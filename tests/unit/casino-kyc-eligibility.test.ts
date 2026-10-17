import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDb } from '@/server/db';
import { casinoIdentityApproved } from '@/server/kyc/eligibility';
import type { Db } from '@/lib/ports/db';

vi.mock('@/server/db', () => ({ getDb: vi.fn() }));
const status = (patch: Record<string, unknown> = {}) => ({
  status: 'active', age_verified: true, kyc_status: 'verified', reviewed: true, ...patch,
});
const id = '11111111-1111-4111-8111-111111111111';

describe('casino identity gate', () => {
  beforeEach(() => vi.clearAllMocks());
  it.each([
    ['approved operator evidence', status(), true],
    ['missing verified file review', status({ reviewed: false }), false],
    ['status-only legacy KYC', status({ reviewed: false, kyc_status: 'verified' }), false],
    ['age not verified', status({ age_verified: false }), false],
    ['suspended customer', status({ status: 'suspended' }), false],
    ['pending review', status({ kyc_status: 'pending' }), false],
  ])('%s => access %s', async (_case, row, expected) => {
    const db = { queryOne: vi.fn().mockResolvedValue(row) } as unknown as Db;
    vi.mocked(getDb).mockReturnValue(db);
    expect(await casinoIdentityApproved(id)).toBe(expected);
    const query = vi.mocked(db.queryOne).mock.calls[0]?.[0] ?? '';
    expect(query).toContain('nova.kyc_submissions');
    expect(query).toContain("k.status='verified'");
    expect(query).toContain('k.reviewed_by is not null');
    expect(query).toContain('k.legal_age_confirmed=true');
  });
  it('denies unknown accounts and fails closed on storage errors', async () => {
    const db = { queryOne: vi.fn().mockResolvedValue(null) } as unknown as Db;
    vi.mocked(getDb).mockReturnValue(db);
    expect(await casinoIdentityApproved(id)).toBe(false);
    vi.mocked(db.queryOne).mockRejectedValueOnce(new Error('database unavailable'));
    await expect(casinoIdentityApproved(id)).rejects.toThrow('database unavailable');
  });
});
