import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { withErrorHandling, jsonOk } from '@/lib/errors';
import { withUser } from '@/server/http/guard';
import { readJson, enforceRateLimit } from '@/server/http/request';
import { BetsApiEventsProvider } from '@/providers/betsapi-events-provider';
import { compareBet365PreviewPrice } from '@/providers/betsapi-price-change-preview';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const schema = z.object({
  fi: z.string().regex(/^\d{1,16}$/),
  mode: z.enum(['live', 'upcoming']),
  marketId: z.string().regex(/^bet365:\d{1,16}:[A-Za-z0-9:_-]{1,120}$/),
  selectionId: z.string().min(1).max(260),
  previouslySeenOdds: z.string().min(1).max(24),
});

function serverToken(): string {
  const env = process.env.BETSAPI_TRIAL_TOKEN?.trim();
  if (env && /^[A-Za-z0-9_-]{12,180}$/.test(env)) return env;
  try {
    const value = readFileSync('/etc/betvima/betsapi-token', 'utf8').trim();
    return /^[A-Za-z0-9_-]{12,180}$/.test(value) ? value : '';
  } catch { return ''; }
}

/** Fetch fresh bookmaker odds for display/reconfirmation only.
 * Never constructs a canonical wager quote, places a bet, or deducts funds.
 */
export const POST = withErrorHandling('betsapi.preview.quote', async (ctx, request: Request) => {
  const { user } = await withUser(request, ctx);
  await enforceRateLimit('betsapi-preview-quote:' + user.id, 30, 60);
  const input = await readJson(request, schema, ctx);
  if (input.marketId.split(':')[1] !== input.fi ||
      !input.selectionId.startsWith(input.marketId + ':')) {
    return jsonOk({ readOnly: true, executable: false, state: 'unavailable', reason: 'IDENTITY_UNVERIFIED' });
  }
  const provider = new BetsApiEventsProvider(serverToken());
  if (!provider.configured) {
    return jsonOk({ readOnly: true, executable: false, state: 'unavailable', reason: 'NOT_CONFIGURED' });
  }
  const catalogue = await provider.fetchBet365Catalogue(input.fi, input.mode);
  if (!catalogue.ok || !catalogue.value) {
    return jsonOk({ readOnly: true, executable: false, state: 'unavailable', reason: 'PRICE_SOURCE_UNAVAILABLE' });
  }
  const decision = compareBet365PreviewPrice(
    catalogue.value, input.marketId, input.selectionId, input.previouslySeenOdds,
  );
  return jsonOk({ readOnly: true, ...decision });
});
