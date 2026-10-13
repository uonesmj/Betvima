/**
 * Dedicated football metadata/statistics consumer for 5Dollar.
 *
 * DOES NOT IMPORT THE ODDS WORKER, FETCH ODDS, WRITE MARKETS/SELECTIONS,
 * OR INVOKE SETTLEMENT. Source-authentic football only.
 *
 * Existing Odds API matches can be linked only with exact sport/league/team
 * identities and +/-10m kickoff tolerance. Their status/scores/financial
 * state is deliberately not modified. Unmatched games are information-only.
 */
import type { Db } from '@/lib/ports/db';
import type { ProviderMatch } from '@/lib/ports/providers';
import { FiveDollarFootballApiSportsProvider } from '@/providers/5dollar-football-api';
import { createWorker } from './runtime';
import {
  MATCH_SOURCE_FALLBACK, MATCH_SOURCE_ODDS,
  linkCrossProviderMatch, attachProviderMatchIdentity,
  resolveFiveDollarMatchRows, fiveDollarProviderEventId,
  normalizeMatchIdentity,
} from './sports-provider-sync';

const provider = new FiveDollarFootballApiSportsProvider();
const MAX_LIVE_PER_CYCLE = 80;
const MAX_CATALOG_PER_CYCLE = 180;
const CATALOG_INTERVAL_MS = 4 * 60_000;
const FOOTBALL_DAY = 86_400_000;
// New and upcoming fixtures first, then rotate across seven days of history.
const CATALOG_DAY_OFFSETS = [0, 1, 2, 3, 4, 5, 6, 7, -1, -2, -3, -4, -5, -6, -7];

let lastCatalogStart = 0;
let catalogDayIndex = 0;
let liveOffset = 0;
const catalogOffsets = new Map<number, number>();

export function fixtureHasDetails(match: ProviderMatch): boolean {
  const stats = match.liveStats;
  const hasStats = !!stats && typeof stats === 'object' &&
    Object.values(stats).some((value) => value != null && typeof value === 'object');
  return hasStats || !!match.liveEvents?.length;
}

function safeStatus(status: string): string {
  return ['scheduled','live','paused','finished','postponed','cancelled','abandoned','interrupted','rescheduled'].includes(status)
    ? status : 'scheduled';
}

function validFixture(match: ProviderMatch): boolean {
  const startsAt = Date.parse(match.scheduledAt);
  return match.sport === 'football' &&
    Number.isFinite(startsAt) && !!match.providerId?.trim() &&
    !!normalizeMatchIdentity(match.homeTeamName) &&
    !!normalizeMatchIdentity(match.awayTeamName) &&
    normalizeMatchIdentity(match.homeTeamName) !== normalizeMatchIdentity(match.awayTeamName);
}

function slug(value: string): string {
  return normalizeMatchIdentity(value).replace(/\s+/g, '-') || 'unknown';
}

async function persistFixture(db: Db, match: ProviderMatch): Promise<string | null> {
  if (!validFixture(match)) return null;
  const already = await resolveFiveDollarMatchRows(db, [match.providerId]);
  if (already.length) {
    const row = already[0]!;
    // Do not override Odds API-owned matches or matches with betting markets:
    // their status is coupled to bet placement/settlement.
    if (row.match_provider === MATCH_SOURCE_FALLBACK) {
      await db.query(
        `update nova.matches m set
             status = case
               when m.status::text='finished' and $2='scheduled' then m.status
               else $2::nova.match_status end,
             home_score=coalesce($3,m.home_score),
             away_score=coalesce($4,m.away_score),
             minute=coalesce($5,m.minute),
             period=coalesce($6,m.period),
             scheduled_at=$7::timestamptz,
             provider_updated_at=now(),updated_at=now()
           where m.id=$1 and m.provider=$8
             and not exists(select 1 from nova.markets mk where mk.match_id=m.id)`,
        [row.match_id, safeStatus(match.status), match.homeScore, match.awayScore,
         match.minute, match.period, match.scheduledAt, MATCH_SOURCE_FALLBACK],
      );
    }
    return row.match_id;
  }
  const matched = await linkCrossProviderMatch(
    db, match, MATCH_SOURCE_FALLBACK, MATCH_SOURCE_ODDS,
  );
  if (matched.status === 'linked') return matched.matchId;
  if (matched.status === 'conflict') return null;

  const football = await db.queryOne<{id:string}>(
    `select id from nova.sports where slug='football' limit 1`);
  if (!football) throw new Error('FOOTBALL_SPORT_ROW_MISSING');

  const leagueKey = match.leagueProviderId?.trim() ||
    'unknown-' + slug(match.leagueName ?? 'football');
  const league = await db.queryOne<{id:string}>(
    `insert into nova.leagues(sport_id,slug,name,name_fa,tier,is_active)
       values($1,$2,$3,$3,1,true)
       on conflict (sport_id,slug) do update set
         name=excluded.name,is_active=true,updated_at=now()
       returning id`,
    [football.id, 'fd-'+leagueKey, match.leagueName || leagueKey],
  );
  if (!league) throw new Error('FIVEDOLLAR_LEAGUE_UPSERT_FAILED');

  const upsertTeam = async (side: 'home'|'away'): Promise<string> => {
    const name = side==='home' ? match.homeTeamName : match.awayTeamName;
    const id = side==='home' ? match.homeTeamProviderId : match.awayTeamProviderId;
    const team = await db.queryOne<{id:string}>(
      `insert into nova.teams(sport_id,slug,name,name_fa)
        values($1,$2,$3,$3)
        on conflict (sport_id,slug) do update set name=excluded.name,updated_at=now()
        returning id`,
      [football.id, 'fd-'+(id?.trim() || slug(name)), name],
    );
    if (!team) throw new Error('FIVEDOLLAR_TEAM_UPSERT_FAILED');
    return team.id;
  };
  const homeId = await upsertTeam('home');
  const awayId = await upsertTeam('away');
  if (homeId === awayId) return null;

  const created = await db.queryOne<{id:string}>(
    `insert into nova.matches
       (sport_id,league_id,home_team_id,away_team_id,status,home_score,
        away_score,minute,period,scheduled_at,provider,provider_id,provider_updated_at)
     values($1,$2,$3,$4,$5::nova.match_status,$6,$7,$8,$9,$10::timestamptz,$11,$12,now())
     on conflict (provider,provider_id)
       where provider is not null and provider_id is not null
       do nothing returning id`,
    [football.id, league.id, homeId, awayId, safeStatus(match.status),
     match.homeScore, match.awayScore, match.minute, match.period,
     match.scheduledAt, MATCH_SOURCE_FALLBACK, match.providerId],
  );
  let internalId = created?.id ?? null;
  if (!internalId) {
    const existing = await db.queryOne<{id:string}>(
      `select id from nova.matches where provider=$1 and provider_id=$2 limit 1`,
      [MATCH_SOURCE_FALLBACK, match.providerId]);
    internalId = existing?.id ?? null;
  }
  if (internalId) {
    const linked = await attachProviderMatchIdentity(db, MATCH_SOURCE_FALLBACK, match.providerId, internalId);
    if (!linked) return null;
  }
  return internalId;
}

