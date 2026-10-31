#!/usr/bin/env node
'use strict';
/**
 * Stage17 read-only NOVA schema archive: a PRIVATE LOCAL working copy only.
 * Explicitly never dumps customer rows, balances, KYC, auth/storage or credentials.
 * Runs locally installed PostgreSQL 17+ pg_dump as a READ-ONLY session
 * against PINNED PRODUCTION PROJECT ONLY; no package installation.
 * Uses sanitized failures, a same-host Session Pooler (5432) probe,
 * then schema-only dump; never prints raw database stderr.
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
function getMajor(bin,tool){
 const out=cp.spawnSync(bin,['--version'],{encoding:'utf8',timeout:6000,maxBuffer:4096});
 if(out.status!==0)return null;
 const match=(out.stdout||'').match(/\(PostgreSQL\)\s*(\d+)(?:\.\d+)?/i);
 return match?Number(match[1]):null;
}
function resolveMatchingClientPair(){
 const candidates=[
  '/usr/lib/postgresql/17/bin',
  '/usr/lib/postgresql/18/bin',
  '/usr/lib/postgresql/19/bin',
  '/usr/bin'
 ];
 const observed=new Set();
 for(const base of candidates){
   const dump=path.join(base,'pg_dump');
   const restore=path.join(base,'pg_restore');
   if(!commandExists(dump)||!commandExists(restore))continue;
   const d=getMajor(dump,'pg_dump'),r=getMajor(restore,'pg_restore');
   if(d!=null)observed.add(String(d));
   if(d>=17 && d===r){
      MSG('SELECTED_PG_DUMP_CLIENT_MAJOR='+String(d));
      return {dump,restore};
   }
 }
 MSG('LOCAL_PG_DUMP_CLIENT_MAJORS='+([...observed].sort().join(',')||'none'));
 abort('POSTGRESQL_17_CLIENT_REQUIRED');
}
function classifyPgDumpFailure(text,child){
 const s=String(text||'').toLowerCase();
 if(child.error?.code==='ETIMEDOUT')return 'PROCESS_TIME_LIMIT_EXCEEDED';
 if(child.error?.code==='ENOBUFS')return 'STDERR_LIMIT_EXCEEDED';
 if(child.error?.code==='EACCES')return 'EXECUTABLE_ACCESS_DENIED';
 if(child.error?.code==='ENOENT')return 'EXECUTABLE_MISSING';
 if(/server version mismatch|aborting because of server version mismatch/.test(s))return 'SERVER_CLIENT_VERSION_MISMATCH';
 if(/unsupported startup parameter|unsupported startup option|unsupported startup|pgbouncer|supavisor/.test(s))
   return 'POOLER_STARTUP_PARAMETER_REJECTED';
 if(/unrecognized configuration parameter|invalid value for parameter|permission denied to set parameter|parameter "options"/.test(s))
   return 'SESSION_OPTION_REJECTED';
 if(/password authentication failed|authentication failed|invalid password/.test(s))
   return 'AUTHENTICATION_REJECTED';
 if(/no password supplied|password required/.test(s))return 'MISSING_PASSWORD';
 if(/could not translate host name|name or service not known|temporary failure in name resolution/.test(s))
   return 'DNS_RESOLUTION';
 if(/ssl connection|ssl error|certificate verify failed|self.signed certificate|certificate has expired/.test(s))
   return 'TLS_HANDSHAKE_OR_CERTIFICATE';
 if(/connection refused|timeout expired|could not connect to server|network is unreachable|connection timed out|server closed the connection/.test(s))
   return 'CONNECTION_UNAVAILABLE';
 if(/permission denied|must be owner|insufficient privilege|row-level security/.test(s))
   return 'READ_PERMISSION_DENIED';
 if(/canceling statement due to lock timeout|could not obtain lock|lock timeout/.test(s))
   return 'LOCK_TIMEOUT';
 if(/canceling statement due to statement timeout|statement timeout/.test(s))
   return 'STATEMENT_TIMEOUT';
 if(/no matching schemas were found|schema .* does not exist/.test(s))
   return 'NOVA_SCHEMA_NOT_FOUND_OR_HIDDEN';
 if(/query failed|query was|sqlstate|could not execute query/.test(s))
   return 'QUERY_FAILED';
 if(/could not open output file|could not write to output file|no space left on device|disk quota/.test(s))
   return 'LOCAL_ARCHIVE_WRITE_ERROR';
 if(/invalid option|unrecognized option|option requires an argument/.test(s))
   return 'UNSUPPORTED_DUMP_FLAG';
 if(/permission denied for database|permission denied for schema/.test(s))
   return 'READ_PERMISSION_DENIED';
 if(/fatal:/.test(s))return 'DATABASE_FATAL_UNCATEGORIZED';
 if(/error:/.test(s))return 'ERROR_UNCATEGORIZED';
 if(!s.trim())return 'NO_STDERR_REPORTED';
 return 'UNKNOWN_REDACTED';
}
function dumpDiagnostic(text, child, env, client){
 // Output only short enum/status metadata. NEVER output raw pg_dump/psql stderr,
 // SQL, connection URLs, hostnames, usernames or source function bodies.
 const err=String(text||'');
 const validStatus=Number.isInteger(child.status)&&child.status>=0&&child.status<=255;
 MSG('PG_DUMP_EXIT_STATUS='+(validStatus?child.status:'NON_NUMERIC'));
 const signals=new Set(['SIGTERM','SIGKILL','SIGINT','SIGHUP']);
 MSG('PG_DUMP_SIGNAL='+(signals.has(child.signal)?child.signal:'NONE'));
 MSG('PG_DUMP_STDERR_NONEMPTY='+(err.length>0));
 MSG('PG_DUMP_STDERR_LENGTH_BAND='+(err.length===0?'ZERO':err.length<200?'SHORT':err.length<1500?'MEDIUM':'LONG'));
 const reason=classifyPgDumpFailure(err,child);
 MSG('PG_DUMP_DIAGNOSTIC_CATEGORY='+reason);
 // Redacted digest helps distinguish repeated errors without disclosing text.
 MSG('PG_DUMP_STDERR_SHA256_PREFIX='+crypto.createHash('sha256').update(err).digest('hex').slice(0,12));
 // Probe exactly one trivial read-only request with the SAME validated target
 // and PGOPTIONS. Never test using alternative hosts or user credentials.
 const psql=path.join(path.dirname(client.dump),'psql');
 if(!commandExists(psql)||getMajor(psql,'psql')<17){
   MSG('READONLY_CONNECT_PROBE=SKIPPED_MISSING_MATCHING_PSQL');
   return;
 }
 const probe=cp.spawnSync(psql,['--no-psqlrc','--no-align','--tuples-only','--command','SELECT 1'],{
   env,encoding:'utf8',timeout:12000,maxBuffer:65536
 });
 if(probe.status===0&&probe.stdout.trim()==='1')
   MSG('READONLY_CONNECT_PROBE=PASS');
 else {
   MSG('READONLY_CONNECT_PROBE=FAILED');
   MSG('READONLY_CONNECT_PROBE_CATEGORY='+classifyPgDumpFailure(probe.stderr,probe));
 }
}


function chooseReadOnlySessionRoute(env, client){
 // Supabase recommends DIRECT for pg_dump and SESSION pooler for persistent
 // connections; 6543 transaction pooler is unsuitable for native schema dumps.
 // Never derive a new hostname, project, user or database. Only change the
 // port in THIS CHILD PROCESS from 6543 to the same host's session port 5432.
 const host=String(env.PGHOST||'').toLowerCase();
 const port=String(env.PGPORT||'');
 const username=String(env.PGUSER||'');
 if(!host.includes('pooler')||port!=='6543'||
    !(host+'.'+username).includes(PRODUCTION_REF)){
    abort('EXPECTED_PINNED_TRANSACTION_POOLER_6543');
 }
 const psql=path.join(path.dirname(client.dump),'psql');
 if(!commandExists(psql)||getMajor(psql,'psql')<17)
    abort('PSQL17_REQUIRED_FOR_READONLY_PROBE');
 const session={...env,PGPORT:'5432'};
 const modes=[
   {name:'SERVER_READONLY_STARTUP',env:session},
   {name:'NO_STARTUP_OPTIONS',env:{...session}}
 ];
 // The Supavisor protocol may reject PGOPTIONS as unsupported startup config.
 delete modes[1].env.PGOPTIONS;
 for(const mode of modes){
   const probe=cp.spawnSync(psql,
      ['-X','-w','-A','-t','-v','ON_ERROR_STOP=1','-c','SELECT 1'],{
         env:mode.env,encoding:'utf8',timeout:12000,maxBuffer:65536
      });
   const success=probe.status===0&&String(probe.stdout||'').trim()==='1';
   MSG('SESSION_PROBE_'+mode.name+'='+(success?'PASS':'FAIL'));
   if(success){
      MSG('DATABASE_ROUTE_FOR_DUMP=SESSION_POOLER_SAME_HOST');
      MSG('PG_DUMP_STARTUP_READONLY_OPTION='+(mode.name==='SERVER_READONLY_STARTUP'?'ENABLED':'UNSUPPORTED'));
      MSG('READONLY_CONNECT_PROBE=PASS');
      return mode.env;
   }
   MSG('SESSION_PROBE_'+mode.name+'_CATEGORY='+classifyPgDumpFailure(probe.stderr,probe));
 }
 abort('NO_WORKING_SESSION_POOLER_ROUTE');
}

function main(){
 MSG('MODE=SCHEMA_ONLY_PRIVATE_BACKUP');
 if(process.getuid()!==0)abort('ROOT_REQUIRED_FOR_PRIVATE_ARCHIVE');
 if(!fs.realpathSync(LIVE).startsWith('/opt/nova-releases/casino-3098-eligible-fallback-'))
    abort('LIVE_RELEASE_PATH_UNEXPECTED');
 const client=resolveMatchingClientPair();
 if(!fs.statSync(ROOT).isDirectory()||fs.lstatSync(ROOT).isSymbolicLink())
    abort('WORK_ROOT_NOT_SAFE');
 const env=envForDump();
 // Safe endpoint CLASS only, never reveal host/IP/username/password.
 const host=String(env.PGHOST||'').toLowerCase();
 const port=String(env.PGPORT||'');
 MSG('DATABASE_ROUTE_CLASS='+(host.includes('pooler')?'POOLER':host.startsWith('db.')?'DIRECT':'OTHER_PINNED'));
 MSG('DATABASE_PORT_CLASS='+(port==='6543'?'TRANSACTION_POOLER':port==='5432'?'SESSION_OR_DIRECT':'OTHER'));
 // Fail closed if same-host Supabase SESSION route cannot handle a
 // harmless read-only SELECT 1. Never run pg_dump through transaction mode.
 const dumpEnv=chooseReadOnlySessionRoute(env,client);
 if(process.env.STAGE17_PROBE_ONLY==='1'){
   MSG('PRODUCTION_SQL_WRITES=0');
   MSG('ACTIVE_CASINO_3098_CHANGED=false');
   return;
 }
 const dir=fs.mkdtempSync(path.join(ROOT,'stage17-schema-only.'));
 fs.chmodSync(dir,0o700);
 const archive=path.join(dir,'private-nova-schema-only.dump');
 try{
   // No data flags, no source account content, no auth/storage schema.
   const args=['--format=custom','--schema-only','--schema=nova',
    '--no-owner','--no-privileges','--lock-wait-timeout=2s',
    '--file='+archive];
   const r=cp.spawnSync(client.dump,args,{env:dumpEnv,
      timeout:150000,encoding:'utf8',maxBuffer:1024*1024});
   // Only print an ENUM diagnostic, never raw stderr, connection URL or secrets.
   if(r.status!==0 || r.error){
     dumpDiagnostic(r.stderr,r,dumpEnv,client);
     abort('PG_DUMP_'+classifyPgDumpFailure(r.stderr,r));
   }
   fs.chmodSync(archive,0o600);
   const st=fs.statSync(archive);
   if(st.size<1000||st.size>80000000)abort('ARCHIVE_SIZE_OUT_OF_RANGE');
   const l=cp.spawnSync(client.restore,['--list',archive],{
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
