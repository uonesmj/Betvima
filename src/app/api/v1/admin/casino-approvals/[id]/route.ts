import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withErrorHandling, ApiError } from '@/lib/errors';
import { withAdmin } from '@/server/http/guard';
import { enforceRateLimit } from '@/server/http/request';
import { serviceRoleClient } from '@/server/db/supabase';
import { KYC_BUCKET, permittedKycFile, KYC_MAX_FILE_BYTES } from '@/server/kyc/files';
import { casinoManualIdentityReviewSchema } from '@/server/kyc/casino-manual-review';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };
const uuid = z.string().uuid();
const noStore = { 'Cache-Control': 'private, no-store' };

/**
 * Operator-only manual review of an actual supplied ID document (including
 * documents first received over Telegram). The file is copied to the existing
 * private KYC bucket before recording the immutable admin review trail.
 *
 * NEVER toggles casino feature flags, changes wallets, skips age verification,
 * or substitutes for supplier/country/responsible-gaming checks.
 */
export const POST = withErrorHandling('admin.casino_approvals.approve', async (
  ctx, request: Request, params: Params,
) => {
  const { services, user } = await withAdmin(request, ctx, 'users.kyc');
  await enforceRateLimit('admin:casino-approval:' + user.id, 20, 3600);

  const { id } = await params.params;
  if (!uuid.safeParse(id).success) throw new ApiError('VALIDATION_FAILED', 'Invalid user');

  const origin = request.headers.get('origin');
  if (!origin || origin !== new URL(request.url).origin) {
    throw new ApiError('FORBIDDEN', 'Same-origin admin form required');
  }
  if (!(request.headers.get('content-type') ?? '').toLowerCase().startsWith('multipart/form-data')) {
    throw new ApiError('VALIDATION_FAILED', 'An identity document must be uploaded');
  }
  const size = Number(request.headers.get('content-length') ?? 0);
  if (size > KYC_MAX_FILE_BYTES + 1024 * 1024) {
    throw new ApiError('VALIDATION_FAILED', 'Identity document is too large');
  }
  const form = await request.formData();
  const result = casinoManualIdentityReviewSchema.safeParse({
    documentType: form.get('documentType'),
    reason: form.get('reason'),
    telegramReference: form.get('telegramReference'),
    ageConfirmed: form.get('ageConfirmed') === 'true',
    identityConfirmed: form.get('identityConfirmed') === 'true',
    consentConfirmed: form.get('consentConfirmed') === 'true',
  });
  if (!result.success) throw new ApiError('VALIDATION_FAILED', 'Complete the identity, legal-age, consent and review fields');
  const review = result.data;
  const file = form.get('document');
  if (!(file instanceof File) || file.size < 12 || file.size > KYC_MAX_FILE_BYTES) {
    throw new ApiError('VALIDATION_FAILED', 'A valid private ID image or PDF (max 8 MB) is required');
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  let format: { mime: string; extension: string };
  try {
    format = permittedKycFile(file, bytes);
  } catch {
    throw new ApiError('VALIDATION_FAILED', 'Invalid ID file format or size');
  }

  // Avoid a needless sensitive upload for an ineligible or already approved user.
  const existing = await services.db.queryOne<{
    id: string; status: string; role: string; kyc_status: string;
  }>(
    'select id,status::text,role::text,kyc_status::text from nova.profiles where id=$1',
    [id],
  );
  if (!existing) throw new ApiError('NOT_FOUND', 'Account not found');
  if (existing.status !== 'active' || !['user', 'affiliate'].includes(existing.role))
    throw new ApiError('FORBIDDEN', 'This account cannot be approved');
  if (existing.kyc_status === 'verified')
    throw new ApiError('CONFLICT', 'Identity already approved');

  const key = id + '/manual-telegram/' + randomUUID() + '/document.' + format.extension;
  const storage = serviceRoleClient().storage.from(KYC_BUCKET);
  const saved = await storage.upload(key, bytes, {
    contentType: format.mime, cacheControl: 'no-store', upsert: false,
  });
  if (saved.error) throw new ApiError('SERVICE_UNAVAILABLE', 'Private identity storage unavailable');

  let submissionId: string;
  try {
    submissionId = await services.db.transaction(async (tx) => {
      // Required by nova.profiles_guard: the role comes from the verified
      // MFA/permission-checked session, NEVER from the incoming form.
      await tx.query("select set_config('nova.user_role', $1, true)", [user.role]);
      const profile = await tx.queryOne<{
        id: string; status: string; role: string; kyc_status: string;
      }>(
        'select id,status::text,role::text,kyc_status::text from nova.profiles where id=$1 for update',
        [id],
      );
      if (!profile || profile.status !== 'active' || !['user','affiliate'].includes(profile.role))
        throw new ApiError('FORBIDDEN', 'Account not eligible');
      if (profile.kyc_status === 'verified')
        throw new ApiError('CONFLICT', 'Identity already approved');
      const prior = await tx.queryOne<{ status: string }>(
        "select status from nova.kyc_submissions where user_id=$1 " +
        "and status in ('pending','verified') order by created_at desc limit 1 for update",
        [id],
      );
      if (prior) throw new ApiError('CONFLICT', prior.status === 'verified'
        ? 'Identity already approved' : 'Review the existing pending submission instead');

      const reviewed = await tx.queryOne<{ id: string }>(
        "insert into nova.kyc_submissions " +
        "(user_id,document_type,document_path,status,reviewed_at,reviewed_by,review_note,legal_age_confirmed) " +
        "values ($1,$2,$3,'verified',now(),$4,$5,true) returning id",
        [id, review.documentType, key, user.id,
          'Manual operator review via Telegram; evidence reference: ' +
          review.telegramReference + '; ' + review.reason],
      );
      if (!reviewed) throw new ApiError('INTERNAL_ERROR', 'Failed to store verified evidence');
      await tx.query(
        "update nova.profiles set kyc_status='verified',age_verified=true where id=$1",
        [id],
      );
      await tx.rpc('audit_event', {
        p_actor_id: user.id,
        p_action: 'account.kyc.telegram_manual.approved',
        p_target_type: 'user', p_target_id: id,
        p_before: { casinoIdentityApproved: false },
        p_after: {
          casinoIdentityApproved: true, submissionId: reviewed.id,
          evidenceSource: 'telegram_manual', evidenceReference: review.telegramReference,
          documentType: review.documentType, legalAgeConfirmed: true,
          identityConfirmed: true, customerConsentConfirmed: true,
        },
        p_reason: review.reason,
      });
      return reviewed.id;
    });
  } catch (error) {
    await storage.remove([key]).catch(() => undefined);
    throw error;
  }
  return NextResponse.json({ ok: true, data: {
    approved: true, userId: id, submissionId,
    message: 'Identity evidence and legal-age review recorded. Casino access remains subject to provider and geographic eligibility.',
  } }, { headers: noStore });
});
