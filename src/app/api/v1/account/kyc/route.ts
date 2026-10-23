import { NextResponse } from 'next/server';
import { withErrorHandling, ApiError } from '@/lib/errors';
import { withUser } from '@/server/http/guard';
import { casinoSupportApproved } from '@/server/kyc/casino-support';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Read identities only from authenticated database records; NEVER accept storage paths from customers.
export const GET = withErrorHandling('account.kyc.get', async (ctx, request: Request) => {
  const { services, user } = await withUser(request, ctx);
  const profile = await services.users.getProfile(user.id);
  if (!profile) throw new ApiError('NOT_FOUND', 'Profile not found');
  const submission = await services.db.queryOne<{
    id: string; status: string; document_type: string; created_at: string; review_note: string | null;
  }>(
    'select id,status,document_type,created_at::text,review_note from nova.kyc_submissions ' +
    'where user_id=$1 order by created_at desc limit 1', [user.id],
  );
  // Legacy account KYC remains informational. It is not a casino demo gate.
  const approved = await casinoSupportApproved(user.id, services.db);
  return NextResponse.json({ ok: true, data: {
    kycStatus: submission?.status ?? profile.kycStatus,
    gameAccessApproved: profile.status === 'active',
    casinoSupportApproved: approved,
    status: profile.status,
    canSubmit: submission?.status !== 'pending' && submission?.status !== 'verified',
    submission: submission ? {
      id: submission.id, status: submission.status, documentType: submission.document_type,
      createdAt: submission.created_at, reviewNote: submission.status === 'rejected' ? submission.review_note : null,
    } : null,
  } }, { headers: { 'Cache-Control': 'private, no-store' } });
});


// Do not expose a second customer ID-upload workflow. Customers submit
// documents in the existing private support conversation and an authorized
// reviewer approves from that same support ticket.
export const POST = withErrorHandling('account.kyc.submit', async () =>
  NextResponse.json({
    ok: false,
    error: 'KYC_VIA_SUPPORT',
    message: 'Send your identity document in the existing support chat.',
    supportUrl: '/support',
  }, { status: 410, headers: { 'Cache-Control': 'private, no-store' } }),
);
