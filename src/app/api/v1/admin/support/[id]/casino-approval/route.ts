import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withErrorHandling, ApiError } from '@/lib/errors';
import { withAdmin } from '@/server/http/guard';
import { requireAdmin } from '@/server/auth/session';
import { enforceRateLimit, readJson } from '@/server/http/request';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
type Params = { params: Promise<{ id: string }> };
const uuid = z.string().uuid();
const decisionSchema = z.object({
  decision: z.enum(['approve', 'revoke']),
  ageConfirmed: z.boolean().optional(),
  reason: z.string().trim().min(8).max(500),
}).strict().refine(
  value => value.decision !== 'approve' || value.ageConfirmed === true,
  { message: 'The reviewer must confirm legal age for casino approval' },
);

const noStore = { 'Cache-Control': 'private, no-store' };

/**
 * Authorization is strictly an operator decision recorded in the existing
 * private support workflow; it does not represent completed document KYC.
 * Only an MFA-authorized user with users.kyc AND support.view may decide.
 */
export const GET = withErrorHandling('admin.support.casino_approval.get', async (
  ctx, request: Request, params: Params,
) => {
  const { services, user } = await withAdmin(request, ctx, 'users.kyc');
  requireAdmin(user, 'support.view');
  const { id } = await params.params;
  if (!uuid.safeParse(id).success) throw new ApiError('VALIDATION_FAILED', 'Invalid ticket');
  const ticket = await services.support.getForAdmin(id);
  if (!ticket) throw new ApiError('NOT_FOUND', 'Ticket not found');
  const record = await services.db.queryOne<{
    status: string; legal_age_confirmed: boolean; reviewed_at: string; reviewed_by: string;
  }>(
    'select status,legal_age_confirmed,reviewed_at::text,reviewed_by ' +
    'from nova.casino_support_approvals where user_id=$1', [ticket.userId],
  );
  return NextResponse.json({ ok: true, data: {
    status: record?.status ?? 'unreviewed',
    ageConfirmed: record?.legal_age_confirmed ?? false,
    reviewedAt: record?.reviewed_at ?? null,
  } }, { headers: noStore });
});

export const POST = withErrorHandling('admin.support.casino_approval.decide', async (
  ctx, request: Request, params: Params,
) => {
  const { services, user } = await withAdmin(request, ctx, 'users.kyc');
  requireAdmin(user, 'support.view');
  await enforceRateLimit('support:casino:review:' + user.id, 30, 3600);
  const { id } = await params.params;
  if (!uuid.safeParse(id).success) throw new ApiError('VALIDATION_FAILED', 'Invalid ticket');
  const body = await readJson(request, decisionSchema, ctx);
  const ticket = await services.support.getForAdmin(id);
  if (!ticket) throw new ApiError('NOT_FOUND', 'Ticket not found');

  const status = body.decision === 'approve' ? 'approved' : 'revoked';
  await services.db.transaction(async (tx) => {
    const profile = await tx.queryOne<{ id: string; status: string }>(
      'select id,status::text from nova.profiles where id=$1 for update',
      [ticket.userId],
    );
    if (!profile || profile.status !== 'active')
      throw new ApiError('FORBIDDEN', 'Account is not active');
    const old = await tx.queryOne<{ status: string }>(
      'select status from nova.casino_support_approvals where user_id=$1 for update',
      [ticket.userId],
    );
    if (old?.status === status) throw new ApiError('CONFLICT', 'Casino access already has this status');
    await tx.query(
      'insert into nova.casino_support_approvals ' +
      '(user_id,status,legal_age_confirmed,reviewed_by,ticket_id,review_note,reviewed_at) ' +
      'values ($1,$2,$3,$4,$5,$6,now()) ' +
      'on conflict(user_id) do update set ' +
      'status=excluded.status,legal_age_confirmed=excluded.legal_age_confirmed,' +
      'reviewed_by=excluded.reviewed_by,ticket_id=excluded.ticket_id,' +
      'review_note=excluded.review_note,reviewed_at=excluded.reviewed_at',
      [ticket.userId,status,body.decision==='approve' && body.ageConfirmed === true,
        user.id,id,body.reason],
    );
    await tx.rpc('audit_event', {
      p_actor_id: user.id,
      p_action: status === 'approved' ? 'casino.support.access.approved' : 'casino.support.access.revoked',
      p_target_type: 'user',
      p_target_id: ticket.userId,
      p_before: { casinoAccess: old?.status ?? 'unreviewed' },
      p_after: { casinoAccess: status, ticketId: id, legalAgeConfirmed: body.decision === 'approve' },
      p_reason: body.reason,
    });
  });

  // The approval is durable even if the notification provider is unavailable.
  try {
    const message = await services.support.addSupportMessage({
      ticketId: id, actorId: user.id,
      body: status === 'approved'
        ? 'BetVima Support has approved your casino account review. Real-money play is subject to service availability and separate eligibility checks.'
        : 'BetVima Support has revoked your casino account approval. Please contact support to discuss your access.',
    });
    await services.notifications.enqueue({
      userId: ticket.userId,
      eventKey: 'support.reply',
      channels: ['in_app'],
      locale: 'en',
      title: status === 'approved' ? 'Casino review approved' : 'Casino access updated',
      body: 'Your support conversation has a casino account update.',
      data: { audience: 'personal', ticketId: id, messageId: message.id,
        ctaLabel: 'Open chat', ctaHref: '/support?ticket=' + encodeURIComponent(id) },
      dedupeKey: 'casino-support-review:' + id + ':' + status + ':' + user.id,
    });
  } catch {
    // Never roll back the recorded decision due to messaging errors.
  }
  return NextResponse.json({ ok: true, data: {
    approved: status === 'approved', status, userId: ticket.userId,
  } }, { headers: noStore });
});
