import { z } from 'zod';
import { NextResponse } from 'next/server';
import { withUser } from '@/server/http/guard';
import { withErrorHandling } from '@/lib/errors';
import { readJson, enforceRateLimit } from '@/server/http/request';
import { casinoEnabled, casinoRealMoneyUserAllowed, launchCasinoGame } from '@/server/providers/softaggregator/client';
import { casinoPlayerMayLaunch } from '@/server/providers/softaggregator/wallet';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const schema = z.object({
  gameId: z.string().min(1).max(200),
  demo: z.boolean().default(true),
  device: z.enum(['mobile', 'desktop']).default('mobile'),
  lang: z.enum(['en', 'fa']).default('en'),
});

export const POST = withErrorHandling('casino.launch', async (ctx, request: Request) => {
  const { user } = await withUser(request, ctx);
  if (!casinoEnabled()) return NextResponse.json({ error: 'CASINO_DISABLED' }, { status: 503 });
  await enforceRateLimit('casino:launch:' + user.id, 20, 60);
  const input = await readJson(request, schema, ctx);
  const demo = input.demo ?? true;
  const device = input.device ?? 'mobile';
  const lang = input.lang ?? 'en';
  if (!demo && !casinoRealMoneyUserAllowed(user.id)) {
    return NextResponse.json({ error: 'CASINO_REAL_MONEY_DISABLED' }, { status: 503 });
  }
  const eligibility = demo ? null : await casinoPlayerMayLaunch(user.id);
  const url = await launchCasinoGame({
    userId: user.id, gameId: input.gameId, demo,
    device, lang, country: eligibility?.country,
  });
  return NextResponse.json({ ok: true, data: { url, currency: 'USD', demo } },
    { headers: { 'Cache-Control': 'no-store' } });
});
