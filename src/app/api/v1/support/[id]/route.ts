import { withErrorHandling, jsonOk } from '@/lib/errors';
import { ApiError } from '@/lib/errors';
import { withUser } from '@/server/http/guard';

export const dynamic = 'force-dynamic';

export const GET = withErrorHandling('support.get', async (
  ctx,
  request: Request,
  params: { params: Promise<{ id: string }> },
) => {
  const { id } = await params.params;
  const { services, user } = await withUser(request, ctx);

  const ticket = await services.support.getForUser(id, user.id);
  if (!ticket) throw new ApiError('NOT_FOUND', 'Support ticket not found.');

  const messages = await services.support.listMessages(id, user.id);

  const supportOnline = await services.support.isAgentOnline();
  return jsonOk({ ticket, messages, supportOnline });
});
