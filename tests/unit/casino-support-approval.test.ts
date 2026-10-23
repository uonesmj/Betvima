import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDb } from '@/server/db';
import { casinoSupportApproved } from '@/server/kyc/casino-support';
import type { Db } from '@/lib/ports/db';

vi.mock('@/server/db', () => ({ getDb: vi.fn() }));
const id = '11111111-1111-4111-8111-111111111111';

describe('Support-reviewed casino approval (independent of document KYC)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('permits an existing staff-approved account only', async () => {
    const db = { queryOne: vi.fn().mockResolvedValue({ approved: true }) } as unknown as Db;
    vi.mocked(getDb).mockReturnValue(db);
    expect(await casinoSupportApproved(id)).toBe(true);
    const sql = vi.mocked(db.queryOne).mock.calls[0]?.[0] ?? '';
    expect(sql).toContain('nova.casino_support_approvals');
    expect(sql).toContain("ca.status='approved'");
    expect(sql).toContain('ca.legal_age_confirmed=true');
    expect(sql).toContain('ca.reviewed_by is not null');
    expect(sql).toContain("p.status='active'");
    expect(sql).not.toContain('nova.kyc_submissions');
  });

  it('fails closed on revocation, missing migration, inactive or missing account', async () => {
    const db = { queryOne: vi.fn().mockResolvedValue({ approved: false }) } as unknown as Db;
    expect(await casinoSupportApproved(id, db)).toBe(false);
    vi.mocked(db.queryOne).mockResolvedValueOnce(null);
    expect(await casinoSupportApproved(id, db)).toBe(false);
    vi.mocked(db.queryOne).mockRejectedValueOnce(new Error('DB_UNAVAILABLE'));
    expect(await casinoSupportApproved(id, db)).toBe(false);
  });
});
