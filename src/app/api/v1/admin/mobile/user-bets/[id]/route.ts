import { z } from 'zod';
import { ApiError, jsonOk, withErrorHandling } from '@/lib/errors';
import { withAdmin } from '@/server/http/guard';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const uuid = z.string().uuid();
const iso = (v: unknown) => v == null ? null : v instanceof Date ? v.toISOString() : String(v);
const val = (v: unknown) => v == null ? null : String(v);

/** Read-only, user-scoped bet timeline: no cross-user results, no FX dependency. */
export const GET = withErrorHandling('admin.mobile.user_bets', async (
  ctx, request: Request, params: { params: Promise<{ id: string }> },
) => {
  const { services } = await withAdmin(request, ctx, 'bets.view');
  const { id } = await params.params;
  if (!uuid.safeParse(id).success) throw new ApiError('VALIDATION_FAILED','Invalid player ID');
  const url = new URL(request.url);
  const status = z.enum(['all','open','closed']).catch('all').parse(url.searchParams.get('status'));
  const page = z.coerce.number().int().min(1).max(500).catch(1).parse(url.searchParams.get('page'));
  const player = await services.db.queryOne<{ id: string }>(
    "select id from nova.profiles where id=$1 and role::text in ('user','affiliate')",[id]);
  if (!player) throw new ApiError('NOT_FOUND','Player not found');
  const rows = await services.db.query<Record<string,unknown>>(
    `select b.id,b.public_id,b.type::text as type,b.status::text as status,
            b.currency,b.stake_minor,b.potential_payout_minor,b.payout_minor,
            b.combined_odds_scaled,b.placed_at,b.settled_at,b.device,
            coalesce(legs.entries,'[]'::jsonb) as legs,
            placed.balance_after_minor as balance_after_placement_minor,
            placed.balance_after_minor + b.stake_minor as balance_before_placement_minor
       from nova.bets b
       left join lateral (
         select jsonb_agg(jsonb_build_object(
           'match',bl.match_label,'market',bl.market_name,
           'selection',bl.selection_name,'oddsScaled',bl.accepted_odds,
           'status',bl.status::text,'settledAt',bl.settled_at,
           'gradeReason',bl.grade_reason,'voidReason',bl.void_reason
         ) order by bl.created_at,bl.id) as entries
         from nova.bet_legs bl where bl.bet_id=b.id
       ) legs on true
       left join lateral (
         select wt.balance_after_minor
           from nova.wallet_transactions wt
          where wt.bet_id=b.id and wt.type::text='bet_debit'
            and wt.status::text='posted' and wt.currency=b.currency
          order by wt.created_at asc limit 1
       ) placed on true
      where b.user_id=$1
        and ($2::text='all' or
          ($2::text='open' and b.status::text in ('accepted','partially_settled','manual_review')) or
          ($2::text='closed' and b.status::text not in ('accepted','partially_settled','manual_review')))
      order by b.placed_at desc,b.id desc limit 21 offset $3`,
    [id,status,(page-1)*20],
  );
  return jsonOk({
    userId:id,status,page,hasMore:rows.length>20,
    items:rows.slice(0,20).map((r)=>({
      id:r.id, publicId:r.public_id,type:r.type,status:r.status,currency:r.currency,
      stakeMinor:val(r.stake_minor),potentialPayoutMinor:val(r.potential_payout_minor),
      payoutMinor:val(r.payout_minor),combinedOddsScaled:val(r.combined_odds_scaled),
      placedAt:iso(r.placed_at),settledAt:iso(r.settled_at),device:val(r.device),
      balanceBeforePlacementMinor:val(r.balance_before_placement_minor),
      balanceAfterPlacementMinor:val(r.balance_after_placement_minor),
      legs:r.legs,
    })),
  });
});
