'use strict';
/**
 * Stage8B: safe transport shim for the existing, tested Ed25519-signed VPS client.
 * Redirect ONLY the original Stage7 synthetic Edge endpoint to the branch-only
 * real staging financial endpoint; no provider/production callbacks touched.
 * Captures ONLY whitelisted result metrics, never keys, payloads, users or URLs.
 */
const https = require('node:https');
const originalHttpsRequest = https.request;
const originalGlobalFetch = globalThis.fetch;
const oldHost = 'mqygiufkubxxxjodsycu.supabase.co';
const oldPath = '/functions/v1/betvima-eu-casino-stage7-outbound';
const newHost = 'qrirgzvxpjhhwvyazvpn.supabase.co';
const newPath = '/functions/v1/betvima-eu-casino-stage8b-real-finance';
let redirects = 0, success = 0, rejected = 0, other = 0;

function matching(u) {
  return u && u.protocol === 'https:' && u.hostname === oldHost
    && u.pathname.replace(/\/$/,'') === oldPath && !u.search;
}
function target() { return 'https://' + newHost + newPath; }
function stripAuth(h) {
  if (!h) return h;
  const copy = {...h};
  for (const key of Object.keys(copy)) {
    const k=key.toLowerCase();
    if (k==='authorization'||k==='apikey'||k==='host') delete copy[key];
  }
  return copy;
}
function safeReport(status, body, ms) {
  let o=null;
  try {o=JSON.parse(body);} catch {}
  const ok = status === 200
    && o?.ok === true
    && o?.mode === 'STAGE8B_REAL_EDGE_TO_BRANCH_WALLET_RPC'
    && o?.branch_ref === 'qrirgzvxpjhhwvyazvpn'
    && o?.staging_financial_rpc_executed === true
    && o?.production_project_used === false
    && o?.production_financial_operations_enabled === false
    && o?.provider_contacted === false
    && o?.synthetic_balance_after_minor === 1000
    && o?.ledger_rows_for_round === 4
    && o?.receipt_rows_for_round === 4;
  if (ok) {
    success++;
    const num=(v)=>typeof v==='number' && Number.isFinite(v)? v : 'NA';
    process.stdout.write('STAGE8B_EDGE_RPC_REAL_FINANCE=PASS'
      +' E2E_MS='+num(ms)
      +' EDGE_TO_BRANCH_RPC_MS='+num(o.rpc_e2e_ms)
      +' DB_FINANCIAL_MS='+num(o.db_total_ms)
      +' DB_DEBIT_MS='+num(o.db_phases_ms?.d)
      +' DB_CREDIT_MS='+num(o.db_phases_ms?.c)
      +' DB_REFUND_MS='+num(o.db_phases_ms?.f)
      +' DB_REVERSE_MS='+num(o.db_phases_ms?.r)
      +' IDEMPOTENT_MOVEMENTS='+num(o.idempotent_movements)+'\n');
  } else if (status === 401) {
    rejected++;
    process.stdout.write('STAGE8B_NEGATIVE_AUTH_REJECTED=PASS\n');
  } else {
    other++;
    const allowed = new Set(['WRONG_STAGING_PROJECT','STAGING_RPC_NETWORK_FAILURE',
      'STAGING_RPC_REJECTED','STAGING_RPC_BAD_RESPONSE','STAGING_RPC_BAD_SHAPE',
      'STAGING_FINANCIAL_RECONCILIATION_FAILED','STAGING_URL_NOT_CONFIGURED',
      'STAGING_SERVICE_ROLE_NOT_CONFIGURED','JSON_REQUIRED','INVALID_BODY_SIZE']);
    const reason=typeof o?.error==='string'&&allowed.has(o.error)?o.error:'OTHER';
    process.stdout.write('STAGE8B_EDGE_RPC_REAL_FINANCE=FAIL STATUS='+String(status??'NA')
      +' ERROR='+reason+'\n');
  }
}
function captureResponse(req, start) {
  req.once('response',res=>{
    const oldPush=res.push;
    let chunks=[],total=0;
    res.push=function(chunk,...args){
      if(chunk && total<65536){
        const v=Buffer.from(chunk);
        total+=v.length;
        if(total<=65536)chunks.push(v);
      }
      return oldPush.call(this,chunk,...args);
    };
    res.once('end',()=>{
      safeReport(res.statusCode,Buffer.concat(chunks).toString('utf8'),
        Math.round((performance.now()-start)*10)/10);
    });
  });
}
function parseHref(a) {
  try {
    if(typeof a==='string'||a instanceof URL) return new URL(String(a));
    if(a && typeof a==='object'){
      const host=a.hostname??a.host;
      if(!host)return null;
      return new URL('https://'+host+(a.path??a.pathname??'/'));
    }
  } catch {}
  return null;
}
https.request = function(...args) {
  const u=parseHref(args[0]);
  if(!matching(u)) return originalHttpsRequest.apply(this,args);
  redirects++;
  const started=performance.now();
  if(typeof args[0]==='string'||args[0] instanceof URL) {
    args[0]=new URL(target());
    if(args[1] && typeof args[1]==='object' && typeof args[1]!=='function'){
      const o={...args[1],headers:stripAuth(args[1].headers)};
      delete o.hostname;delete o.host;delete o.path;delete o.pathname;delete o.port;
      o.servername=newHost;
      args[1]=o;
    }
  } else {
    const o={...args[0],hostname:newHost,host:newHost,port:443,
      path:newPath,pathname:newPath,servername:newHost,
      headers:stripAuth(args[0].headers)};
    args[0]=o;
  }
  const req=originalHttpsRequest.apply(this,args);
  captureResponse(req,started);
  return req;
};
https.get = function(...args) {
  const req=https.request(...args);
  req.end();
  return req;
};
if(typeof originalGlobalFetch==='function'){
  globalThis.fetch=async function(input,init){
    const u=parseHref(typeof input==='string'||input instanceof URL?input:input?.url);
    if(!matching(u))return originalGlobalFetch(input,init);
    redirects++;
    const start=performance.now();
    let req,headers;
    if(input instanceof Request){
      headers=new Headers(input.headers);
      headers.delete('authorization');headers.delete('apikey');
      req=new Request(target(),{method:input.method,headers,
        body:input.method==='GET'||input.method==='HEAD'?undefined:input.body,
        duplex:'half',signal:input.signal});
    }else {
      headers=new Headers(init?.headers);
      headers.delete('authorization');headers.delete('apikey');
      req=new Request(target(),{...init,headers});
    }
    const res=await originalGlobalFetch(req);
    let txt='';
    try{txt=await res.clone().text();}catch{}
    safeReport(res.status,txt,Math.round((performance.now()-start)*10)/10);
    return res;
  };
}
process.on('exit',()=>{
  process.stdout.write('STAGE8B_TRANSPORT_HOOK_MATCHES='+redirects+'\n');
  process.stdout.write('STAGE8B_TRANSPORT_VALID='+success+'\n');
  process.stdout.write('STAGE8B_TRANSPORT_REJECTED='+rejected+'\n');
  process.stdout.write('STAGE8B_TRANSPORT_OTHER='+other+'\n');
});
