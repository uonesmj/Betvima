import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withErrorHandling, ApiError } from '@/lib/errors';
import { withAdmin } from '@/server/http/guard';
import { requireAdmin } from '@/server/auth/session';
import { enforceRateLimit, readJson } from '@/server/http/request';
import { serviceRoleClient } from '@/server/db/supabase';
import { SUPPORT_ATTACHMENT_BUCKET } from '@/server/support/attachments';
import { KYC_BUCKET, KYC_MAX_FILE_BYTES, detectedDocumentType } from '@/server/kyc/files';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
type Params = { params: Promise<{ id: string }> };
const uuid = z.string().uuid();
const approveSchema = z.object({
  attachmentId: z.string().uuid(),
  documentType: z.enum(['national_id', 'passport', 'drivers_license']),
  ageConfirmed: z.literal(true),
  consentConfirmed: z.literal(true),
  reason: z.string().trim().min(8).max(500),
}).strict();

type Evidence = {
  storage_path: string;
  bucket_id: string;
  mime_type: string;
  size_bytes: string;
};

const noStore = { 'Cache-Control': 'private, no-store' };

/**
 * Support stays the only customer document inbox. This endpoint may only be
 * used by an MFA-verified operator holding BOTH support.view and users.kyc.
 * Receiving a chat attachment never changes identity or casino privileges.
 */
export const GET = withErrorHandling('admin.support.kyc.status', async (
  ctx, request: Request, params: Params,
) => {
  const { services, user } = await withAdmin(request, ctx, 'users.kyc');
  requireAdmin(user, 'support.view');
  const { id } = await params.params;
  if (!uuid.safeParse(id).success) throw new ApiError('VALIDATION_FAILED', 'Invalid ticket');
  const ticket = await services.support.getForAdmin(id);
  if (!ticket) throw new ApiError('NOT_FOUND', 'Ticket not found');

  const row = await services.db.queryOne<{ status: string; reviewed_at: string | null }>(
    "select status, reviewed_at::text from nova.kyc_submissions where user_id=$1 " +
    "order by (status='verified') desc, created_at desc limit 1", [ticket.userId],
  );
  return NextResponse.json({ ok: true, data: {
    status: row?.status ?? 'unverified', reviewedAt: row?.reviewed_at ?? null,
  } }, { headers: noStore });
});

