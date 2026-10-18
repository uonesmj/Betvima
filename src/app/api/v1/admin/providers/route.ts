import { withErrorHandling, jsonOk } from '@/lib/errors';
import { withAdmin } from '@/server/http/guard';
import { createServices } from '@/server/services/container';

export const dynamic = 'force-dynamic';

/** Honest provider state: configured / reachable / required env vars / notes. */
export const GET = withErrorHandling('admin.providers', async (ctx, request: Request) => {
  await withAdmin(request, ctx, 'settings.view');
  const services = createServices();
  const statuses = await services.providers.statuses();
  const rows = await services.db.query<Record<string, unknown>>(
    `select provider, kind, status, last_success_at, last_error_at, last_error, consecutive_failures, latency_ms, metadata, updated_at
       from nova.provider_health
       where kind <> 'sports' or provider = 'disabled'
       order by kind, provider`,
  );
  return jsonOk({ statuses, health: rows });
});
