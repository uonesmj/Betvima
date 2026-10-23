import { z } from 'zod';
import { NextResponse } from 'next/server';
import { withUser } from '@/server/http/guard';
import { withErrorHandling } from '@/lib/errors';
import { readJson, enforceRateLimit } from '@/server/http/request';
import { casinoEnabled, launchCasinoGame } from '@/server/providers/softaggregator/client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Demo-only entry point; no wallet settlement or mandatory ID upload. */
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
    device: input.device ?? 'mobile',
    lang: input.lang ?? 'en',
    demo: true,
  });
  return NextResponse.json({ ok: true, data: { url, currency: 'USD', demo: true } }, {
    headers: { 'Cache-Control': 'private, no-store' },
  });
});
