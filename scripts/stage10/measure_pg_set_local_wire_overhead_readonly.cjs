#!/usr/bin/env node
'use strict';
/**
 * BetVima stage10 controlled live DB wire-time diagnostic, strictly READ ONLY.
 * Measures extra PostgreSQL network roundtrip from a SET LOCAL statement.
 * Does NOT execute any SoftAggregator requests, user wallet RPCs or admin code.
 * Uses READ ONLY transaction, then explicit ROLLBACK, no persistent database
 * or application configuration modifications. No credential output.
 */
const fs=require('node:fs');
const cp=require('node:child_process');
const crypto=require('node:crypto');
const path=require('node:path');
const {performance}=require('node:perf_hooks');
const ROOT='/opt/nova-releases/casino-3098-eligible-fallback-HU6Rbl';
const POSTGRES='src/server/db/postgres.ts';
const FX='src/server/providers/arzhaam/client.ts';
const EXPECTED_POSTGRES_SHA12='3d66c5724ff6';
function record(key,value){process.stdout.write(key+'='+String(value)+'\n')}
function median(xs){
 if(xs.length===0)return 'NA';
 const s=[...xs].sort((a,b)=>a-b);const k=Math.floor(s.length/2);
 return (s.length%2?s[k]:(s[k-1]+s[k])/2).toFixed(1);
}
function measured(fn){const t=performance.now();return Promise.resolve().then(fn).then(()=>+(performance.now()-t).toFixed(1))}
function readCode(relative){
 const p=path.join(ROOT,relative);
 if(!fs.existsSync(p)||!fs.statSync(p).isFile()||fs.statSync(p).size>180000)return null;
 return fs.readFileSync(p,'utf8');
}
function getActualServicePid(){
 const data=cp.execFileSync('ss',['-ltnpH'],{encoding:'utf8',timeout:5000});
 const line=data.split('\n').find(s=>/:3098\s/.test(s));
 const pid=line?.match(/pid=(\d+)/)?.[1];
 if(!pid)return null;
 try{
  const cwd=fs.realpathSync('/proc/'+pid+'/cwd');
  if(fs.realpathSync(ROOT)!==cwd)return null;
  return pid;
 }catch{return null}
}
function getConfig(pid){
 try{require(path.join(ROOT,'node_modules/@next/env')).loadEnvConfig(ROOT,false)}catch{}
 const env={...process.env};
 try{
  const data=fs.readFileSync('/proc/'+pid+'/environ','utf8');
  for(const item of data.split('\0')){
   const i=item.indexOf('=');
   if(i>0 && !env[item.slice(0,i)])env[item.slice(0,i)]=item.slice(i+1);
  }
 }catch{}
 const config={max:1,connectionTimeoutMillis:6000,statement_timeout:12000,
               idleTimeoutMillis:3000};
 const url=env.SUPABASE_DB_URL||env.DATABASE_URL;
 if(url)config.connectionString=url;
 else if(env.PGHOST){
  config.host=env.PGHOST;
  config.port=Number(env.PGPORT||5432);
  config.user=env.PGUSER;
  config.password=env.PGPASSWORD;
  config.database=env.PGDATABASE;
 }else return null;
 return config;
}
async function main(){
 record('STAGE10_TEST','POSTGRES_SET_LOCAL_READONLY_WIRE_RTT');
 const postgres=readCode(POSTGRES);
 if(!postgres||crypto.createHash('sha256').update(postgres).digest('hex').slice(0,12)!==EXPECTED_POSTGRES_SHA12){
  record('STAGE10_SOURCE_GUARD','FAILED_STOP');return 2;
 }
 record('STAGE10_SOURCE_GUARD','PASS');
 const txStart=postgres.indexOf('class TransactionDb');
 const txSource=txStart<0?'':postgres.slice(txStart);
 const usesLocal=/set\s+local\s+statement_timeout/i.test(txSource);
 record('STAGE10_LIVE_TRANSACTION_SET_LOCAL_PRESENT',usesLocal);
 record('STAGE10_LIVE_TRANSACTION_SET_LOCAL_COUNT',
        (txSource.match(/set\s+local\s+statement_timeout/gi)||[]).length);
 record('STAGE10_LIVE_POOL_STATEMENT_TIMEOUT_PRESENT',/statement_timeout\s*:/.test(postgres));
 const fx=readCode(FX);
 if(fx){
  record('STAGE10_LIVE_FX_SOURCE_PRESENT',true);
  record('STAGE10_LIVE_FX_HTTP_FETCH_PRESENT',/\bfetch\s*\(/.test(fx));
  record('STAGE10_LIVE_FX_CACHE_NO_STORE',/\bcache\s*:\s*['"]no-store['"]/.test(fx));
  record('STAGE10_LIVE_FX_TIMEOUT_SIGNAL',
    /\bAbortSignal\.timeout\s*\(|\bAbortController\s*\(/.test(fx));
  record('STAGE10_LIVE_FX_HAS_IN_MEMORY_CACHE_PATTERN',
    /(?:\bttl\b|\bexpiresAt\b|\bcachedRate\b|\bcacheUntil\b|\brateCache\b)/i.test(fx));
 }else record('STAGE10_LIVE_FX_SOURCE','MISSING');
 const pid=getActualServicePid();
 if(!pid){record('STAGE10_LISTENER_GUARD','FAILED_STOP');return 2}
 record('STAGE10_LISTENER_GUARD','PASS');
 const conf=getConfig(pid);
 if(!conf){record('STAGE10_DB_CONFIG','UNAVAILABLE');return 2}
 let pg;
 try{pg=require(path.join(ROOT,'node_modules/pg'))}
 catch{record('STAGE10_PG_DRIVER','UNAVAILABLE');return 2}
 const pool=new pg.Pool(conf);
 let client,tx=false,connected=false;
 try{
  const t=performance.now();
  client=await pool.connect();connected=true;
  record('STAGE10_CONNECTION_ACQUIRE_MS',(performance.now()-t).toFixed(1));
  await client.query('BEGIN READ ONLY');tx=true;
  const plain=[],setLocal=[],afterLocal=[];
  for(let i=0;i<6;i++){
   plain.push(await measured(()=>client.query('SELECT 1')));
   setLocal.push(await measured(()=>client.query('SET LOCAL statement_timeout = 12000')));
   afterLocal.push(await measured(()=>client.query('SELECT 1')));
  }
  record('STAGE10_PLAIN_SELECT_SAMPLES_MS',plain.join(','));
  record('STAGE10_SET_LOCAL_SAMPLES_MS',setLocal.join(','));
  record('STAGE10_WITH_SET_LOCAL_SELECT_SAMPLES_MS',afterLocal.join(','));
  record('STAGE10_PLAIN_SELECT_P50_MS',median(plain));
  record('STAGE10_SET_LOCAL_EXTRA_P50_MS',median(setLocal));
  record('STAGE10_WITH_LOCAL_SELECT_P50_MS',median(afterLocal));
  record('STAGE10_ESTIMATED_EXTRA_FOR_8_SET_LOCAL_MS',
    (+median(setLocal)*8).toFixed(1));
  record('STAGE10_DB_WIRE_TEST','PASS');
  await client.query('ROLLBACK');tx=false;
  return 0;
 }catch(e){
  record('STAGE10_DB_WIRE_TEST','UNAVAILABLE');
  const code=String(e&&e.code||'NETWORK').replace(/[^A-Z0-9_]/gi,'').slice(0,18);
  record('STAGE10_DB_ERROR_CODE',code);
  return 2;
 }finally{
  if(client&&tx)try{await client.query('ROLLBACK')}catch{}
  if(client)try{client.release()}catch{}
  try{await pool.end()}catch{}
  record('STAGE10_WALLET_FUNCTION_CALLS',0);
  record('STAGE10_PROVIDER_CALLBACKS_SENT',0);
  record('STAGE10_DB_CHANGES_PERSISTED',0);
  record('STAGE10_CASINO_3098_CHANGED',false);
  record('STAGE10_SECRET_OUTPUT',false);
 }
}
main().then(code=>process.exitCode=code).catch(()=>{
 record('STAGE10_TEST','FAILED_SAFE');process.exitCode=2;
});
