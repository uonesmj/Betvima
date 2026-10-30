#!/usr/bin/env node
'use strict';
/**
 * Stage17 network and safe SQL probe only. No pg_dump or archives, no DDL,
 * no real casino operations, no changes to server env or production code.
 * Never prints host, IP, username, connection URI, password or raw stderr.
 */
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const dns=require('node:dns').promises,net=require('node:net');
const LIVE='/opt/nova-releases/casino-3098-eligible-fallback-HU6Rbl';
const PROD_REF='mqygiufkubxxxjodsycu';
function out(k,v){console.log('STAGE17_NET_'+k+'='+v)}
function stop(tag){out('ABORT',tag);process.exitCode=2;throw Error('CONTROLLED_STOP')}
function procEnv(){
 const ss=cp.spawnSync('/usr/bin/ss',['-ltnpH'],{encoding:'utf8',timeout:5000});
 if(ss.status!==0)stop('SS_UNAVAILABLE');
 const lines=ss.stdout.split('\n').filter(x=>/:3098(?:\s|$)/.test(x));
 const ids=[...new Set(lines.flatMap(x=>[...x.matchAll(/\bpid=(\d+)/g)].map(m=>m[1])))];
 if(ids.length!==1)stop('LIVE_3098_PROCESS_NOT_UNIQUE');
 const env={};
 const buff=fs.readFileSync('/proc/'+ids[0]+'/environ');
 if(buff.length>200000)stop('LIVE_ENV_TOO_LARGE');
 for(const x of buff.toString('utf8').split('\0')){const k=x.indexOf('=');if(k>0)env[x.slice(0,k)]=x.slice(k+1)}
 return env;
}
function validatedEnv(){
 if(process.getuid()!==0)stop('ROOT_REQUIRED');
 if(fs.realpathSync(LIVE)!==LIVE)stop('LIVE_RELEASE_NOT_PINNED');
 const env=procEnv();
 const val=env.SUPABASE_DB_URL||env.DATABASE_URL;
 if(!val)stop('DB_URI_ABSENT_FROM_LIVE_PROCESS');
 let url;try{url=new URL(val)}catch{stop('DB_URI_INVALID')}
 if(!['postgresql:','postgres:'].includes(url.protocol))stop('DB_URI_PROTOCOL');
 const host=url.hostname,user=decodeURIComponent(url.username),db=decodeURIComponent(url.pathname.slice(1)),pass=decodeURIComponent(url.password);
 if(!host||!user||!db||!pass||!(host+'.'+user).includes(PROD_REF))stop('PRODUCTION_PROJECT_PIN_FAILED');
 if(!host.toLowerCase().includes('pooler')||(url.port||'5432')!=='6543')
   stop('EXPECTED_ORIGINAL_POOLER_6543');
 return {PGHOST:host,PGUSER:user,PGPASSWORD:pass,PGDATABASE:db,PGSSLMODE:url.searchParams.get('sslmode')||'require',
 PGCONNECT_TIMEOUT:'6',PGAPPNAME:'betvima-stage17-readonly-network-probe',PATH:process.env.PATH||'/usr/bin:/bin',HOME:'/root'};
}
function checkPsql(){
 const bin='/usr/lib/postgresql/17/bin/psql';
 const r=cp.spawnSync(bin,['--version'],{encoding:'utf8',timeout:5000});
 if(r.status!==0||!/psql \(PostgreSQL\) 17\./.test(r.stdout||''))stop('PSQL17_UNAVAILABLE');
 return bin;
}
function enumError(s,child){
 const t=String(s||'').toLowerCase();
 if(child.error?.code==='ETIMEDOUT'||/operation timed out|timeout expired|connection timed out/.test(t))return 'TIMEOUT';
 if(/no route to host|network is unreachable|network unreachable/.test(t))return 'NO_NETWORK_ROUTE';
 if(/connection refused/.test(t))return 'CONNECTION_REFUSED';
 if(/could not translate host name|name or service not known|temporary failure in name resolution/.test(t))return 'DNS_FAILURE';
 if(/password authentication failed|authentication failed|invalid password/.test(t))return 'AUTH_REJECTED';
 if(/tenant or user not found|tenant.*not found|user not found/.test(t))return 'POOLER_TENANT_NOT_FOUND';
 if(/remaining connection slots|too many clients|too many connections/.test(t))return 'POOL_LIMIT';
 if(/unsupported startup|unsupported parameter|parameter "options"|unrecognized configuration parameter/.test(t))return 'STARTUP_OPTIONS_REJECTED';
 if(/ssl|certificate|tls|handshake/.test(t))return 'TLS_ERROR';
 if(/no password supplied|password required/.test(t))return 'PASSWORD_UNAVAILABLE';
 if(/permission denied/.test(t))return 'PERMISSION_REJECTED';
 if(/server closed the connection|unexpectedly|connection reset/.test(t))return 'SOCKET_CLOSED';
 if(/could not connect|connection to server/.test(t))return 'CONNECT_FAILED_UNCLASSIFIED';
 if(/psql: error|fatal:|error:/.test(t))return 'PSQL_ERROR_UNCLASSIFIED';
 return t?'UNKNOWN':'NO_STDERR';
}
async function tcp(host,port){
 return await new Promise(resolve=>{
   let finished=false;
   const done=(v)=>{if(finished)return;finished=true;socket.destroy();resolve(v)};
   const socket=net.createConnection({host,port});
   socket.setTimeout(6000);
   socket.once('connect',()=>done('PASS'));
   socket.once('timeout',()=>done('TIMEOUT'));
   socket.once('error',e=>{
     const code=String(e.code||'').toUpperCase();
     done(['ECONNREFUSED','ENETUNREACH','EHOSTUNREACH','ETIMEDOUT','EAI_AGAIN','ENOTFOUND'].includes(code)?code:'OTHER_NETWORK_ERROR');
   });
 });
}
function psql(bin,env,port,options){
 const childEnv={...env,PGPORT:String(port)};
 if(options)childEnv.PGOPTIONS='-c default_transaction_read_only=on -c statement_timeout=8000';
 const r=cp.spawnSync(bin,['-X','-w','-A','-t','-v','ON_ERROR_STOP=1','-c','SELECT 1'],{
   env:childEnv,encoding:'utf8',timeout:12000,maxBuffer:65536
 });
 if(r.status===0&&String(r.stdout||'').trim()==='1')return {ok:true,error:'NONE'};
 return {ok:false,error:enumError(r.stderr,r)};
}
(async()=>{
 out('MODE','READONLY_NETWORK_AND_SELECT1_ONLY');
 const env=validatedEnv(),bin=checkPsql();
 const dnsRows=await dns.lookup(env.PGHOST,{all:true,verbatim:true}).catch(()=>[]);
 out('DNS_IPV4_PRESENT',dnsRows.some(x=>x.family===4));
 out('DNS_IPV6_PRESENT',dnsRows.some(x=>x.family===6));
 // IPv4/IPv6 addresses and hostnames are NOT printed.
 const trans=await tcp(env.PGHOST,6543);
 out('TRANSACTION_6543_TCP',trans);
 const sess=await tcp(env.PGHOST,5432);
 out('SESSION_5432_TCP',sess);
 if(trans==='PASS'){
   const r=psql(bin,env,6543,false);
   out('TRANSACTION_6543_SELECT1',r.ok?'PASS':'FAIL');
   if(!r.ok)out('TRANSACTION_6543_ERROR_CATEGORY',r.error);
 }else out('TRANSACTION_6543_SELECT1','SKIPPED_TCP_FAILURE');
 if(sess==='PASS'){
   const r=psql(bin,env,5432,false);
   out('SESSION_5432_SELECT1',r.ok?'PASS':'FAIL');
   if(!r.ok)out('SESSION_5432_ERROR_CATEGORY',r.error);
   if(r.ok){
     const x=psql(bin,env,5432,true);
     out('SESSION_5432_READONLY_STARTUP',x.ok?'PASS':'FAIL');
     if(!x.ok)out('SESSION_5432_READONLY_STARTUP_CATEGORY',x.error);
   }
 }else out('SESSION_5432_SELECT1','SKIPPED_TCP_FAILURE');
 out('DB_SQL_WRITES',0);
 out('LIVE_3098_CHANGED',false);
 out('DIAGNOSTIC_FINISHED',true);
})().catch(e=>{
 if(e.message!=='CONTROLLED_STOP')out('FAIL_SAFE_ERROR',String(e.code||e.name||'ERROR').replace(/[^A-Za-z0-9_-]/g,'').slice(0,40));
 process.exitCode=2;
});