export const POST = withErrorHandling('admin.support.kyc.approve', async (
  ctx, request: Request, params: Params,
) => {
  const { services, user, actor } = await withAdmin(request, ctx, 'users.kyc');
  requireAdmin(user, 'support.view');
  await enforceRateLimit('support:kyc:approve:' + user.id, 30, 3600);
  const { id } = await params.params;
  if (!uuid.safeParse(id).success) throw new ApiError('VALIDATION_FAILED', 'Invalid ticket');
  const body = await readJson(request, approveSchema, ctx);
  const ticket = await services.support.getForAdmin(id);
  if (!ticket) throw new ApiError('NOT_FOUND', 'Ticket not found');

  // Refuse to use chat evidence while its metadata is writable from the Data API.
  // This must be deployed alongside migration 0215.
  const safeMetadata = await services.db.queryOne<{ enabled: boolean; client_write: boolean }>(
    "select (select relrowsecurity from pg_class where oid='public.ticket_attachments'::regclass) as enabled," +
    "has_table_privilege('anon','public.ticket_attachments','INSERT') or " +
    "has_table_privilege('authenticated','public.ticket_attachments','INSERT') as client_write", [],
  );
  if (!safeMetadata?.enabled || safeMetadata.client_write) {
    throw new ApiError('SERVICE_UNAVAILABLE', 'Support identity evidence security migration required');
  }

  // The attachment MUST be part of a message sent by this ticket's authenticated
  // owner, never a support agent or a client-supplied storage path.
  const attachment = await services.db.queryOne<Evidence>(
    "select a.storage_path,a.bucket_id,a.mime_type,a.size_bytes::text " +
    "from public.ticket_attachments a " +
    "join public.tickets t on t.id=a.ticket_id " +
    "join public.ticket_messages m on m.id=a.message_id and m.ticket_id=t.id " +
    "where a.id=$1 and t.id=$2 and t.user_id=$3 and " +
    "a.uploader_id=t.user_id and a.uploader_role='user' and " +
    "m.sender_id=t.user_id and m.sender_role='user' and " +
    "a.bucket_id=$4", [body.attachmentId, id, ticket.userId, SUPPORT_ATTACHMENT_BUCKET],
  );
  if (!attachment ||
      !attachment.storage_path.startsWith(id + '/') ||
      Number(attachment.size_bytes) < 12 ||
      Number(attachment.size_bytes) > KYC_MAX_FILE_BYTES) {
    throw new ApiError('VALIDATION_FAILED', 'Select a valid customer ID document attachment (max 8 MB)');
  }

  const client = serviceRoleClient();
  const downloaded = await client.storage.from(SUPPORT_ATTACHMENT_BUCKET).download(attachment.storage_path);
  if (downloaded.error || !downloaded.data) throw new ApiError('SERVICE_UNAVAILABLE', 'Identity attachment unavailable');
  const bytes = new Uint8Array(await downloaded.data.arrayBuffer());
  const detected = detectedDocumentType(bytes);
  if (!detected || bytes.byteLength !== Number(attachment.size_bytes) ||
      bytes.byteLength > KYC_MAX_FILE_BYTES || detected.mime !== attachment.mime_type) {
    throw new ApiError('VALIDATION_FAILED', 'The selected identity attachment has invalid content');
  }

  const key = ticket.userId + '/support-' + id + '/' + randomUUID() + '/document.' + detected.extension;
  const storage = client.storage.from(KYC_BUCKET);
  const saved = await storage.upload(key, bytes, {
    contentType: detected.mime, cacheControl: 'no-store', upsert: false,
  });
  if (saved.error) throw new ApiError('SERVICE_UNAVAILABLE', 'Private identity evidence storage unavailable');

  let submissionId: string;
  try {
    submissionId = await services.db.transaction(async (tx) => {
      const locked = await tx.queryOne<{ id: string; status: string }>(
        'select id,status::text from nova.profiles where id=$1 for update', [ticket.userId],
      );
      if (!locked || locked.status !== 'active') throw new ApiError('FORBIDDEN', 'Inactive customer account');
      const prior = await tx.queryOne<{ id: string; status: string }>(
        "select id,status from nova.kyc_submissions where user_id=$1 and status in ('pending','verified') " +
        "order by created_at desc limit 1 for update", [ticket.userId],
      );
      if (prior) throw new ApiError('CONFLICT', prior.status === 'verified'
        ? 'Customer identity is already approved' : 'An earlier identity submission is awaiting review');

      const row = await tx.queryOne<{ id: string }>(
        "insert into nova.kyc_submissions (user_id, document_type, document_path, status," +
        "reviewed_at, reviewed_by, review_note, legal_age_confirmed) " +
        "values ($1,$2,$3,'verified',now(),$4,$5,true) returning id",
        [ticket.userId, body.documentType, key, user.id, body.reason],
      );
      if (!row) throw new ApiError('INTERNAL_ERROR', 'Identity approval not recorded');
      await tx.query(
        "update nova.profiles set kyc_status='verified',age_verified=true where id=$1",
        [ticket.userId],
      );
      await tx.rpc('audit_event', {
        p_actor_id: user.id, p_action: 'account.kyc.support.approved',
        p_target_type: 'user', p_target_id: ticket.userId,
        p_before: { casinoReview: 'unverified' },
        p_after: { submissionId: row.id, source: 'support_ticket', ticketId: id,
          attachmentId: body.attachmentId, consentConfirmed: body.consentConfirmed,
          legalAgeConfirmed: body.ageConfirmed },
        p_reason: body.reason,
      });
      return row.id;
    });
  } catch (error) {
    await storage.remove([key]).catch(() => undefined);
    throw error;
  }

  // Reuse the EXISTING chat and notification inbox; never create another ticket.
  // Notification failure cannot undo an already-committed identity approval.
  try {
    const message = await services.support.addSupportMessage({
      ticketId: id, actorId: user.id,
      body: 'Your identity has been verified by BetVima Support. You can now use eligible casino games. Real-money availability is checked separately.',
    });
    await services.notifications.enqueue({
      userId: ticket.userId, eventKey: 'support.reply', channels: ['in_app'], locale: 'en',
      title: 'Identity verification approved',
      body: 'BetVima Support approved your identity. Open your conversation for details.',
      data: { audience: 'personal', ticketId: id, messageId: message.id,
        ctaLabel: 'Open chat', ctaHref: '/support?ticket=' + encodeURIComponent(id) },
      dedupeKey: 'support-kyc-approved:' + submissionId,
    });
  } catch {
    // The reviewed identity remains committed and visible in account status.
  }

  return NextResponse.json({ ok: true, data: {
    approved: true, userId: ticket.userId, submissionId,
  } }, { headers: noStore });
});
