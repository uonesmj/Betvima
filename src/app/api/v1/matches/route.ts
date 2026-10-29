import { withErrorHandling, jsonOk } from '@/lib/errors';
import { getBetsApiSport } from '@/server/betsapi-feed';
import { readManualFixtures } from '@/server/manual-fixtures';
import { sportByKey } from '@/lib/betsapi-sports-map';
export const dynamic = 'force-dynamic';
/** BetsAPI remains the only priced provider. Manual fixtures are never wagerable. */
export const GET = withErrorHandling('matches.list', async (_ctx, request: Request) => {
 const p = new URL(request.url).searchParams;
 const mode = p.get('live') === 'true' ? 'live' : 'upcoming';
 const sport = p.get('sport') || 'football';
 const page = Math.max(1, Math.min(100, Number.parseInt(p.get('page') || '1', 10) || 1));
 if (!sportByKey(sport)) return jsonOk({items:[],total:0,page,pageSize:50,hasMore:false,source:'betsapi_bet365'});
 const [data,manual]=await Promise.all([
  getBetsApiSport(mode,sport,page),
  mode==='upcoming'&&page===1?readManualFixtures(sport,25):Promise.resolve([]),
 ]);
 const q = (p.get('q') || '').trim().toLowerCase();
 const all=[...manual,...data.matches];
 const items = q?all.filter(m=>[m.leagueName,...m.participants.map(x=>x.name)].some(v=>(v||'').toLowerCase().includes(q))):all;
 return jsonOk({
  items,total:q?items.length:(data.total===null?null:data.total+manual.length),
  page,pageSize:items.length,manualCount:manual.length,
  hasMore:mode==='upcoming'&&data.pageCount!==null&&page<data.pageCount,
  source:'betsapi_bet365',readOnly:true,error:data.error,
 });
});
