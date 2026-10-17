import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withErrorHandling, ApiError } from '@/lib/errors';
import { withAdmin } from '@/server/http/guard';
import { readJson, enforceRateLimit } from '@/server/http/request';
import { serviceRoleClient } from '@/server/db/supabase';
import { KYC_BUCKET } from '@/server/kyc/files';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
type Params = { params: Promise<{ id: string }> };
const idSchema = z.string().uuid();
const decisionSchema = z.object({
  decision: z.enum(['verified','rejected']),
  ageConfirmed: z.boolean().default(false),
  reason: z.string().trim().min(8).max(500),
});
type Submission = {
  id: string; user_id: string; document_type: string; document_path: string;
  selfie_path: string | null; status: string; review_note: string | null;
  created_at: string; email: string | null; public_id: string;
};
async function getSubmission(id: string, db: {
  queryOne<T>(sql: string, params: unknown[]): Promise<T | null>
}) {
  return db.queryOne<Submission>(
    'select k.id,k.user_id,k.document_type,k.document_path,k.selfie_path,k.status,' +
    'k.review_note,k.created_at::text,p.email,p.public_id from nova.kyc_submissions k ' +
    'join nova.profiles p on p.id=k.user_id where k.id=$1', [id],
  );
}

export const GET = withErrorHandling('admin.kyc.detail', async (ctx, request: Request, params: Params) => {
  const { services } = await withAdmin(request, ctx, 'users.kyc');
  const { id } = await params.params;
  if (!idSchema.safeParse(id).success) throw new ApiError('VALIDATION_FAILED', 'Invalid submission');
  const submission = await getSubmission(id, services.db);
  if (!submission) throw new ApiError('NOT_FOUND', 'Submission not found');
  const storage = serviceRoleClient().storage.from(KYC_BUCKET);
  const doc = await storage.createSignedUrl(submission.document_path, 60, { download: true });
  if (doc.error || !doc.data?.signedUrl) throw new ApiError('SERVICE_UNAVAILABLE', 'Document unavailable');
  const selfie = submission.selfie_path
    ? await storage.createSignedUrl(submission.selfie_path, 60, { download: true }) : null;
  if (selfie?.error) throw new ApiError('SERVICE_UNAVAILABLE', 'Selfie unavailable');
  return NextResponse.json({ ok: true, data: {
    id: submission.id, userId: submission.user_id, email: submission.email,
    publicId: submission.public_id, documentType: submission.document_type,
    status: submission.status, reviewNote: submission.review_note,
    documentUrl: doc.data.signedUrl, selfieUrl: selfie?.data?.signedUrl ?? null,
    createdAt: submission.created_at,
  } }, { headers: { 'Cache-Control': 'private, no-store' } });
});

export const POST = withErrorHandling('admin.kyc.review', async (ctx, request: Request, params: Params) => {
  const { services, user, actor } = await withAdmin(request, ctx, 'users.kyc');
  await enforceRateLimit('kyc:review:' + user.id, 100, 3600);
  const { id } = await params.params;
  if (!idSchema.safeParse(id).success) throw new ApiError('VALIDATION_FAILED', 'Invalid submission');
  const body = await readJson(request, decisionSchema, ctx);
  if (body.decision === 'verified' && !body.ageConfirmed)
    throw new ApiError('VALIDATION_FAILED', 'Legal age must be verified from the identity document');
  const reviewed = await services.db.transaction(async (tx) => {
    const submission = await tx.queryOne<{
      user_id: string; status: string; document_path: string;
    }>('select user_id,status,document_path from nova.kyc_submissions where id=$1 for update', [id]);
    if (!submission) throw new ApiError('NOT_FOUND', 'Submission not found');
    if (submission.status !== 'pending') throw new ApiError('CONFLICT', 'Already reviewed');
    if (!submission.document_path) throw new ApiError('VALIDATION_FAILED', 'Missing evidence');
    const userRow = await tx.queryOne<{ id: string }>(
      'select id from nova.profiles where id=$1 for update', [submission.user_id],
    );
    if (!userRow) throw new ApiError('NOT_FOUND', 'User not found');
    await tx.query(
      'update nova.kyc_submissions set status=$2,reviewed_by=$3,review_note=$4,' +
      'legal_age_confirmed=$5,reviewed_at=now() where id=$1',
      [id, body.decision, user.id, body.reason, body.decision === 'verified' && body.ageConfirmed],
    );
    await tx.query(
      'update nova.profiles set kyc_status=$2,age_verified=$3 where id=$1',
      [submission.user_id, body.decision, body.decision === 'verified' && body.ageConfirmed],
    );
    await tx.rpc('audit_event', {
      p_actor_id: user.id, p_action: 'account.kyc.review',
      p_target_type: 'user', p_target_id: submission.user_id,
      p_before: { submissionId: id, kycStatus: 'pending' },
      p_after: { submissionId: id, kycStatus: body.decision, ageVerified: body.decision === 'verified' && body.ageConfirmed },
      p_reason: body.reason,
    });
    return { userId: submission.user_id, status: body.decision };
  });
  return NextResponse.json({ ok: true, data: reviewed }, { headers: { 'Cache-Control': 'private, no-store' } });
});
