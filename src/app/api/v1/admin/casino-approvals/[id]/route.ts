import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withErrorHandling, ApiError } from '@/lib/errors';
import { withAdmin } from '@/server/http/guard';
import { enforceRateLimit, readJson } from '@/server/http/request';
import { casinoManualIdentityReviewSchema } from '@/server/kyc/casino-manual-review';
import { serverEnv } from '@/server/env';
import { isApprovedAdminOrigin } from '@/server/security/approved-admin-origin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };
const uuid = z.string().uuid();
const noStore = { 'Cache-Control': 'private, no-store' };

/**
 * Identity and legal-age approval after the operator examines documents held
 * OUTSIDE BetVima. There is no multipart parser, Storage upload or document
 * download. A server-derived public user ID is the custody reference.
 * Never let a client supply the account to credit, a path or a KYC status.
 *
 * This writes existing KYC flags and verified submission only; it does not
 * enable casino payments or bypass geography, AML or responsible-gaming rules.
 */
export const POST = withErrorHandling('admin.casino_approvals.approve', async (
  ctx, request: Request, params: Params,
) => {
  const { services, user } = await withAdmin(request, ctx, 'users.kyc');
  await enforceRateLimit('admin:casino-approval:' + user.id, 20, 3600);
  const { id } = await params.params;
  if (!uuid.safeParse(id).success) throw new ApiError('VALIDATION_FAILED', 'Invalid user');

  // Production TLS terminates at Nginx. Request.url may point at its HTTP
  // upstream, so use the configured public origin while retaining CSRF checks.
  const origin = request.headers.get('origin');
  if (!isApprovedAdminOrigin(origin, serverEnv().NEXT_PUBLIC_SITE_URL)) {
    throw new ApiError('FORBIDDEN', 'Same-origin admin form required');
  }
  const body = await readJson(request, casinoManualIdentityReviewSchema, ctx);

  // If the external-custody migration was not installed, fail before changing
  // profile flags or giving the operator a misleading success message.
  const ready = await services.db.queryOne<{ ready: boolean }>(
    "select exists(select 1 from information_schema.columns " +
    "where table_schema='nova' and table_name='kyc_submissions' " +
    "and column_name='external_evidence_reference') " +
    "and exists(select 1 from information_schema.columns " +
    "where table_schema='nova' and table_name='kyc_submissions' " +
    "and column_name='evidence_source') as ready",
  );
  if (ready?.ready !== true) {
    throw new ApiError('SERVICE_UNAVAILABLE', 'Manual KYC custody migration must be applied first');
  }

  const submitted = await services.db.transaction(async (tx) => {
    // Role derives from MFA-protected session; nova.profiles_guard requires it.
    await tx.query("select set_config('nova.user_role', $1, true)", [user.role]);
    const profile = await tx.queryOne<{
      id: string; public_id: string; status: string; role: string; kyc_status: string;
    }>(
      'select id,public_id,status::text,role::text,kyc_status::text ' +
      'from nova.profiles where id=$1 for update', [id],
    );
    if (!profile) throw new ApiError('NOT_FOUND', 'User not found');
    if (profile.status !== 'active' || !['user', 'affiliate'].includes(profile.role)) {
      throw new ApiError('FORBIDDEN', 'User is not eligible for identity approval');
    }
    if (profile.kyc_status === 'verified') {
      throw new ApiError('CONFLICT', 'Identity is already approved');
    }
    // Record only an account-linked opaque public reference, NEVER a passport
    // number, Telegram identifier, document bytes, image or external URL.
    if (typeof profile.public_id !== 'string' ||
        profile.public_id.length < 4 || profile.public_id.length > 80) {
      throw new ApiError('SERVICE_UNAVAILABLE', 'Public custody reference unavailable');
    }
    const prior = await tx.queryOne<{ status: string }>(
      "select status from nova.kyc_submissions where user_id=$1 " +
      "and status in ('pending','verified') order by created_at desc limit 1 for update",
      [id],
    );
    if (prior) {
      throw new ApiError('CONFLICT', prior.status === 'verified'
        ? 'Identity already approved' : 'An existing pending submission must be reviewed instead');
    }

    const reviewed = await tx.queryOne<{ id: string }>(
      'insert into nova.kyc_submissions ' +
      '(user_id,document_type,document_path,selfie_path,status,reviewed_at,' +
      'reviewed_by,review_note,legal_age_confirmed,evidence_source,external_evidence_reference) ' +
      "values ($1,$2,null,null,'verified',now(),$3,$4,true,'external_custody',$5) returning id",
      [id, body.documentType, user.id,
        'Operator personally inspected the external identity document, matched it to this account, ' +
        'verified legal age, confirmed customer consent and retained evidence outside BetVima.',
        profile.public_id],
    );
    if (!reviewed) throw new ApiError('INTERNAL_ERROR', 'Identity review could not be recorded');

    await tx.query(
      "update nova.profiles set kyc_status='verified',age_verified=true where id=$1",
      [id],
    );
    await tx.rpc('audit_event', {
      p_actor_id: user.id, p_action: 'account.kyc.external_custody.approved',
      p_target_type: 'user', p_target_id: id,
      p_before: { casinoIdentityApproved: false },
      p_after: {
        casinoIdentityApproved: true, submissionId: reviewed.id,
        evidenceSource: 'external_custody',
        externalEvidenceReference: profile.public_id,
        documentType: body.documentType,
        identityConfirmed: body.identityConfirmed,
        legalAgeConfirmed: body.ageConfirmed,
        customerConsentConfirmed: body.consentConfirmed,
        externalCustodyConfirmed: body.externalCustodyConfirmed,
      },
      p_reason: 'Manual external-custody KYC review after operator inspection',
    });
    return reviewed.id;
  });
  return NextResponse.json({ ok: true, data: {
    approved: true, userId: id, submissionId: submitted,
    message: 'Identity and age manually verified. External documents were not uploaded or stored in BetVima.',
  } }, { headers: noStore });
});
