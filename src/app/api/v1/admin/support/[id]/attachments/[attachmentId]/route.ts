import { withErrorHandling, ApiError, jsonOk } from '@/lib/errors';
import { withAdmin } from '@/server/http/guard';
import { serviceRoleClient } from '@/server/db/supabase';

export const dynamic = 'force-dynamic';

export const GET = withErrorHandling('admin.support.attachment.download', async (
  ctx,
  request: Request,
  params: { params: Promise<{ id: string; attachmentId: string }> },
) => {
  const { id, attachmentId } = await params.params;
  const { services } = await withAdmin(request, ctx, 'support.view');

  const ticket = await services.support.getForAdmin(id);
  if (!ticket) throw new ApiError('NOT_FOUND', 'Support ticket not found.');

  const messages = await services.support.listMessages(id);
  const attachment = messages
    .flatMap((message) => message.attachments)
    .find((item) => item.id === attachmentId);

  if (!attachment) {
    throw new ApiError('NOT_FOUND', 'Attachment not found.');
  }

  const { data, error } = await serviceRoleClient()
    .storage
    .from(attachment.bucketId)
    .createSignedUrl(attachment.storagePath, 300);

  if (error || !data?.signedUrl) {
    throw new ApiError('INTERNAL_ERROR', 'Unable to create attachment URL.');
  }

  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!baseUrl) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not configured');
    const redirectUrl = data.signedUrl.startsWith('http://') || data.signedUrl.startsWith('https://') ? data.signedUrl : new URL(data.signedUrl, `${baseUrl.replace(/\/$/, '')}/storage/v1/`).toString();
    // Native admin cannot pass a Bearer token to an external browser. Return
    // the short-lived, ticket-scoped signed URL only to an authorized viewer.
    // Keep the existing 302 path unchanged for web admin consumers.
    if (new URL(request.url).searchParams.get('format') === 'json') {
      return jsonOk({ url: redirectUrl, mimeType: attachment.mimeType, fileName: attachment.originalName,
        expiresInSeconds: 300 });
    }
    return new Response(null, {
      status: 302,
      headers: { Location: redirectUrl },
    });
});
