import { withErrorHandling, jsonOk } from '@/lib/errors';
import { ApiError } from '@/lib/errors';
import { withAdmin } from '@/server/http/guard';

export const dynamic = 'force-dynamic';
export const POST = withErrorHandling('admin.support.read', async (ctx, request: Request, params: {
  params: Promise<{ id: string }>
}) => {
  const { id } = await params.params;
  const { services, user } = await withAdmin(request, ctx, 'support.view');
  const ticket = await services.support.getForAdmin(id);
  if (!ticket) throw new ApiError('NOT_FOUND', 'Support ticket not found.');
  const count = await services.support.markMessagesRead(id, 'support', user.id);
  return jsonOk({ count });
});