function teamStats(raw: unknown, side: 'home'|'away') {
  const result: Array<{type:string;value:string|null}> = [];
  if (!raw || typeof raw!=='object') return result;
  for (const [key, category] of Object.entries(raw)) {
    if (!category || typeof category!=='object') continue;
    const val=(category as Record<string,unknown>)[side];
    if (val == null) continue;
    if (typeof val==='object') {
      for (const [subkey,v] of Object.entries(val as Record<string,unknown>)) {
        if (v != null && (typeof v==='string'||typeof v==='number')) {
          result.push({type:key+'_'+subkey,value:String(v)});
        }
      }
    } else if(typeof val==='number'||typeof val==='string') {
      result.push({type:key,value:String(val)});
    }
  }
  return result;
}

async function persistDetails(db:Db, match:ProviderMatch, id:string):Promise<void> {
  if (!fixtureHasDetails(match)) return;
  const observedAt = new Date().toISOString();
  const statistics = {
    fixtureId:match.providerId,observedAt,
    teams:[
      {providerTeamId: match.homeTeamProviderId??null,teamName:match.homeTeamName,
        statistics:teamStats(match.liveStats,'home')},
      {providerTeamId: match.awayTeamProviderId??null,teamName:match.awayTeamName,
        statistics:teamStats(match.liveStats,'away')},
    ],
  };
  const hasTeamStats = statistics.teams.some(team=>team.statistics.length>0);
  if (hasTeamStats) {
    await db.query(
      `insert into nova.match_stats(match_id,payload,provider,updated_at)
        values($1,$2::jsonb,$3,now())
        on conflict(match_id) do update set
          payload=excluded.payload,provider=excluded.provider,updated_at=now()`,
      [id,JSON.stringify({
        source:MATCH_SOURCE_FALLBACK,fixtureId:match.providerId,
        minute:match.minute,period:match.period,
        liveHomeScore:match.homeScore,liveAwayScore:match.awayScore,
        statistics,observedAt,
      }),MATCH_SOURCE_FALLBACK],
    );
  }

  const normalizedHome=normalizeMatchIdentity(match.homeTeamName);
  const normalizedAway=normalizeMatchIdentity(match.awayTeamName);
  for (const raw of (Array.isArray(match.liveEvents)?match.liveEvents:[]).slice(0,150)) {
    if(!raw||typeof raw!=='object'||Array.isArray(raw)) continue;
    const e=raw as Record<string,unknown>;
    const type=String(e.type??'event').slice(0,70);
    const rawMinute=e.minute==null?null:Number(e.minute);
    const minute=rawMinute!==null&&Number.isFinite(rawMinute)&&rawMinute>=0&&rawMinute<=130?Math.trunc(rawMinute):null;
    const teamValue=e.team??e.team_name??e.team_side;
    const teamName=typeof teamValue==='object'&&teamValue!==null?
      String((teamValue as Record<string,unknown>).name??''):String(teamValue??'');
    const teamIdentity=normalizeMatchIdentity(teamName);
    const side=teamIdentity==='home'||teamIdentity===normalizedHome?'home':
      teamIdentity==='away'||teamIdentity===normalizedAway?'away':null;
    const player=typeof e.player_name==='string'?e.player_name:
      typeof e.player==='string'?e.player:null;
    const rawIdentity=e.id??e.event_id??
      [type,minute??'na',side??'unknown',player??'',e.detail??''].join(':');
    const identity=fiveDollarProviderEventId(match.providerId,String(rawIdentity));
    const detail=typeof e.detail==='string'?e.detail:
      typeof e.description==='string'?e.description:null;
    const teamId=side==='home'?match.homeTeamProviderId:side==='away'?match.awayTeamProviderId:null;
    await db.query(
      `insert into nova.match_events
        (match_id,provider_event_id,type,minute,period,team_id,player_name,detail,occurred_at,created_at)
       values($1,$2,$3,$4,$5,
         (select pe.internal_id from nova.provider_entities pe
          where pe.provider=$6 and pe.entity_type='team' and pe.provider_id=$7 limit 1),
         $8,$9,now(),now())
       on conflict(match_id,provider_event_id)
         where provider_event_id is not null
       do update set type=excluded.type,minute=excluded.minute,
         period=excluded.period,player_name=coalesce(excluded.player_name,nova.match_events.player_name),
         detail=coalesce(excluded.detail,nova.match_events.detail)`,
      [id,identity,type,minute,match.period,MATCH_SOURCE_FALLBACK,
       teamId,player,detail],
    );
  }
}

