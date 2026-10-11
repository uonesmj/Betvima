import { withErrorHandling, jsonOk } from '@/lib/errors';
import { withUser } from '@/server/http/guard';

export const dynamic = 'force-dynamic';

export const POST = withErrorHandling('support.user.close', async (
  ctx,
  request: Request,
  params: { params: Promise<{ id: string }> },
) => {
  const { id } = await params.params;
  const { services, user } = await withUser(request, ctx);

  const ticket = await services.support.closeForUser(id, user.id);

  return jsonOk({ ticket });
});
