import { z } from 'zod';
import { jsonOk, withErrorHandling, ApiError } from '@/lib/errors';
import { readJson, enforceRateLimit } from '@/server/http/request';
import { withAdmin } from '@/server/http/guard';
import { inspectBetsApiTrial, runBetsApiTrial } from '@/providers/betsapi-trial';

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

/**
 * One-time urgent trial probe without requiring SSH/VPS env changes.
 * The rotated token is supplied over HTTPS by an authenticated site admin,
 * used in memory for THIS request only, never persisted to a database,
 * environment variable, client bundle, error object, or application log.
 * This is read-only. The sportsbook's real wagering source is unchanged.
 */
const tokenInput = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{12,180}$/, 'Invalid token format'),
});
let lastTryAt = 0;
export const POST = withErrorHandling('admin.betsapi.trial.once', async (ctx, request: Request) => {
  const { user } = await withAdmin(request, ctx, 'settings.view');
  const origin = request.headers.get('origin');
  if (origin) {
    const source = new URL(origin);
    const canonicalHost = request.headers.get('x-forwarded-host') ??
      request.headers.get('host') ?? new URL(request.url).host;
    if (source.protocol !== 'https:' || source.host !== canonicalHost) {
      throw new ApiError('FORBIDDEN', 'Same-origin secure administration required');
    }
  }
  await enforceRateLimit(`betsapi-trial-${user.id}`, 6, 3600);
  if (Date.now() - lastTryAt < 15_000) {
    throw new ApiError('RATE_LIMITED', 'Wait before the next trial coverage check');
  }
  // Mark before beginning remote calls so concurrent browser tabs cannot
  // bypass the basic per-instance burst guard.
  lastTryAt = Date.now();
  const body = await readJson(request, tokenInput, ctx);
  return jsonOk(await runBetsApiTrial(body.token));
});
