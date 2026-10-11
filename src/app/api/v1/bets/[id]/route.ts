import { withErrorHandling, jsonOk } from '@/lib/errors';
import { ApiError } from '@/lib/errors';
import { withUser } from '@/server/http/guard';
import { serializeBet } from '@/server/http/serialize';

export const dynamic = 'force-dynamic';

/** Single bet with settlement detail; customers only ever see their own. */
export const GET = withErrorHandling('bets.get', async (ctx, request: Request, params: { params: Promise<{ id: string }> }) => {
  const { id } = await params.params;
  const { services, user, actor } = await withUser(request, ctx);
  const bet = await services.betting.getBet(actor, id, user.isAdmin ? null : user.id);
  if (!bet) throw new ApiError('BET_NOT_FOUND');
  const settlements = await services.db.query<Record<string, unknown>>(
    `select id, revision, kind, status_before, status_after, payout_minor, net_user_result_minor, reversal_of, reversed_by, created_at
       from nova.bet_settlements where bet_id = $1 order by revision asc`,
    [bet.id],
  );
  return jsonOk({ bet: serializeBet(bet), settlements });
});
