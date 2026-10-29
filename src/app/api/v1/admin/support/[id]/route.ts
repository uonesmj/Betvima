import { z } from 'zod';
import { withErrorHandling, jsonOk } from '@/lib/errors';
import { ApiError } from '@/lib/errors';
import { readJson } from '@/server/http/request';
import { withUser, withAdmin } from '@/server/http/guard';
import { requireAdmin } from '@/server/auth/session';
import type { UUID } from '@/lib/types';
import type {
  SupportTicketStatus,
  SupportTicketCategory,
  SupportTicketPriority,
} from '@/lib/ports';

export const dynamic = 'force-dynamic';

const patchSchema = z.object({
  status: z.enum(['open', 'waiting_user', 'waiting_support', 'resolved', 'closed']).optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  category: z.enum(['deposit', 'withdrawal', 'bet', 'login', 'bonus', 'technical', 'other', 'general']).optional(),
  assignedTo: z.string().uuid().nullable().optional(),
}).refine((value) => Object.keys(value).length > 0, {
  message: 'At least one support ticket field is required.',
});

export const GET = withErrorHandling('admin.support.get', async (
  ctx,
  request: Request,
  params: { params: Promise<{ id: string }> },
) => {
  const { id } = await params.params;
  const { services } = await withAdmin(request, ctx, 'support.view');

  const ticket = await services.support.getForAdmin(id);
  if (!ticket) throw new ApiError('NOT_FOUND', 'Support ticket not found.');

  const messages = await services.support.listMessages(id);
  return jsonOk({ ticket, messages });
});

export const PATCH = withErrorHandling('admin.support.patch', async (
  ctx,
  request: Request,
  params: { params: Promise<{ id: string }> },
) => {
  const { id } = await params.params;
  const { services, user, actor } = await withUser(request, ctx);
  const body = await readJson(request, patchSchema, ctx);

  if (
    body.status !== undefined ||
    body.priority !== undefined ||
    body.category !== undefined
  ) {
    requireAdmin(user, 'support.manage');
  }

  if (body.assignedTo !== undefined) {
    requireAdmin(user, 'support.assign');
  }

  const ticket = await services.support.updateTicket({
    ticketId: id,
    actorId: user.id,
    ...(body.status !== undefined ? { status: body.status as SupportTicketStatus } : {}),
    ...(body.priority !== undefined ? { priority: body.priority as SupportTicketPriority } : {}),
    ...(body.category !== undefined ? { category: body.category as SupportTicketCategory } : {}),
    ...(body.assignedTo !== undefined ? { assignedTo: body.assignedTo as UUID | null } : {}),
  });

  await services.admin.writeAudit({
    actorId: user.id,
    action: 'support.ticket.updated',
    entityType: 'support_ticket',
    entityId: id,
    after: body,
    reason: 'support ticket administration',
    correlationId: actor.correlationId,
  });

  return jsonOk({ ticket });
});
