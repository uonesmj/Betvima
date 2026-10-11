import { withErrorHandling, jsonCreated, ApiError } from '@/lib/errors';
import { withAdmin } from '@/server/http/guard';
import { removeSupportAttachment, uploadSupportAttachment } from '@/server/support/attachments';

export const dynamic = 'force-dynamic';

export const POST = withErrorHandling('admin.support.message', async (
  ctx,
  request: Request,
  params: { params: Promise<{ id: string }> },
) => {
  const { id } = await params.params;
  const { services, user, actor } = await withAdmin(request, ctx, 'support.reply');
  const contentType = request.headers.get('content-type') ?? '';

  let body = '';
  let file: File | null = null;

  if (contentType.toLowerCase().startsWith('multipart/form-data')) {
    const form = await request.formData();
    body = String(form.get('body') ?? '').trim().slice(0, 5000);
    const candidate = form.get('file');
    if (candidate instanceof File && candidate.size > 0) file = candidate;
  } else {
    const json = await request.json() as { body?: unknown };
    body = typeof json.body === 'string' ? json.body.trim().slice(0, 5000) : '';
  }

  if (!body && !file) {
    throw new ApiError('VALIDATION_FAILED', 'Message or attachment is required.');
  }

  let uploaded: Awaited<ReturnType<typeof uploadSupportAttachment>> | null = null;

  try {
    if (file) uploaded = await uploadSupportAttachment(id, file);

    const message = await services.support.addSupportMessage({
      ticketId: id,
      actorId: user.id,
      body,
      ...(uploaded ? {
        attachment: {
          ...uploaded,
          uploaderId: user.id,
          uploaderRole: 'support' as const,
        },
      } : {}),
    });

    await services.admin.writeAudit({
      actorId: user.id,
      action: 'support.message.sent',
      entityType: 'support_ticket',
      entityId: id,
      after: {
        messageId: message.id,
        hasAttachment: Boolean(uploaded),
      },
      reason: 'support agent reply',
      correlationId: actor.correlationId,
    });

    return jsonCreated({ message });
  } catch (error) {
    if (uploaded) {
      try {
        await removeSupportAttachment(uploaded.storagePath);
      } catch {}
    }
    throw error;
  }
});
