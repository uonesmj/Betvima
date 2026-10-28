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
   marketsCount:0,topMarkets:[],
  }));
 } catch (e) {
  console.warn('[manual fixtures] read unavailable',e instanceof Error?e.message:'unknown');
  return [];
 }
}
