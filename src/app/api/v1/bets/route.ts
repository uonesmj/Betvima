import { z } from 'zod';
import { NextResponse } from 'next/server';
import { ApiError, withErrorHandling, jsonOk, jsonCreated } from '@/lib/errors';
import { readJson, enforceRateLimit, idempotencyKeyFrom, intParam, searchParams } from '@/server/http/request';
import { withUser } from '@/server/http/guard';
import { serializeBet } from '@/server/http/serialize';
import type { BetFilter } from '@/lib/types';

export const dynamic = 'force-dynamic';

const legSchema = z.object({
  matchId: z.string().uuid(), marketId: z.string().uuid(), selectionId: z.string().uuid(),
  clientOddsScaled: z.string().regex(/^\d{1,12}$/).nullable().default(null),
  marketVersion: z.number().int().nullable().default(null),
  acceptOddsChange: z.boolean().default(false),
});
const placeSchema = z.object({
  type: z.enum(['SINGLE', 'MULTIPLE']),
  stakeMinor: z.string().regex(/^\d{1,19}$/),
  currency: z.enum(['IRT', 'IRR', 'USD', 'EUR', 'GBP']),
  fundingSource: z.enum(['main', 'bonus']).optional().default('main'),
  bonusGrantId: z.string().uuid().nullable().optional().default(null),
  legs: z.array(legSchema).min(1).max(20),
  acceptWarnings: z.boolean().optional(),
  quoteToken: z.string().min(10).max(8192).nullable().optional(),
  acceptedOdds: z.record(z.string().regex(/^\d{1,12}$/)).optional(),
});

/** Place a bet. Requires an Idempotency-Key and explicit acceptance of any odds change. */
export const POST = withErrorHandling('bets.place', async (ctx, request: Request) => {
  const { services, user, actor } = await withUser(request, ctx);
  const idempotencyKey = idempotencyKeyFrom(request);
  await enforceRateLimit(`place:${user.id}`, 60, 60);
  const body = await readJson(request, placeSchema, ctx);
  const result = await services.bettingService.place({
    actor, userId: user.id, currency: body.currency, idempotencyKey,
    quoteToken: body.quoteToken ?? null, acceptedOdds: body.acceptedOdds ?? {},
    slip: {
      type: body.type, stakeMinor: BigInt(body.stakeMinor), currency: body.currency,
      fundingSource: body.fundingSource,
      bonusGrantId: body.bonusGrantId,
      legs: body.legs.map((l) => ({
        matchId: l.matchId, marketId: l.marketId, selectionId: l.selectionId,
        clientOddsScaled: l.clientOddsScaled == null ? null : BigInt(l.clientOddsScaled),
        marketVersion: l.marketVersion ?? null, acceptOddsChange: l.acceptOddsChange ?? false,
      })),
      acceptWarnings: body.acceptWarnings,
    },
  });
  const status = result.status === 'idempotent_replay' ? 200 : 201;
  void result.quote;
  const payload = {
    bet: serializeBet(result.bet),
    balanceAfterMinor: result.balanceAfterMinor.toString(),
    idempotentReplay: result.status === 'idempotent_replay',
  };
  return NextResponse.json({ ok: true, data: payload }, status === 200 ? { status: 200 } : { status: 201 });
});

/** Bet history (customer's own bets unless an admin asks for someone else's). */
export const GET = withErrorHandling('bets.list', async (ctx, request: Request) => {
  const { services, user, actor } = await withUser(request, ctx);
  const params = searchParams(request);
  const requestedUser = params.get('userId');
  if (requestedUser && requestedUser !== user.id && !user.isAdmin) throw new ApiError('FORBIDDEN', 'Cannot read another customer\'s bets');
  const status = params.get('status');
  const filter: BetFilter = {
    userId: requestedUser ?? user.id,
    status: status ? (status.split(',') as BetFilter['status']) : undefined,
    type: (params.get('type') as BetFilter['type']) ?? undefined,
    from: params.get('from') ?? undefined, to: params.get('to') ?? undefined,
    search: params.get('q') ?? undefined,
    page: intParam(params, 'page', 1, 1000), pageSize: intParam(params, 'pageSize', 20, 50),
    sortBy: (params.get('sortBy') as BetFilter['sortBy']) ?? 'placed_at',
    sortDirection: (params.get('sortDirection') as 'asc' | 'desc') ?? 'desc',
  };
  const page = await services.betting.listBets(actor, filter);
  return jsonOk({ ...page, items: page.items.map(serializeBet) });
});
