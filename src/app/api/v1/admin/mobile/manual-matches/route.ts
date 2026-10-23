import { z } from 'zod';
import { withErrorHandling, jsonOk, jsonCreated, ApiError } from '@/lib/errors';
import { readJson } from '@/server/http/request';
import { withAdmin } from '@/server/http/guard';
export const dynamic = 'force-dynamic';

const schema = z.object({
 sport:z.enum(['football','basketball','tennis','volleyball','hockey','handball']),
 league:z.string().trim().min(2).max(100),
 home:z.string().trim().min(2).max(100),
 away:z.string().trim().min(2).max(100),
 scheduledAt:z.string().datetime({offset:true}),
}).refine(p=>p.home.toLocaleLowerCase()!==p.away.toLocaleLowerCase(),{message:'The teams must be different'});
export const GET = withErrorHandling('admin.mobile.manual.list',async(ctx,request:Request)=>{
 const {services}=await withAdmin(request,ctx,'matches.manage');
 const rows=await services.db.query<Record<string,unknown>>(
  "select id,sport,league,home,away,scheduled_at as \"scheduledAt\",status,created_at as \"createdAt\" from nova.manual_fixtures order by scheduled_at desc limit 40");
 return jsonOk({items:rows,total:rows.length});
});
export const POST = withErrorHandling('admin.mobile.manual.create',async(ctx,request:Request)=>{
 const {services,user,actor}=await withAdmin(request,ctx,'matches.manage');
 const body=await readJson(request,schema,ctx);
 const at=new Date(body.scheduledAt).getTime();
 if(!Number.isFinite(at)||at<Date.now()+60000||at>Date.now()+1000*60*60*24*730)
  throw new ApiError('VALIDATION_FAILED','Kickoff must be in the future (within two years)');
 const saved=await services.db.queryOne<Record<string,unknown>>(
  "insert into nova.manual_fixtures (sport,league,home,away,scheduled_at,created_by) values ($1,$2,$3,$4,$5,$6) returning id,sport,league,home,away,scheduled_at as \"scheduledAt\",status",
  [body.sport,body.league,body.home,body.away,body.scheduledAt,user.id]);
 if(!saved) throw new ApiError('SERVICE_UNAVAILABLE','Could not create manual fixture');
 await services.admin.writeAudit({
  actorId:user.id,action:'match.manual_created',entityType:'manual_fixture',entityId:String(saved.id),
  after:{...body,readOnly:true,bettingAvailable:false},
  reason:'admin mobile manual fixture creation',correlationId:actor.correlationId,
 });
 return jsonCreated({fixture:saved,bettingAvailable:false});
});
