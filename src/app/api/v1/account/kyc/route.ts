import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { withErrorHandling, jsonOk, ApiError } from '@/lib/errors';
import { withUser } from '@/server/http/guard';
import { enforceRateLimit } from '@/server/http/request';
import { serviceRoleClient } from '@/server/db/supabase';
import { casinoIdentityApproved } from '@/server/kyc/eligibility';
import { KYC_BUCKET, KYC_MAX_FILE_BYTES, permittedKycFile } from '@/server/kyc/files';

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
  const approved = await casinoIdentityApproved(user.id);
  return NextResponse.json({ ok: true, data: {
    kycStatus: profile.kycStatus,
    gameAccessApproved: approved,
    status: profile.status,
    canSubmit: !approved && submission?.status !== 'pending',
    submission: submission ? {
      id: submission.id, status: submission.status, documentType: submission.document_type,
      createdAt: submission.created_at, reviewNote: submission.status === 'rejected' ? submission.review_note : null,
    } : null,
  } }, { headers: { 'Cache-Control': 'private, no-store' } });
});

async function limitedFormData(request: Request): Promise<FormData> {
  const type = request.headers.get('content-type') ?? '';
  if (!type.toLowerCase().startsWith('multipart/form-data;')) {
    throw new ApiError('VALIDATION_FAILED', 'Upload must be multipart/form-data');
  }
  const ceiling = KYC_MAX_FILE_BYTES * 2 + 64 * 1024;
  const length = Number(request.headers.get('content-length') ?? '0');
  if (length > ceiling) throw new ApiError('PAYLOAD_TOO_LARGE', 'Verification upload exceeds size limit');
  if (!request.body) throw new ApiError('BAD_REQUEST', 'Missing documents');
  const reader = request.body.getReader();
  const chunks: ArrayBuffer[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > ceiling) {
      await reader.cancel();
      throw new ApiError('PAYLOAD_TOO_LARGE', 'Verification upload exceeds size limit');
    }
    chunks.push(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) as ArrayBuffer);
  }
  try {
    return await new Request(request.url, {
      method: 'POST', headers: { 'Content-Type': type }, body: new Blob(chunks),
    }).formData();
  } catch {
    throw new ApiError('VALIDATION_FAILED', 'Invalid verification upload');
  }
}

export const POST = withErrorHandling('account.kyc.submit', async (ctx, request: Request) => {
  const origin = request.headers.get('origin');
  if (origin && new URL(origin).host !== new URL(request.url).host) {
    throw new ApiError('FORBIDDEN', 'Invalid request origin');
  }
  const { services, user } = await withUser(request, ctx);
  await enforceRateLimit('kyc:submit:' + user.id, 3, 3600);
  const profile = await services.users.getProfile(user.id);
  if (!profile) throw new ApiError('NOT_FOUND', 'Profile not found');
  if (await casinoIdentityApproved(user.id)) throw new ApiError('CONFLICT', 'Identity already verified');

  const form = await limitedFormData(request);
  const docType = form.get('documentType');
  if (!['national_id', 'passport', 'drivers_license'].includes(String(docType)))
    throw new ApiError('VALIDATION_FAILED', 'Invalid document type');
  if (form.get('consent') !== 'yes')
    throw new ApiError('VALIDATION_FAILED', 'Document processing consent is required');
  const document = form.get('document');
  const selfie = form.get('selfie');
  if (!(document instanceof File) || (selfie !== null && !(selfie instanceof File)))
    throw new ApiError('VALIDATION_FAILED', 'A document file is required');
  const docBytes = new Uint8Array(await document.arrayBuffer());
  const selfieBytes = selfie instanceof File ? new Uint8Array(await selfie.arrayBuffer()) : null;
  let docMime: { mime: string; extension: string };
  let selfieMime: { mime: string; extension: string } | null = null;
  try {
    docMime = permittedKycFile(document, docBytes);
    if (selfieBytes && selfie instanceof File) {
      selfieMime = permittedKycFile(selfie, selfieBytes);
      if (!selfieMime.mime.startsWith('image/')) throw new Error('KYC_SELFIE_MUST_BE_IMAGE');
    }
  } catch {
    throw new ApiError('VALIDATION_FAILED', 'Upload JPEG, PNG, WebP or PDF (8 MB maximum each); selfies must be images');
  }
  const duplicate = await services.db.queryOne<{ id: string }>(
    "select id from nova.kyc_submissions where user_id=$1 and status='pending'", [user.id],
  );
  if (duplicate) throw new ApiError('CONFLICT', 'Your documents are already awaiting review');
  const key = randomUUID();
  const docPath = user.id + '/' + key + '/document.' + docMime.extension;
  const selfiePath = selfieMime ? user.id + '/' + key + '/selfie.' + selfieMime.extension : null;
  const storage = serviceRoleClient().storage.from(KYC_BUCKET);
  const written: string[] = [];
  try {
    const uploaded = await storage.upload(docPath, docBytes, {
      contentType: docMime.mime, cacheControl: 'no-store', upsert: false,
    });
    if (uploaded.error) throw new Error('PRIVATE_KYC_STORAGE_UNAVAILABLE');
    written.push(docPath);
    if (selfieBytes && selfieMime && selfiePath) {
      const uploadedSelfie = await storage.upload(selfiePath, selfieBytes, {
        contentType: selfieMime.mime, cacheControl: 'no-store', upsert: false,
      });
      if (uploadedSelfie.error) throw new Error('PRIVATE_KYC_STORAGE_UNAVAILABLE');
      written.push(selfiePath);
    }
    const submissionId = await services.db.transaction(async (tx) => {
      const locked = await tx.queryOne<{ kyc_status: string; reviewed: boolean }>(
        "select p.kyc_status::text,exists(select 1 from nova.kyc_submissions k " +
        "where k.user_id=p.id and k.status='verified' and k.legal_age_confirmed) as reviewed " +
        "from nova.profiles p where p.id=$1 for update", [user.id],
      );
      if (!locked || locked.reviewed) throw new Error('KYC_ALREADY_VERIFIED');
      const exists = await tx.queryOne<{ id: string }>(
        "select id from nova.kyc_submissions where user_id=$1 and status='pending'", [user.id],
      );
      if (exists) throw new Error('KYC_ALREADY_PENDING');
      const saved = await tx.queryOne<{ id: string }>(
        'insert into nova.kyc_submissions(user_id,document_type,document_path,selfie_path) ' +
        'values($1,$2,$3,$4) returning id',
        [user.id, docType, docPath, selfiePath],
      );
      await tx.query("update nova.profiles set kyc_status='pending', age_verified=false where id=$1", [user.id]);
      await tx.rpc('audit_event', {
        p_actor_id: user.id, p_action: 'kyc.submitted', p_target_type: 'user', p_target_id: user.id,
        p_before: { kycStatus: locked.kyc_status },
        p_after: { submissionId: saved!.id, kycStatus: 'pending', selfieAttached: Boolean(selfiePath) },
        p_reason: 'customer KYC submission',
      });
      return saved!.id;
    });
    return jsonOk({ kycStatus: 'pending', submissionId });
  } catch {
    if (written.length) await storage.remove(written).catch(() => undefined);
    throw new ApiError('SERVICE_UNAVAILABLE', 'Verification could not be submitted. Please try again');
  }
});
