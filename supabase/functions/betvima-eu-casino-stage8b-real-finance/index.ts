/**
 * BetVima Stage 8B BRANCH-ONLY real PostgreSQL wallet RPC pilot.
 * All four financial movements are hardcoded in branch-local SQL function;
 * no user/account/amount/provider inputs are accepted.
 * Cryptographic Ed25519 signed canary auth, no JWT bypass to funds.
 * Deployment target ONLY: qrirgzvxpjhhwvyazvpn (no production project).
 */
import { verifyDebitEuCanary } from './verify.ts';

declare const Deno: {
  env: {get(key: string): string|undefined};
  serve(handler: (request: Request)=>Promise<Response>): void;
};
const BRANCH_ORIGIN='https://qrirgzvxpjhhwvyazvpn.supabase.co';
const PUBLIC_SPKI='MCowBQYDK2VwAyEAZ/H+1/rAxIccH4jY+wx7PE5wgFsotby7io0m6wx77cs=';
const json=(status:number,data:object)=>new Response(JSON.stringify(data),{status,headers:{
  'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',
  'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});
async function body(req:Request):Promise<Uint8Array|null>{
  const length=req.headers.get('content-length');
  if(length&&(!/^\d+$/.test(length)||Number(length)>512)) return null;
  const reader=req.body?.getReader();
  if(!reader)return null;
  let total=0;const parts:Uint8Array[]=[];
  try{while(true){const next=await reader.read();if(next.done)break;
    total+=next.value.byteLength;
    if(total>512){await reader.cancel().catch(()=>undefined);return null;}
    parts.push(next.value);
  }}catch{return null;}
  if(total<1)return null;
  const out=new Uint8Array(total);let off=0;
  for(const v of parts){out.set(v,off);off+=v.byteLength;}
  return out;
}
Deno.serve(async req=>{
  if(req.method!=='POST')return json(405,{error:'POST_REQUIRED'});
  if(!(req.headers.get('content-type')??'').toLowerCase().startsWith('application/json')){
    return json(415,{error:'JSON_REQUIRED'});
  }
  const bytes=await body(req);
  if(!bytes)return json(413,{error:'INVALID_BODY_SIZE'});
  const verified=await verifyDebitEuCanary(
    bytes,req.headers.get('x-betvima-bridge-signature')??'',PUBLIC_SPKI,
    Deno.env.get('SB_REGION')??'');
  if(!verified.ok)return json(401,{error:verified.code});
  let url='';
  try{url=new URL(Deno.env.get('SUPABASE_URL')??'').origin}catch{
    return json(503,{error:'STAGING_URL_NOT_CONFIGURED'});
  }
  // Never use source payload to select a destination project.
  if(url!==BRANCH_ORIGIN)return json(503,{error:'WRONG_STAGING_PROJECT'});
  const secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')??'';
  if(secret.length<40)return json(503,{error:'STAGING_SERVICE_ROLE_NOT_CONFIGURED'});
  let marker:unknown;
  try{marker=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}
  catch{return json(400,{error:'INVALID_SYNTHETIC_MARKER'});}
  if(!marker||typeof marker!=='object'||Array.isArray(marker))return json(400,{error:'INVALID_SYNTHETIC_MARKER'});
  const nonce=(marker as Record<string,unknown>).nonce;
  if(typeof nonce!=='string'||!/^[a-f0-9]{32}$/.test(nonce))return json(400,{error:'INVALID_NONCE'});
  const t0=performance.now();
  let response:Response;
  try{
    response=await fetch(BRANCH_ORIGIN+'/rest/v1/rpc/stage8b_synthetic_financial_round',{
      method:'POST',
      headers:{'Content-Type':'application/json','apikey':secret,
        'Authorization':'Bearer '+secret,'Content-Profile':'public',
        'Accept-Profile':'public'},
      body:JSON.stringify({p_nonce:nonce}),
      signal:AbortSignal.timeout(10000)
    });
  }catch{return json(503,{error:'STAGING_RPC_NETWORK_FAILURE'});}
  const rpc_ms=Math.round((performance.now()-t0)*10)/10;
  if(!response.ok){
    // No database details or service role credentials ever returned.
    return json(503,{error:'STAGING_RPC_REJECTED',http_status:response.status});
  }
  let result:unknown;
  try{result=await response.json();}catch{return json(503,{error:'STAGING_RPC_BAD_RESPONSE'});}
  if(!result||typeof result!=='object'||Array.isArray(result)){
    return json(503,{error:'STAGING_RPC_BAD_SHAPE'});
  }
  const r=result as Record<string,unknown>;
  if(r.ok!==true||r.mode!=='STAGE8B_REAL_POST_WALLET_ENTRY'||
    r.staging_only!==true||r.balance_after_minor!==1000||
    r.ledger_rows_for_round!==4||r.receipt_rows_for_round!==4){
    return json(503,{error:'STAGING_FINANCIAL_RECONCILIATION_FAILED'});
  }
  return json(200,{
    ok:true,mode:'STAGE8B_REAL_EDGE_TO_BRANCH_WALLET_RPC',
    region:'eu-west-1',branch_ref:'qrirgzvxpjhhwvyazvpn',
    production_project_used:false,production_financial_operations_enabled:false,
    staging_financial_rpc_executed:true,provider_contacted:false,
    currency:'USD',synthetic_balance_after_minor:1000,
    ledger_rows_for_round:4,receipt_rows_for_round:4,
    idempotent_movements:r.idempotent_movements,
    rpc_e2e_ms:rpc_ms,db_total_ms:r.db_total_ms,db_phases_ms:r.phases_db_ms
  });
});
