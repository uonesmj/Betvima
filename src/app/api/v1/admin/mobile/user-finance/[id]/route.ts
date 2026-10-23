import { z } from 'zod';
import { withErrorHandling, jsonOk, ApiError } from '@/lib/errors';
import { withAdmin } from '@/server/http/guard';

export const dynamic = 'force-dynamic';

/** Group only settled, successful payment amounts by user and original currency.
 * Never disclose other users through the mobile app, and never add unlike currencies.
 */
export const GET = withErrorHandling('admin.mobile.user_finance', async (
  ctx, request:Request, params:{params:Promise<{id:string}>},
)=>{
 const {services}=await withAdmin(request,ctx,'payments.view');
 const id=z.string().uuid().safeParse((await params.params).id);
 if(!id.success)throw new ApiError('VALIDATION_FAILED','Invalid user ID');
 const totals=await services.db.query<Record<string,unknown>>(
  "select type::text as type,currency,count(*)::text as count,"+
  "coalesce(sum(amount_minor),0)::text as \"amountMinor\" "+
  "from nova.payment_transactions where user_id=$1 and status='succeeded' "+
  "group by type,currency order by type,currency",
  [id.data],
 );
 return jsonOk({userId:id.data,totals,onlySucceeded:true,currencyConversion:false});
});
