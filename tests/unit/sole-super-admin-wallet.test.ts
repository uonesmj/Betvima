import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const api = readFileSync('src/app/api/v1/admin/wallet/adjustments/route.ts','utf8');
const guard = readFileSync('supabase/migrations/0220_admin_trusted_profile_update.sql','utf8');

describe('sole super admin audited decisions', () => {
  it('requires the signed-in admin, MFA-backed role and the unique numeric 1010 owner', () => {
    expect(api).toContain("withAdmin(request, ctx, 'wallet.adjust')");
    expect(api).toContain("user.role !== 'super_admin'");
    expect(api).toContain("identity?.numeric_id !== '1010'");
    expect(api).toContain("owner?.count !== '1'");
    expect(api).toContain('owner.id !== user.id');
  });

  it('uses the existing idempotent authoritative wallet ledger, and writes two audit trails', () => {
    expect(api).toContain('idempotencyKeyFrom(request)');
    expect(api).toContain('enforceRateLimit(');
    expect(api).toContain('services.wallet.adminAdjust(');
    expect(api).toContain("action: 'wallet.adjustment_applied_by_sole_super_admin'");
    expect(api).toContain('actorId: user.id');
    expect(api).not.toContain('services.wallet.approveAdminAdjustment(');
    expect(api).not.toContain('DISABLE TRIGGER');
  });

  it('does not post to nonplayer accounts or automatically process pending adjustments', () => {
    expect(api).toContain("['user','affiliate'].includes(target.role)");
    expect(api).toContain("target.status !== 'active'");
    expect(api).not.toContain("update nova.admin_adjustments");
    expect(api).not.toContain("requestAdminAdjustment({");
  });

  it('keeps client-protected profile fields guarded and the affiliate signup exception intact', () => {
    expect(guard).toContain("current_user IN ('postgres', 'service_role')");
    expect(guard).toContain('nova.is_admin()');
    expect(guard).toContain('nova.affiliate_signup');
    expect(guard).toContain("RAISE EXCEPTION 'FORBIDDEN: protected profile fields'");
    expect(guard).not.toContain('DISABLE TRIGGER');
    expect(guard).not.toContain('DROP TRIGGER');
  });
});
