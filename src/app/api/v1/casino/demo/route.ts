import { z } from 'zod';
import { NextResponse } from 'next/server';
import { withUser } from '@/server/http/guard';
import { withErrorHandling } from '@/lib/errors';
import { readJson, enforceRateLimit } from '@/server/http/request';
import { casinoEnabled, launchCasinoGame } from '@/server/providers/softaggregator/client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Demo-only sandbox entry point.
 *
 * The demo route does not inspect, require, populate, or change player KYC,
 * verified age or jurisdiction. Crucially, it CANNOT accept a client choice
 * to switch to cash play: the provider request is always getGameDemo.
 *
 * Authentication and the shared launch rate limit remain mandatory.
 */
const schema = z.object({
  gameId: z.string().min(1).max(200),
  device: z.enum(['mobile', 'desktop']).default('mobile'),
  lang: z.enum(['en', 'fa']).default('en'),
}).strict();

export const POST = withErrorHandling('casino.demo', async (ctx, request: Request) => {
  const { user } = await withUser(request, ctx);
  if (!casinoEnabled()) return NextResponse.json({ error: 'CASINO_DISABLED' }, { status: 503 });
  // Share the same bucket as the legacy launch route; no rate-limit bypass.
  await enforceRateLimit('casino:launch:' + user.id, 20, 60);
  const input = await readJson(request, schema, ctx);
  const url = await launchCasinoGame({
    userId: user.id,
    gameId: input.gameId,
    device: input.device,
    lang: input.lang,
    demo: true,
  });
  return NextResponse.json({ ok: true, data: { url, currency: 'USD', demo: true } }, {
    headers: { 'Cache-Control': 'private, no-store' },
  });
});
