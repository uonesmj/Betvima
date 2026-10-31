#!/usr/bin/env node
'use strict';
/**
 * Stage17 read-only NOVA schema archive: a PRIVATE LOCAL working copy only.
 * Explicitly never dumps customer rows, balances, KYC, auth/storage or credentials.
 * Runs pg_dump as a READ-ONLY session against PINNED PRODUCTION PROJECT ONLY.
 * Does not call provider, restart casino 3098, apply SQL or start a service.
 *
 * WARNING: schema functions may contain proprietary logic/literals. Keep the
 * resulting archive at 0600 and NEVER upload it to GitHub or share its bytes.
 */
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const cp=require('node:child_process');

const LIVE='/opt/nova-releases/casino-3098-eligible-fallback-HU6Rbl';
const ROOT='/root/betvima-stage5';
const PRODUCTION_REF='mqygiufkubxxxjodsycu';
const KINDS=new Set(['SUPABASE_DB_URL','DATABASE_URL']);
const MSG=s=>console.log('STAGE17_'+s);
function abort(why){
 MSG('ABORT='+why);
 process.exitCode=2;
 throw new Error('STAGE17_CONTROLLED_ABORT');
}
function findPid(){
 const r=cp.spawnSync('/usr/bin/ss',['-ltnpH'],{encoding:'utf8',timeout:5000});
 if(r.status!==0)abort('SOCKET_DISCOVERY_FAILED');
 const lines=r.stdout.split('\n').filter(x=>/:3098(?:\s|$)/.test(x));
 const ids=[...new Set(lines.flatMap(l=>[...l.matchAll(/\bpid=(\d+)/g)].map(m=>m[1])))];
 if(ids.length!==1)abort('EXPECTED_EXACTLY_ONE_3098_PID');
 return Number(ids[0]);
}
function readLiveEnv(pid){
 const file='/proc/'+pid+'/environ';
 const bytes=fs.readFileSync(file);
 if(bytes.length>200000)abort('PROCESS_ENV_UNEXPECTED_SIZE');
 const out={};
 for(const pair of bytes.toString('utf8').split('\0')){
   const n=pair.indexOf('=');
   if(n>0)out[pair.slice(0,n)]=pair.slice(n+1);
 }
 return out;
}
function envForDump(){
 const pid=findPid();
 const procEnv=readLiveEnv(pid);
 // Existing release's Next runtime can load its own environment locally,
 // in this SHORT-LIVED NODE PROCESS; it does not modify a running process.
 try {
   const modulePath=path.join(LIVE,'node_modules/@next/env');
   require(modulePath).loadEnvConfig(LIVE,false);
 } catch {}
 const urlText=[...KINDS].map(x=>procEnv[x]||process.env[x])
                 .find(x=>typeof x==='string' && x.length>0);
 let vars={};
 if(urlText){
   let u;
   try{u=new URL(urlText)}catch{abort('DATABASE_URI_PARSE_FAILED')}
   if(!['postgres:','postgresql:'].includes(u.protocol))abort('DATABASE_URI_SCHEME_UNSUPPORTED');
   const user=decodeURIComponent(u.username),host=u.hostname,db=decodeURIComponent(u.pathname.replace(/^\//,''));
   const password=decodeURIComponent(u.password);
   if(!user||!host||!db)abort('DATABASE_URI_INCOMPLETE');
   if(!(host+'.'+user).includes(PRODUCTION_REF))abort('DATABASE_URI_NOT_PINNED_TO_PRODUCTION_PROJECT');
   vars={PGHOST:host,PGPORT:u.port||'5432',PGUSER:user,PGPASSWORD:password,PGDATABASE:db,
     PGSSLMODE:u.searchParams.get('sslmode')||'require'};
 } else {
   const o={...process.env,...procEnv};
   if(!(String(o.PGHOST||'')+'.'+String(o.PGUSER||'')).includes(PRODUCTION_REF))
      abort('NO_PINNED_PRODUCTION_DATABASE_URL');
   vars={PGHOST:o.PGHOST,PGPORT:o.PGPORT||'5432',PGUSER:o.PGUSER,
     PGPASSWORD:o.PGPASSWORD||'',PGDATABASE:o.PGDATABASE||'postgres',
     PGSSLMODE:o.PGSSLMODE||'require'};
 }
 if(!vars.PGHOST||!vars.PGUSER||!vars.PGDATABASE)abort('DATABASE_CONNECTION_INCOMPLETE');
 // Prevent dotenv overrides from reintroducing a different endpoint.
 return {
   ...vars,PGCONNECT_TIMEOUT:'8',PGAPPNAME:'betvima-stage17-schema-only',
   PGOPTIONS:'-c default_transaction_read_only=on -c lock_timeout=2000 -c statement_timeout=120000',
   PATH:process.env.PATH||'/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
   HOME:'/root'
 };
}
function commandExists(p){
 try{return fs.statSync(p).isFile()}catch{return false}
}
function main(){
 MSG('MODE=SCHEMA_ONLY_PRIVATE_BACKUP');
 if(process.getuid()!==0)abort('ROOT_REQUIRED_FOR_PRIVATE_ARCHIVE');
 if(!fs.realpathSync(LIVE).startsWith('/opt/nova-releases/casino-3098-eligible-fallback-'))
    abort('LIVE_RELEASE_PATH_UNEXPECTED');
 if(!commandExists('/usr/bin/pg_dump')||!commandExists('/usr/bin/pg_restore'))
    abort('LOCAL_PG_DUMP_CLIENT_NOT_INSTALLED');
 if(!fs.statSync(ROOT).isDirectory()||fs.lstatSync(ROOT).isSymbolicLink())
    abort('WORK_ROOT_NOT_SAFE');
 const env=envForDump();
 const dir=fs.mkdtempSync(path.join(ROOT,'stage17-schema-only.'));
 fs.chmodSync(dir,0o700);
 const archive=path.join(dir,'private-nova-schema-only.dump');
 try{
   // No data flags, no source account content, no auth/storage schema.
   const args=['--format=custom','--schema-only','--schema=nova',
    '--no-owner','--no-privileges','--lock-wait-timeout=2s',
    '--file='+archive];
   const r=cp.spawnSync('/usr/bin/pg_dump',args,{env,
      timeout:150000,encoding:'utf8',maxBuffer:1024*1024});
   // Deliberately do not print stderr: libpq messages might include secrets.
   if(r.error?.code==='ETIMEDOUT')abort('PG_DUMP_MAX_TIME_EXCEEDED');
   if(r.status!==0)abort('PG_DUMP_FAILED_OR_CLIENT_VERSION_MISMATCH');
   fs.chmodSync(archive,0o600);
   const st=fs.statSync(archive);
   if(st.size<1000||st.size>80000000)abort('ARCHIVE_SIZE_OUT_OF_RANGE');
   const l=cp.spawnSync('/usr/bin/pg_restore',['--list',archive],{
     encoding:'utf8',timeout:10000,maxBuffer:2*1024*1024
   });
   if(l.status!==0)abort('ARCHIVE_TOC_UNREADABLE');
   const toc=l.stdout.split('\n').filter(x=>/^\s*\d+;/.test(x));
   if(toc.some(x=>/\b(TABLE DATA|MATERIALIZED VIEW DATA|BLOBS|SEQUENCE SET)\b/.test(x)))
     abort('ARCHIVE_CONTAINS_DATA');
   const tableCount=toc.filter(x=>/\bTABLE nova\b/.test(x)).length;
   if(tableCount!==97)abort('ARCHIVE_PRODUCTION_TABLE_COUNT_NOT_97');
   const sha=crypto.createHash('sha256').update(fs.readFileSync(archive)).digest('hex');
   MSG('SCHEMA_ARCHIVE_HAS_DATA=false');
   MSG('SCHEMA_TABLES='+tableCount);
   MSG('PRIVATE_ARCHIVE_MODE=0600');
   MSG('PRIVATE_ARCHIVE_SHA256='+sha);
   MSG('PRIVATE_ARCHIVE_PATH='+archive);
   MSG('PRODUCTION_SQL_WRITES=0');
   MSG('ACTIVE_CASINO_3098_CHANGED=false');
   MSG('SCHEMA_ONLY_ARCHIVE=PASS');
 } catch(e) {
   // An unsuccessful/partial archive is NEVER retained.
   fs.rmSync(dir,{recursive:true,force:true});
   throw e;
 }
}
try{main()}catch(e){
 if(e.message!=='STAGE17_CONTROLLED_ABORT'){
  MSG('UNEXPECTED_FAILURE='+String(e.code||e.name||'ERROR').replace(/[^A-Za-z0-9_-]/g,'').slice(0,45));
  process.exitCode=2;
 }
}
