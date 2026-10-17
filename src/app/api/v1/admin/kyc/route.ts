import { NextResponse } from 'next/server';
import { withErrorHandling } from '@/lib/errors';
import { withAdmin } from '@/server/http/guard';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = withErrorHandling('admin.kyc.list', async (ctx, request: Request) => {
  const { services } = await withAdmin(request, ctx, 'users.kyc');
  const q = new URL(request.url).searchParams;
  const status = ['pending','verified','rejected'].includes(q.get('status') ?? '')
    ? q.get('status') : 'pending';
  const rows = await services.db.query<{
    id: string; user_id: string; email: string | null; public_id: string;
    document_type: string; status: string; created_at: string; reviewed_at: string | null;
  }>(
    'select k.id,k.user_id,p.email,p.public_id,k.document_type,k.status,' +
    'k.created_at::text,k.reviewed_at::text from nova.kyc_submissions k ' +
    'join nova.profiles p on p.id=k.user_id where k.status=$1 ' +
    'order by k.created_at desc limit 100', [status],
  );
  return NextResponse.json({ ok: true, data: {
    items: rows.map(r => ({
      id: r.id, userId: r.user_id, email: r.email, publicId: r.public_id,
      documentType: r.document_type, status: r.status, createdAt: r.created_at,
      reviewedAt: r.reviewed_at,
    })),
  } }, { headers: { 'Cache-Control': 'private, no-store' } });
});
