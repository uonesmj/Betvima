import { withErrorHandling, jsonOk } from '@/lib/errors';
import { ApiError } from '@/lib/errors';
import { withUser } from '@/server/http/guard';

export const dynamic = 'force-dynamic';
export const POST = withErrorHandling('support.read', async (ctx, request: Request, params: {
  params: Promise<{ id: string }>
}) => {
  const { id } = await params.params;
  const { services, user } = await withUser(request, ctx);
  const ticket = await services.support.getForUser(id, user.id);
  if (!ticket) throw new ApiError('NOT_FOUND', 'Support ticket not found.');
  const count = await services.support.markMessagesRead(id, 'user', user.id);
  return jsonOk({ count });
});
