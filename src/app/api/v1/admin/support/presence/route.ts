import { withErrorHandling, jsonOk } from '@/lib/errors';
import { withAdmin } from '@/server/http/guard';

export const dynamic = 'force-dynamic';
export const POST = withErrorHandling('admin.support.presence', async (ctx, request: Request) => {
  const { services, user } = await withAdmin(request, ctx, 'support.view');
  await services.support.touchAgentPresence(user.id);
  return jsonOk({ online: true });
});
