import { NextResponse } from 'next/server';
import { withErrorHandling } from '@/lib/errors';
import { withAdmin } from '@/server/http/guard';
import { intParam, searchParams } from '@/server/http/request';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Dedicated, newest-first review queue. No identity images or storage paths
 * are ever sent to the list UI. Existing verified accounts remain untouched.
 */
export const GET = withErrorHandling('admin.casino_approvals.list', async (ctx, request: Request) => {
  const { services } = await withAdmin(request, ctx, 'users.kyc');
  const params = searchParams(request);
  const page = intParam(params, 'page', 1, 5000);
  const pageSize = intParam(params, 'pageSize', 25, 50);
  const rows = await services.db.query<{
    id: string; public_id: string; email: string | null; phone: string | null;
    status: string; kyc_status: string; age_verified: boolean;
    reviewed_document: boolean; created_at: string;
  }>(
    "select p.id,p.public_id,p.email,p.phone,p.status::text,p.kyc_status::text," +
    "p.age_verified,p.created_at::text," +
    "exists(select 1 from nova.kyc_submissions k where k.user_id=p.id " +
    "and k.status='verified' and k.legal_age_confirmed=true and k.reviewed_by is not null) as reviewed_document " +
    "from nova.profiles p where p.role::text in ('user','affiliate') " +
    "order by p.created_at desc,p.id desc limit $1 offset $2",
    [pageSize, (page - 1) * pageSize],
  );
  const count = await services.db.queryOne<{ total: string }>(
    "select count(*)::text as total from nova.profiles where role::text in ('user','affiliate')",
  );
  return NextResponse.json({ ok: true, data: {
    page, pageSize, total: Number(count?.total ?? 0),
    items: rows.map((r) => ({
      id: r.id, publicId: r.public_id, email: r.email, phone: r.phone,
      status: r.status, kycStatus: r.kyc_status, registeredAt: r.created_at,
      casinoIdentityApproved: r.status === 'active' && r.kyc_status === 'verified' &&
        r.age_verified === true && r.reviewed_document === true,
    })),
  } }, { headers: { 'Cache-Control': 'private, no-store' } });
});
