#!/usr/bin/env node
'use strict';
// BetVima Stage17: read-only, no-auth PostgreSQL SSLRequest/TLS handshake
// and ONE noninteractive SELECT 1 per reachable pooler port.
// Does not run pg_dump, write DB, modify 3098, expose credentials or log raw errors.
const fs=require('node:fs'),cp=require('node:child_process'),net=require('node:net'),tls=require('node:tls'),path=require('node:path');
const LIVE='/opt/nova-releases/casino-3098-eligible-fallback-HU6Rbl',REF='mqygiufkubxxxjodsycu';
const log=(k,v)=>console.log('STAGE17_TLS_'+k+'='+v);
function fail(s){log('ABORT',s);throw new Error('CONTROLLED_ABORT')}
function connection(){
 if(process.getuid()!==0)fail('ROOT_REQUIRED');
 if(!fs.realpathSync(LIVE).startsWith('/opt/nova-releases/casino-3098-eligible-fallback-'))fail('ACTIVE_RELEASE_MISMATCH');
 const r=cp.spawnSync('/usr/bin/ss',['-ltnpH'],{encoding:'utf8',timeout:5000,maxBuffer:60000});
 if(r.status!==0)fail('SS_FAILED');
 const ids=[...new Set(r.stdout.split('\n').filter(x=>/:3098(?:\s|$)/.test(x)).flatMap(x=>[...x.matchAll(/\bpid=(\d+)/g)].map(m=>m[1])))];
 if(ids.length!==1)fail('ACTIVE_3098_PID_AMBIGUOUS');
 const bytes=fs.readFileSync('/proc/'+ids[0]+'/environ');
 if(bytes.length>200000)fail('LIVE_ENV_TOO_LARGE');
 const env={};
 for(const v of bytes.toString('utf8').split('\0')){const i=v.indexOf('=');if(i>0)env[v.slice(0,i)]=v.slice(i+1)}
 // Use ONLY existing pinned source, no new host or credentials.
 try{require(path.join(LIVE,'node_modules/@next/env')).loadEnvConfig(LIVE,false)}catch{}
 const value=env.SUPABASE_DB_URL||process.env.SUPABASE_DB_URL||env.DATABASE_URL||process.env.DATABASE_URL;
 if(!value)fail('PRODUCTION_DB_URL_NOT_AVAILABLE');
 let u;try{u=new URL(value)}catch{fail('DB_URI_INVALID')}
 const host=u.hostname,user=decodeURIComponent(u.username),password=decodeURIComponent(u.password),db=decodeURIComponent(u.pathname.replace(/^\//,''));
 if(!['postgresql:','postgres:'].includes(u.protocol)||!host||!user||!password||!db||
    !(host+'.'+user).includes(REF)||!host.toLowerCase().includes('pooler')||u.port!=='6543')
   fail('PINNED_POOLER_6543_REQUIRED');
 return {host,env:{
    PGHOST:host,PGUSER:user,PGPASSWORD:password,PGDATABASE:db,
    PGAPPNAME:'betvima-stage17-tls-diagnostic',PGCONNECT_TIMEOUT:'6',
    PGSSLMODE:u.searchParams.get('sslmode')||'require',
    HOME:'/root',PATH:process.env.PATH||'/usr/bin:/bin'}};
}
function category(err){
 const s=String(err?.message||'').toLowerCase(),code=String(err?.code||'');
 if(/CERT_|ERR_TLS_CERT|UNABLE_TO_VERIFY|SELF_SIGNED|DEPTH_ZERO_SELF|CERT_HAS_EXPIRED|ERR_TLS_CERT_ALTNAME/i.test(code)||/certificate verify failed|certificate has expired|hostname.*certificate|self.signed certificate/.test(s))return 'CERTIFICATE_VALIDATION';
 if(/ERR_TLS|SSL_ERROR|SSL_ROUTINES/i.test(code)||/handshake failure|wrong version number|tlsv1|unsupported protocol|no shared cipher/.test(s))return 'TLS_NEGOTIATION';
 if(['ETIMEDOUT','ESOCKETTIMEDOUT'].includes(code))return 'TIMEOUT';
 if(['ECONNRESET','EPIPE'].includes(code))return 'CONNECTION_CLOSED';
 if(['ECONNREFUSED','ENETUNREACH','EHOSTUNREACH','ENOTFOUND','EAI_AGAIN'].includes(code))return 'NETWORK_ERROR';
 return 'OTHER_TLS_ERROR';
}
async function postgresSslHandshake(host,port){
 return new Promise(resolve=>{
  let done=false,secure=null,tcp=null,clock=null;
  const finish=(result)=>{
    if(done)return;done=true;clearTimeout(clock);
    if(secure)secure.destroy();
    if(tcp)tcp.destroy();
    resolve(result);
  };
  clock=setTimeout(()=>finish({request:'TIMEOUT',handshake:'TIMEOUT'}),11000);
  tcp=net.connect({host,port});
  tcp.once('error',e=>finish({request:'TCP_ERROR',handshake:category(e)}));
  tcp.once('connect',()=>{
    // PostgreSQL SSLRequest: length=8, code=80877103, no auth data.
    tcp.write(Buffer.from([0,0,0,8,4,210,22,47]));
  });
  tcp.once('data',bytes=>{
    const code=bytes[0];
    if(code!==83)return finish({request:code===78?'N':'UNEXPECTED',handshake:'NOT_STARTED'});
    tcp.pause();
    // Native Postgres TLS extension over same accepted TCP socket.
    secure=tls.connect({socket:tcp,servername:host,rejectUnauthorized:true,minVersion:'TLSv1.2'});
    secure.once('secureConnect',()=>finish({request:'S',handshake:secure.authorized?'VERIFIED':'UNVERIFIED',version:secure.getProtocol()}));
    secure.once('error',e=>finish({request:'S',handshake:category(e)}));
    tcp.resume();
  });
  tcp.once('close',()=>{if(!secure)finish({request:'SOCKET_CLOSED',handshake:'NOT_STARTED'})});
 });
}
function psqlCategory(raw){
 const s=String(raw||'').toLowerCase();
 // Sorted most-specific first; do not group all 'ssl' occurrences together.
 if(/certificate verify failed|certificate has expired|self.signed certificate|hostname mismatch/.test(s))return 'CERTIFICATE_VALIDATION';
 if(/ssl sy[s]?call error|eof detected|unexpected eof|server closed the connection unexpectedly/.test(s))return 'TLS_EOF_OR_SOCKET_CLOSED';
 if(/server does not support ssl|server refused ssl|ssl is not enabled/.test(s))return 'SSL_UNSUPPORTED_BY_ENDPOINT';
 if(/ssl error|tls handshake|wrong version number|unsupported protocol/.test(s))return 'TLS_HANDSHAKE_ERROR';
 if(/password authentication failed|invalid password/.test(s))return 'AUTHENTICATION_REJECTED';
 if(/tenant or user not found|tenant.*not found/.test(s))return 'POOLER_TENANT_NOT_FOUND';
 if(/unknown startup parameter|unsupported startup|unsupported parameter|unrecognized configuration parameter/.test(s))return 'STARTUP_OPTION_REJECTED';
 if(/connection refused|network is unreachable|no route to host/.test(s))return 'NETWORK_REJECTED';
 if(/timeout expired|connection timed out|operation timed out/.test(s))return 'TIMEOUT';
 if(/could not translate host name|name or service not known/.test(s))return 'DNS_FAILED';
 if(/no password supplied|password required/.test(s))return 'PASSWORD_UNAVAILABLE';
 if(/permission denied/.test(s))return 'PERMISSION_REJECTED';
 if(/error:|fatal:/.test(s))return 'OTHER_LIBPQ_ERROR';
 return s?'UNCLASSIFIED':'NO_STDERR';
}
function psqlSelect(env,port){
 const bin='/usr/lib/postgresql/17/bin/psql';
 if(!fs.existsSync(bin))return {result:'SKIPPED',reason:'PSQL17_NOT_FOUND'};
 const r=cp.spawnSync(bin,['-X','-w','-A','-t','-v','ON_ERROR_STOP=1','-c','SELECT 1'],{
   env:{...env,PGPORT:String(port)},encoding:'utf8',timeout:12000,maxBuffer:16384
 });
 return r.status===0&&String(r.stdout||'').trim()==='1'?
  {result:'PASS',reason:'NONE'}:{result:'FAIL',reason:psqlCategory(r.stderr),status:Number.isInteger(r.status)?r.status:'NONE'};
}
(async()=>{
 log('MODE','SSL_REQUEST_TLS_AND_SELECT1_READONLY');
 const {host,env}=connection();
 // libpq with sslmode=require may verify an existing root.crt implicitly.
 // Report ONLY presence, never its path, content, or identity.
 log('LIBPQ_DEFAULT_ROOT_CERT_PRESENT',fs.existsSync('/root/.postgresql/root.crt'));
 log('LIBPQ_SSLMODE_CLASS',new Set(['require','verify-full','verify-ca']).has(env.PGSSLMODE)?env.PGSSLMODE.toUpperCase():'OTHER');
 for(const port of [6543,5432]){
   const label=port===6543?'TRANSACTION_6543':'SESSION_5432';
   const ssl=await postgresSslHandshake(host,port);
   log(label+'_SSL_REQUEST',ssl.request);
   log(label+'_TLS_HANDSHAKE',ssl.handshake);
   if(ssl.version)log(label+'_NEGOTIATED_TLS_VERSION',ssl.version);
   // Exactly one SELECT 1 on an established route, no credentials in output.
   if(ssl.request==='S'){
     const r=psqlSelect(env,port);
     log(label+'_SELECT1',r.result);
     if(r.result==='FAIL')log(label+'_LIBPQ_FAILURE_CATEGORY',r.reason);
   }else log(label+'_SELECT1','SKIPPED_NO_SSL');
 }
 log('PRODUCTION_SQL_WRITES',0);
 log('LIVE_3098_CHANGED',false);
 log('DIAGNOSTIC_FINISHED',true);
})().catch(e=>{if(e.message!=='CONTROLLED_ABORT')log('FAIL_SAFE',String(e.name||'ERROR').replace(/[^a-zA-Z_]/g,''));process.exitCode=2});