export async function ingestFootballFixtures(
  db:Db, matches:readonly ProviderMatch[],
  max:number=MAX_CATALOG_PER_CYCLE,
):Promise<{synced:number;details:number;failed:number}> {
  let synced=0,details=0,failed=0;
  for (const match of matches.slice(0,max)) {
    if(!validFixture(match)) continue;
    try {
      const id=await persistFixture(db,match);
      if(!id)continue;
      synced++;
      if(fixtureHasDetails(match)){
        await persistDetails(db,match,id);
        details++;
      }
    } catch (error) {
      failed++;
      console.warn('FIVEDOLLAR_FIXTURE_FAILED',JSON.stringify({
        providerId:match.providerId,error:error instanceof Error?error.message:String(error),
      }));
    }
  }
  return{synced,details,failed};
}

async function pollLive(db:Db):Promise<void>{
  const result=await provider.fetchLiveMatches('football');
  if(!result.ok||!result.value){
    throw new Error('FIVEDOLLAR_LIVE_FETCH_FAILED: '+(result.errorCode??'unknown'));
  }
  const matches=result.value.filter(validFixture);
  const start=matches.length>0?liveOffset%matches.length:0;
  const selected=[...matches.slice(start),...matches.slice(0,start)].slice(0,MAX_LIVE_PER_CYCLE);
  liveOffset=start+selected.length;
  const summary=await ingestFootballFixtures(db,selected,MAX_LIVE_PER_CYCLE);
  console.log('FIVEDOLLAR_LIVE_POLL',JSON.stringify({
    count:matches.length,...summary,at:new Date().toISOString(),
  }));
}

async function pollCatalog(db:Db):Promise<void>{
  const now=Date.now();
  if(now-lastCatalogStart<CATALOG_INTERVAL_MS)return;
  lastCatalogStart=now;
  const day=CATALOG_DAY_OFFSETS[catalogDayIndex%CATALOG_DAY_OFFSETS.length]!;
  catalogDayIndex++;
  const utcDay=Math.floor(now/FOOTBALL_DAY)*FOOTBALL_DAY;
  const from=new Date(utcDay+day*FOOTBALL_DAY).toISOString();
  const to=new Date(utcDay+(day+1)*FOOTBALL_DAY).toISOString();
  const response=await provider.fetchMatches({from,to,sport:'football'});
  if(!response.ok||!response.value){
    throw new Error('FIVEDOLLAR_CATALOG_FETCH_FAILED: '+(response.errorCode??'unknown'));
  }
  const valid=response.value.filter(validFixture);
  const start=valid.length>0?(catalogOffsets.get(day)??0)%valid.length:0;
  const chosen=[...valid.slice(start),...valid.slice(0,start)].slice(0,MAX_CATALOG_PER_CYCLE);
  catalogOffsets.set(day,start+chosen.length);
  const summary=await ingestFootballFixtures(db,chosen);
  console.log('FIVEDOLLAR_CATALOG_POLL',JSON.stringify({
    dayOffset:day,fixtures:valid.length,at:new Date().toISOString(),...summary,
  }));
}

if (!provider.configured) {
  throw new Error('FIVEDOLLAR_STATS_WORKER_UNCONFIGURED');
}

createWorker({
  queue:'football-stats',
  handlers:[], // never consumes, reconciles or settles betting jobs
  tickIntervalMs:30_000,
  pollIntervalMs:1_000,
  async tick(ctx){
    await ctx.withLock('football:stats:poll',240,async()=>{
      await pollLive(ctx.services.db);
      await pollCatalog(ctx.services.db);
    });
  },
});
