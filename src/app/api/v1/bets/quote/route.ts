import { z } from 'zod';
import { withErrorHandling, jsonOk } from '@/lib/errors';
import { readJson, enforceRateLimit } from '@/server/http/request';
import { withUser } from '@/server/http/guard';

export const dynamic = 'force-dynamic';

const legSchema = z.object({
  matchId: z.string().uuid(), marketId: z.string().uuid(), selectionId: z.string().uuid(),
  clientOddsScaled: z.string().regex(/^\d{1,12}$/).nullable().default(null),
  marketVersion: z.number().int().nullable().default(null),
  acceptOddsChange: z.boolean().default(false),
});
const bodySchema = z.object({
  type: z.enum(['SINGLE', 'MULTIPLE']),
  stakeMinor: z.string().regex(/^\d{1,19}$/),
  currency: z.enum(['IRT', 'IRR', 'USD', 'EUR', 'GBP']),
  legs: z.array(legSchema).min(1).max(20),
  systemSelections: z.array(z.number().int()).optional(),
  acceptWarnings: z.boolean().optional(),
});

/** Authoritative price for the slip. Returns every odds change the user must accept. */
export const POST = withErrorHandling('bets.quote', async (ctx, request: Request) => {
  const { services, user, actor } = await withUser(request, ctx);
  await enforceRateLimit(`quote:${user.id}`, 120, 60);
  const body = await readJson(request, bodySchema, ctx);
  const quote = await services.bettingService.quote({
    actor, userId: user.id, currency: body.currency,
    slip: {
      type: body.type, stakeMinor: BigInt(body.stakeMinor), currency: body.currency,
      legs: body.legs.map((l) => ({
        matchId: l.matchId, marketId: l.marketId, selectionId: l.selectionId,
        clientOddsScaled: l.clientOddsScaled == null ? null : BigInt(l.clientOddsScaled),
        marketVersion: l.marketVersion ?? null, acceptOddsChange: l.acceptOddsChange ?? false,
      })),
      systemSelections: body.systemSelections, acceptWarnings: body.acceptWarnings,
    },
  });
  return jsonOk({ quote: serializeQuote(quote) });
});

function serializeQuote(quote: { combinedOddsScaled: bigint; potentialPayoutMinor: bigint; stakeMinor: bigint; maxPayout: bigint; oddsChanges: { previousOddsScaled: bigint; currentOddsScaled: bigint }[] }) {
  return {
    ...quote,
    stakeMinor: quote.stakeMinor.toString(),
    combinedOddsScaled: quote.combinedOddsScaled.toString(),
    potentialPayoutMinor: quote.potentialPayoutMinor.toString(),
    // Explicit minor-unit amounts for native clients: odds are a multiplier,
    // not a currency value. Returns include the original stake.
    potentialReturnMinor: quote.potentialPayoutMinor.toString(),
    potentialProfitMinor: (quote.potentialPayoutMinor - quote.stakeMinor).toString(),
    maxPayout: quote.maxPayout.toString(),
    oddsChanges: quote.oddsChanges.map((c) => ({
      ...c, previousOddsScaled: c.previousOddsScaled.toString(), currentOddsScaled: c.currentOddsScaled.toString(),
    })),
  };
}
