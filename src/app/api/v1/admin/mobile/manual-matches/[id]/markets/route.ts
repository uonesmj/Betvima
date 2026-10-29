import { z } from 'zod';
import { ApiError, withErrorHandling, jsonCreated, jsonOk } from '@/lib/errors';
import { withAdmin } from '@/server/http/guard';
import { readJson } from '@/server/http/request';

export const dynamic = 'force-dynamic';
const uuid = z.string().uuid();
const choice = z.object({
  label: z.string().trim().min(1).max(70),
  decimal: z.string().regex(/^(?:[1-9][0-9]{0,2}|1000)(?:\.[0-9]{1,4})?$/),
});
const bodySchema = z.object({
  marketKey: z.string().regex(/^[a-z][a-z0-9_-]{1,63}$/),
  title: z.string().trim().min(2).max(120),
  line: z.number().min(-100).max(100).nullable().default(null),
  selections: z.array(choice).min(2).max(6),
  status: z.enum(['draft','visible','suspended']).default('draft'),
  expectedVersion: z.number().int().positive().nullable().default(null),
}).superRefine((value, ctx) => {
  if (new Set(value.selections.map(s => s.label.toLocaleLowerCase())).size !== value.selections.length)
    ctx.addIssue({code:z.ZodIssueCode.custom,message:'Duplicate selection'});
  for (const s of value.selections) {
    const odds=Number(s.decimal);
    if (!Number.isFinite(odds) || odds < 1.01 || odds > 1000)
      ctx.addIssue({code:z.ZodIssueCode.custom,message:'Odds must be 1.01 through 1000'});
  }
});

const listSql = `select id::text,market_key as "marketKey",title,line,
 selections,status,version,updated_at as "updatedAt",
 false as "isBettingAvailable"
 from nova.manual_fixture_markets where fixture_id=$1
 order by created_at asc limit 80`;

export const GET = withErrorHandling('admin.manual.markets.list',async(ctx,request:Request)=>{
 const {services}=await withAdmin(request,ctx,'matches.manage');
 const id=new URL(request.url).pathname.split('/').at(-2);
 if(!uuid.safeParse(id).success)throw new ApiError('VALIDATION_FAILED','Invalid fixture identifier');
 const rows=await services.db.query<Record<string,unknown>>(listSql,[id]);
 return jsonOk({items:rows,bettingAvailable:false});
});

export const POST = withErrorHandling('admin.manual.markets.save',async(ctx,request:Request)=>{
 const {services,user,actor}=await withAdmin(request,ctx,'matches.manage');
 const id=new URL(request.url).pathname.split('/').at(-2);
 if(!uuid.safeParse(id).success)throw new ApiError('VALIDATION_FAILED','Invalid fixture identifier');
 const body=await readJson(request,bodySchema,ctx);
 const fixture=await services.db.queryOne<{status:string,scheduled_at:string}>(
  'select status,scheduled_at from nova.manual_fixtures where id=$1',[id]);
 if(!fixture)throw new ApiError('NOT_FOUND','Manual fixture not found');
 if(fixture.status!=='scheduled'||new Date(fixture.scheduled_at).getTime()<=Date.now())
  throw new ApiError('VALIDATION_FAILED','Odds may only be edited before kickoff');
 const selections=JSON.stringify(body.selections);
 let row:Record<string,unknown>|null;
 if(body.expectedVersion===null){
  row=await services.db.queryOne<Record<string,unknown>>(
   `insert into nova.manual_fixture_markets
    (fixture_id,market_key,title,line,selections,status,created_by,updated_by)
    values ($1,$2,$3,$4,$5::jsonb,$6,$7,$7)
    on conflict (fixture_id,market_key) do nothing
    returning id::text,market_key as "marketKey",title,line,selections,status,version`,
    [id,body.marketKey,body.title,body.line,selections,body.status,user.id]);
 }else{
  row=await services.db.queryOne<Record<string,unknown>>(
   `update nova.manual_fixture_markets set title=$3,line=$4,selections=$5::jsonb,
    status=$6,version=version+1,updated_by=$7,updated_at=now()
    where fixture_id=$1 and market_key=$2 and version=$8
    and exists(select 1 from nova.manual_fixtures f where f.id=$1
      and f.status='scheduled' and f.scheduled_at>now())
    returning id::text,market_key as "marketKey",title,line,selections,status,version`,
    [id,body.marketKey,body.title,body.line,selections,body.status,user.id,body.expectedVersion]);
 }
 if(!row)throw new ApiError('CONFLICT','Market exists or was updated by another administrator; refresh first');
 await services.admin.writeAudit({
  actorId:user.id,action:'manual_fixture.market_saved',entityType:'manual_fixture',
  entityId:id!,before:null,after:{market:row,bettingAvailable:false},
  reason:'admin market preview save',correlationId:actor.correlationId,
 });
 return jsonCreated({market:row,bettingAvailable:false});
});

const statusSchema=z.object({
 marketKey:z.string().regex(/^[a-z][a-z0-9_-]{1,63}$/),
 expectedVersion:z.number().int().positive(),
 status:z.enum(['draft','visible','suspended']),
});
export const PATCH=withErrorHandling('admin.manual.markets.status',async(ctx,request:Request)=>{
 const {services,user,actor}=await withAdmin(request,ctx,'matches.manage');
 const id=new URL(request.url).pathname.split('/').at(-2);
 if(!uuid.safeParse(id).success)throw new ApiError('VALIDATION_FAILED','Invalid fixture identifier');
 const input=await readJson(request,statusSchema,ctx);
 const row=await services.db.queryOne<Record<string,unknown>>(
  `update nova.manual_fixture_markets set status=$3,version=version+1,
   updated_by=$4,updated_at=now()
   where fixture_id=$1 and market_key=$2 and version=$5
   and ($3='suspended' or exists(select 1 from nova.manual_fixtures f where f.id=$1
    and f.status='scheduled' and f.scheduled_at>now()))
   returning id::text,market_key as "marketKey",status,version`,
   [id,input.marketKey,input.status,user.id,input.expectedVersion]);
 if(!row)throw new ApiError('CONFLICT','Market changed, kickoff started or market not found');
 await services.admin.writeAudit({
  actorId:user.id,action:'manual_fixture.market_status',entityType:'manual_fixture',entityId:id!,
  before:null,after:{...row,bettingAvailable:false},
  reason:'admin market preview status change',correlationId:actor.correlationId,
 });
 return jsonOk({market:row,bettingAvailable:false});
});
