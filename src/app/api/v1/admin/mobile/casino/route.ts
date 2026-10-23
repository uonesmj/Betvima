import { z } from 'zod';
import { withErrorHandling, jsonOk } from '@/lib/errors';
import { withAdmin } from '@/server/http/guard';
export const dynamic = 'force-dynamic';

/** Aggregates only finalized casino debit/credit events, grouped by ORIGINAL currency.
 * Never combines USD/IRT amounts or counts provider callbacks as sportsbook wagers.
 */
export const GET = withErrorHandling('admin.mobile.casino',async(ctx,request:Request)=>{
 const {services}=await withAdmin(request,ctx,'reports.view');
 const window=z.enum(['24h','7d','30d']).catch('24h').parse(new URL(request.url).searchParams.get('window'));
 const hours=window==='24h'?24:window==='7d'?168:720;
 const rows=await services.db.query<Record<string,unknown>>(
  "with sources as ("+
  "select 'slot'::text as source,currency,count(*)::bigint as rounds,"+
  "coalesce(sum(bet_minor),0)::bigint as stake_minor,coalesce(sum(win_minor),0)::bigint as payout_minor "+
  "from nova.casino_slot_spins where status='completed' and created_at>=now()-($1::integer*interval '1 hour') group by currency "+
  "union all "+
  "select 'provider'::text as source,wallet_currency as currency,"+
  "count(*) filter(where action='debit')::bigint as rounds,"+
  "coalesce(sum(abs(wallet_amount_minor)) filter(where action='debit'),0)::bigint as stake_minor,"+
  "coalesce(sum(abs(wallet_amount_minor)) filter(where action='credit'),0)::bigint as payout_minor "+
  "from nova.softaggregator_callback_receipts "+
  "where response_error=0 and ledger_transaction_id is not null and rollback is not true "+
  "and action in ('debit','credit') and wallet_currency is not null "+
  "and created_at>=now()-($1::integer*interval '1 hour') group by wallet_currency) "+
  "select source,currency,rounds::text as rounds,stake_minor::text as \"stakeMinor\", "+
  "payout_minor::text as \"payoutMinor\",(stake_minor-payout_minor)::text as \"netMinor\" "+
  "from sources order by source,currency",[hours]);
 return jsonOk({window,totalRounds:rows.reduce((n,r)=>n+Number(r.rounds||0),0),periods:rows,unit:'minor',conversionApplied:false});
});
