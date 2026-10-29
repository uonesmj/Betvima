import { jsonOk, withErrorHandling } from '@/lib/errors';
import { getDb } from '@/server/db';

export const dynamic='force-dynamic';
export const runtime='nodejs';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Public display only. No internal betting IDs or tradable selections are exposed. */
export const GET=withErrorHandling('manual.markets.preview',async(_ctx,request:Request)=>{
 const id=new URL(request.url).pathname.split('/').at(-2)??'';
 if(!uuid.test(id))return jsonOk({items:[],bettingAvailable:false});
 const items=await getDb().query<{
   marketKey:string;title:string;line:string|null;
   selections:{label:string;decimal:string}[];
 }>(`select m.market_key as "marketKey",m.title,m.line,m.selections
 from nova.manual_fixture_markets m join nova.manual_fixtures f on f.id=m.fixture_id
 where m.fixture_id=$1 and m.status='visible'
   and f.status='scheduled' and f.scheduled_at > now() - interval '1 hour'
 order by m.created_at asc limit 80`,[id]);
 return jsonOk({items:items.map(m=>({
  key:m.marketKey,title:m.title,line:m.line,
  status:'preview',isBettingAvailable:false,
  selections:m.selections.map(s=>({label:s.label,decimal:s.decimal,status:'suspended'})),
 })),bettingAvailable:false});
});
