import { getDb } from '@/server/db';
import type { MatchViewPayload } from '@/server/queries/public';

type FixtureRow = { id:string; sport:string; league:string; home:string; away:string; scheduled_at:string };

/** All manual games are catalogue-only; never permit money wagering on these IDs. */
export async function readManualFixtures(sport?:string, limit=20):Promise<MatchViewPayload[]> {
 try {
  const rows=await getDb().query<FixtureRow>(
   "select id,sport,league,home,away,scheduled_at from nova.manual_fixtures "+
   "where status='scheduled' and scheduled_at>=now()-interval '1 hour' "+
   "and scheduled_at<now()+interval '60 days' "+
   (sport?"and sport=$1 ":"")+"order by scheduled_at asc limit "+Math.min(40,Math.max(1,limit)),
   sport?[sport==='ice-hockey'?'hockey':sport]:[]);
  type MarketRow={fixture_id:string;id:string;market_key:string;title:string;version:number;
   selections:{label:string;decimal:string}[]};
  let allMarkets:MarketRow[]=[];
  if(rows.length>0) {
    try {
      allMarkets=await getDb().query<MarketRow>(
        `select fixture_id::text,id::text,market_key,title,version,selections
         from nova.manual_fixture_markets where fixture_id=any($1::uuid[])
         and status='visible' order by created_at asc limit 200`,[rows.map(r=>r.id)]);
    } catch(error) {
      // During independently approved rolling migrations keep the fixtures visible.
      console.warn('[manual fixtures] preview markets temporarily unavailable');
    }
  }
  const marketByFixture=new Map<string,MarketRow[]>();
  for(const market of allMarkets) {
    const grouped=marketByFixture.get(market.fixture_id)||[];
    grouped.push(market); marketByFixture.set(market.fixture_id,grouped);
  }
  return rows.map(r=>({
   id:'manual:'+r.id,betsApiEventId:null,
   sportKey:r.sport==='hockey'?'ice-hockey':r.sport,
   leagueId:null,leagueName:r.league,leagueLogoUrl:null,countryCode:null,
   status:'scheduled',scheduledAt:r.scheduled_at,minute:null,period:null,
   clockSeconds:null,clockRunning:false,clockObservedAt:null,
   homeScore:null,awayScore:null,isLive:false,isBettingAvailable:false,
   participants:[
    {teamId:'',role:'HOME',name:r.home,logoUrl:null},
    {teamId:'',role:'AWAY',name:r.away,logoUrl:null},
   ],
   // Preview market IDs are deliberately prefixed: no UUID can reach quote/place APIs.
   marketsCount:(marketByFixture.get(r.id)||[]).length,
   topMarkets:(marketByFixture.get(r.id)||[]).slice(0,8).map(m=>({
     id:'manual-preview:'+m.id,key:'manual_preview_'+m.market_key,
     name:m.title,status:'suspended',
     selections:m.selections.map((sel,i)=>({
       id:'manual-preview:'+m.id+':'+i,code:String(i),name:sel.label,
       oddsScaled:(BigInt(Math.round(Number(sel.decimal)*10000))).toString(),
       previousOddsScaled:null,status:'suspended',movement:'STABLE' as const,
       oddsVersion:m.version,
     })),
   })),
  }));
 } catch (e) {
  console.warn('[manual fixtures] read unavailable',e instanceof Error?e.message:'unknown');
  return [];
 }
}
