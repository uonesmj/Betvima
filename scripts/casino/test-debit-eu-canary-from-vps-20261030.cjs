#!/usr/bin/env node
/** BetVima: synthetic, Ed25519-signed Debit EU canary. NO financial writes.
 * Use on the original VPS as root. It reads (never prints) the public anon
 * JWT from the pinned running Next.js process and the independent private
 * Ed25519 signing key from its root-owned file.
 */
'use strict';
const { lstatSync, readFileSync, realpathSync } = require('node:fs');
const { createPrivateKey, createPublicKey, sign, randomBytes } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { performance } = require('node:perf_hooks');
const PINNED_RELEASE='/opt/nova-releases/casino-3098-eligible-fallback-HU6Rbl';
const KEY='/etc/betvima/edge-bridge/edge-bridge-shadow-ed25519.pem';
const SPKI='MCowBQYDK2VwAyEAZ/H+1/rAxIccH4jY+wx7PE5wgFsotby7io0m6wx77cs=';
const URL='https://mqygiufkubxxxjodsycu.supabase.co/functions/v1/betvima-debit-eu-canary?forceFunctionRegion=eu-west-1';
const stop = reason => { console.log('REFUSED_'+reason); process.exit(2); };
if (process.getuid?.() !== 0) stop('ROOT_REQUIRED');
let pid;
try {
  const ss=execFileSync('ss',['-ltnpH'],{encoding:'utf8',timeout:5000});
  const matches=[...ss.matchAll(/:3098\s+[^\n]*?pid=(\d+)/g)];
  if (matches.length!==1) stop('LIVE_PROCESS_AMBIGUOUS');
  pid=matches[0][1];
  if (realpathSync('/proc/'+pid+'/cwd')!==PINNED_RELEASE) stop('RELEASE_CHANGED');
} catch { stop('PINNED_RELEASE_NOT_FOUND'); }
let publicJwt='';
try {
  const environment=readFileSync('/proc/'+pid+'/environ').toString('utf8').split('\0');
  publicJwt=environment.find(e=>e.startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY='))?.split('=').slice(1).join('=')??'';
} catch { stop('PUBLIC_JWT_UNAVAILABLE'); }
if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(publicJwt) ||
    publicJwt.length > 8192) stop('ANON_JWT_NOT_VALID');
let claims;
try { claims=JSON.parse(Buffer.from(publicJwt.split('.')[1],'base64url').toString('utf8')); }
catch { stop('ANON_CLAIMS_INVALID'); }
if (claims.role!=='anon' || claims.ref!=='mqygiufkubxxxjodsycu' ||
    claims.iss!=='supabase' || !Number.isSafeInteger(claims.exp) ||
    claims.exp<=Math.floor(Date.now()/1000)) stop('NOT_PROJECT_ANON_JWT');
let privateKey;
try {
  const info=lstatSync(KEY);
  if (!info.isFile() || info.isSymbolicLink() || info.uid!==0 || (info.mode & 0o077)!==0) {
    stop('SHADOW_SIGNING_KEY_FILE_UNSAFE');
  }
  privateKey=createPrivateKey(readFileSync(KEY));
  if (privateKey.asymmetricKeyType!=='ed25519') stop('EXPECTED_ED25519');
  if (createPublicKey(privateKey).export({type:'spki',format:'der'}).toString('base64')!==SPKI) {
    stop('SIGNING_KEY_MISMATCH');
  }
} catch { stop('SHADOW_SIGNING_KEY_UNAVAILABLE'); }
const makeBody=()=>Buffer.from(JSON.stringify({
  v:1,ts:Date.now(),nonce:randomBytes(16).toString('hex'),kind:'debit_eu_canary',
}));
async function send(body,signature) {
  const start=performance.now();
  const headers={
    apikey:publicJwt,
    Authorization:'Bearer '+publicJwt,
    'Content-Type':'application/json',
    'x-region':'eu-west-1',
  };
  if (signature) headers['x-betvima-bridge-signature']=signature;
  const response=await fetch(URL,{
    method:'POST',headers,body,signal:AbortSignal.timeout(15000),
  });
  let result;
  try { result=await response.json(); } catch { stop('UNEXPECTED_EDGE_RESPONSE'); }
  return {
    status:response.status,
    ms:Math.round((performance.now()-start)*10)/10,
    region:response.headers.get('x-sb-edge-region'),
    data:result,
  };
}
(async()=>{
  const unsigned=await send(makeBody(),null);
  console.log('UNSIGNED_HTTP='+unsigned.status);
  if (unsigned.status!==401) stop('UNSIGNED_NOT_REJECTED');
  const total=[],db=[];
  for(let i=0;i<4;i++){
    const body=makeBody();
    const signed=sign(null,body,privateKey).toString('base64');
    const r=await send(body,signed);
    if(r.status!==200 || r.region!=='eu-west-1' || !r.data.ok ||
       r.data.mode!=='SIGNED_SYNTHETIC_READ_ONLY' ||
       r.data.financial_operations_enabled!==false ||
       r.data.wallet_modified!==false ||
       r.data.sql_write_statements!==0 ||
       r.data.read_queries!==8 ||
       !Number.isFinite(r.data.db_total_ms)) stop('SIGNED_CANARY_RESPONSE_INVALID');
    total.push(r.ms);
    db.push(r.data.db_total_ms);
    console.log('CANARY_'+(i+1)+'_E2E_MS='+r.ms);
    console.log('CANARY_'+(i+1)+'_DB_MS='+r.data.db_total_ms);
  }
  const original=makeBody();
  const signature=sign(null,original,privateKey).toString('base64');
  const tampered=Buffer.from(original.toString('utf8').replace('debit_eu_canary','debit'));
  if(tampered.equals(original)) stop('TAMPER_TEST_MISSING');
  const changed=await send(tampered,signature);
  console.log('TAMPERED_HTTP='+changed.status);
  if(changed.status!==401) stop('TAMPERED_ACCEPTED');
  const median=values=>values.slice().sort((a,b)=>a-b)[1];
  console.log('EDGE_CANARY_REGION=eu-west-1');
  console.log('EDGE_CANARY_E2E_MEDIAN_MS='+median(total));
  console.log('EDGE_CANARY_DB_MEDIAN_MS='+median(db));
  console.log('SIGNED_TRANSPORT_TEST_PASS');
  console.log('NO_MONEY_CALLBACKS_OR_WRITES=true');
  console.log('PRODUCTION_3098_NOT_MODIFIED=true');
})().catch(e=>{
  // Deliberately redact the exception and all HTTP bodies.
  console.log('REFUSED_EDGE_CANARY_NETWORK_'+(e && e.name==='TimeoutError'?'TIMEOUT':'FAILED'));
  process.exitCode=2;
});
