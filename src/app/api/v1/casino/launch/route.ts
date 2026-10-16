import { z } from 'zod';
import { NextResponse } from 'next/server';
import { withUser } from '@/server/http/guard';
import { withErrorHandling } from '@/lib/errors';
import { readJson, enforceRateLimit } from '@/server/http/request';
import { casinoEnabled, casinoRealMoneyUserAllowed, launchCasinoGame } from '@/server/providers/softaggregator/client';
import { casinoPlayerMayLaunch } from '@/server/providers/softaggregator/wallet';
import { verifiedCasinoLocation } from '@/server/providers/softaggregator/edge-location';

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
  let verifiedCountry: string | undefined;
  if (!demo) {
    // Account country is not proof of present physical location.
    const currentCountry = verifiedCasinoLocation(request);
    if (!currentCountry) {
      return NextResponse.json({ error: 'CASINO_GEO_VERIFICATION_REQUIRED' }, {
        status: 403, headers: { 'Cache-Control': 'no-store' },
      });
    }
    // Do not permanently bind the native wallet before geo is verified.
    const policy = await casinoPlayerMayLaunch(user.id);
    if (policy.country !== currentCountry) {
      return NextResponse.json({ error: 'CASINO_COUNTRY_MISMATCH' }, {
        status: 403, headers: { 'Cache-Control': 'no-store' },
      });
    }
    await casinoPlayerMayLaunch(user.id, true);
    verifiedCountry = currentCountry;
  }
  const url = await launchCasinoGame({
    userId: user.id, gameId: input.gameId, demo,
    device, lang, country: verifiedCountry,
  });
  return NextResponse.json({ ok: true, data: { url, currency: 'USD', demo } },
    { headers: { 'Cache-Control': 'no-store' } });
});
