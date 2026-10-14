import { z } from 'zod';
import { withErrorHandling, jsonOk } from '@/lib/errors';
import { withUser } from '@/server/http/guard';
import { intParam, readJson, searchParams, enforceRateLimit } from '@/server/http/request';

export const dynamic = 'force-dynamic';

/**
 * Native-app notifications, scoped to the bearer-token owner's user ID.
 * Never accepts an arbitrary userId. The existing repository controls all writes.
 */
export const GET = withErrorHandling('notifications.mobile.list', async (ctx, request: Request) => {
  const { services, user } = await withUser(request, ctx);
  const params = searchParams(request);
  const page = intParam(params, 'page', 1, 1000);
  const pageSize = intParam(params, 'pageSize', 20, 50);
  const unreadOnly = params.get('unreadOnly') === 'true';
  const notifications = await services.notifications.listForUser(user.id, { page, pageSize, unreadOnly });
  return jsonOk(notifications);
});

const readSchema = z.object({
  ids: z.array(z.string().uuid()).max(50).optional(),
  all: z.boolean().optional(),
}).refine((input) => input.all === true || (input.ids?.length ?? 0) > 0,
  { message: 'ids or all=true required' });

export const POST = withErrorHandling('notifications.mobile.read', async (ctx, request: Request) => {
  const { services, user } = await withUser(request, ctx);
  await enforceRateLimit(`notifications:read:${user.id}`, 120, 60);
  const input = await readJson(request, readSchema, ctx);
  const updated = input.all === true
    ? await services.notifications.markAllRead(user.id)
    : await services.notifications.markRead(user.id, input.ids ?? []);
  return jsonOk({ updated });
});
