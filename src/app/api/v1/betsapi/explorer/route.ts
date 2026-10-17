import { z } from 'zod';
import { jsonOk, withErrorHandling } from '@/lib/errors';
import { withAdmin } from '@/server/http/guard';
import { readJson, enforceRateLimit } from '@/server/http/request';
import { exploreBetsApi, type ExplorerInput } from '@/providers/betsapi-explorer';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

const inputSchema = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{12,180}$/).optional(),
  mode: z.enum(['live', 'upcoming']),
  sportId: z.number().int().positive(),
  page: z.number().int().min(1).max(100).optional(),
  fi: z.string().regex(/^\d{1,16}$/).optional(),
});
type Input = z.infer<typeof inputSchema>;
const options = (x: Input): ExplorerInput => ({
  mode: x.mode, sportId: x.sportId, page: x.page, fi: x.fi,
});

/**
 * Public catalogue only when owner explicitly enables a server-held private
 * token. Otherwise the user can see the available sports and the read-only
 * placeholder, without consuming the trial key.
 */
export const GET = withErrorHandling('betsapi.explore.public', async (_ctx, request: Request) => {
  const u = new URL(request.url);
  const input = inputSchema.omit({ token: true }).safeParse({
    mode: u.searchParams.get('mode') ?? 'live',
    sportId: Number(u.searchParams.get('sportId') ?? '1'),
    page: Number(u.searchParams.get('page') ?? '1'),
    fi: u.searchParams.get('fi') || undefined,
  });
  if (!input.success) return jsonOk({ error: 'INVALID_FILTER', readOnly: true });
  const token = process.env.BETSAPI_PUBLIC_PREVIEW_ENABLED === 'true' &&
    process.env.BETSAPI_TRIAL_ENABLED === 'true'
    ? process.env.BETSAPI_TRIAL_TOKEN : null;
  return jsonOk(await exploreBetsApi(token, options(input.data)));
});

/**
 * One-time admin session inspection: token stays in this HTTPS request,
 * and in the browser's volatile React state while the page stays open.
 * No credentials are saved in source, cookies, DB, APK, server state or logs.
 */
export const POST = withErrorHandling('betsapi.explore.admin', async (ctx, request: Request) => {
  const { user } = await withAdmin(request, ctx, 'settings.view');
  // Require same-origin for stateful admin token submission.
  const origin = request.headers.get('origin');
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') ||
    new URL(request.url).host;
  if (origin && (new URL(origin).host !== host || new URL(origin).protocol !== 'https:')) {
    return jsonOk({ error: 'FORBIDDEN_ORIGIN', readOnly: true });
  }
  await enforceRateLimit(`betsapi-explorer-${user.id}`, 180, 3600);
  const input = await readJson(request, inputSchema, ctx);
  const token = input.token || (process.env.BETSAPI_TRIAL_ENABLED === 'true'
    ? process.env.BETSAPI_TRIAL_TOKEN : null);
  return jsonOk(await exploreBetsApi(token, options(input)));
});
