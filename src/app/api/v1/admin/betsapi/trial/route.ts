import { jsonOk, withErrorHandling } from '@/lib/errors';
import { withAdmin } from '@/server/http/guard';
import { inspectBetsApiTrial } from '@/providers/betsapi-trial';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Trial-only coverage check. No provider token is accepted from the client,
 * returned in the JSON, persisted in the DB, or exposed to the APK.
 */
export const GET = withErrorHandling('admin.betsapi.trial', async (ctx, request: Request) => {
  await withAdmin(request, ctx, 'settings.view');
  return jsonOk(await inspectBetsApiTrial());
});
