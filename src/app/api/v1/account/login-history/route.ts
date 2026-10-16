import { withErrorHandling, jsonOk } from '@/lib/errors';
import { withUser } from '@/server/http/guard';
import { enforceRateLimit, intParam, searchParams } from '@/server/http/request';
import { clientIpFromHeaders, hashSignal } from '@/server/utils/hash';

export const dynamic = 'force-dynamic';

type EventRow = {
  id: string | number;
  created_at: string | Date;
  user_agent: string | null;
  metadata: { platform?: string; client?: string } | null;
};

/**
 * Only the authenticated owner's login events are disclosed.
 * This table predates this feature (migration 0110_account_admin_ops.sql).
 */
export const GET = withErrorHandling('account.loginHistory.list', async (ctx, request: Request) => {
  const { services, user } = await withUser(request, ctx);
  const page = intParam(searchParams(request), 'page', 1, 100);
  const limit = 20;
  const rows = await services.db.query<EventRow>(
    `select id, created_at, user_agent, metadata
       from nova.account_events
      where user_id = $1 and event_key = 'security.login'
      order by created_at desc, id desc
      limit $2 offset $3`,
    [user.id, limit + 1, (page - 1) * limit],
  );
  const items = rows.slice(0, limit).map(row => ({
    id: String(row.id),
    at: new Date(row.created_at).toISOString(),
    client: row.metadata?.client === 'android' ? 'android' : 'web',
    device: (row.user_agent || 'Unknown device').slice(0, 64),
  }));
  return jsonOk({ items, page, hasMore: rows.length > limit });
});

/** Called after successful real authentication by native Android. */
export const POST = withErrorHandling('account.loginHistory.record', async (ctx, request: Request) => {
  const { services, user } = await withUser(request, ctx);
  await enforceRateLimit('login-history:' + user.id, 12, 900);

  // Client platform is classified from the HTTP user-agent by the server, never
  // trusted from a request body. Only a generic device family is retained.
  const ua = request.headers.get('user-agent') || '';
  const android = /Android/i.test(ua) || request.headers.get('x-betvima-client') === 'android';
  const device = android ? 'Android app' : /iPhone|iPad/i.test(ua)
    ? 'iPhone / iPad' : /Windows/i.test(ua) ? 'Windows browser'
    : /Mac OS/i.test(ua) ? 'Mac browser' : /Linux/i.test(ua) ? 'Linux browser'
    : 'Browser';
  await services.db.query(
    `insert into nova.account_events
       (user_id, actor_id, event_key, ip_hash, user_agent, metadata)
     values ($1, $1, 'security.login', $2, $3, $4::jsonb)`,
    [user.id, clientIpFromHeaders(request.headers)
      ? hashSignal(clientIpFromHeaders(request.headers)!) : null, device,
      JSON.stringify({ client: android ? 'android' : 'web', platform: device })],
  );
  return jsonOk({ recorded: true });
});
