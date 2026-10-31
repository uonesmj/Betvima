#!/usr/bin/env node
'use strict';
// Stage11: test exact production and patched shadow PostgreSQL adapter against
// a temporary local PostgreSQL container on a private UNIX socket only.
// NO production DB URL, customer keys, casino RPCs, provider calls or server edits.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const vm=require('node:vm'),assert=require('node:assert/strict');
const ROOT='/opt/nova-releases/casino-3098-eligible-fallback-HU6Rbl';
const TESTROOT='/root/betvima-stage5/stage10-timeout-candidate';
const LIVE=path.join(ROOT,'src/server/db/postgres.ts');
const SHADOW=path.join(TESTROOT,'live-shadow/postgres.ts');
const CONTEXT=path.join(ROOT,'src/server/db/transaction-timeout-context.ts');
const SOCK=process.argv[2];
if(!SOCK||!/^\/root\/betvima-stage5\/stage11-socket\.[A-Za-z0-9]+$/.test(SOCK)){
 console.log('STAGE11_ABORT=UNSAFE_SOCKET_PATH');process.exit(2);
}
function pin(file,expected){
 const bytes=fs.readFileSync(file),sha=crypto.createHash('sha256').update(bytes).digest('hex').slice(0,12);
 if(sha!==expected)throw Error('STAGE11_SOURCE_HASH_CHANGED');
 return bytes.toString('utf8');
}
const original=pin(LIVE,'3d66c5724ff6');
const shadow=pin(SHADOW,'e02a19a9f3bf');
const contextSource=pin(CONTEXT,'3b09fb01e7b3');
let ts;
for(const p of [path.join(ROOT,'node_modules/typescript'),'/usr/local/lib/node_modules/typescript']){
 try{ts=require(p);break}catch{}
}
if(!ts){console.log('STAGE11_ABORT=TYPESCRIPT_UNAVAILABLE');process.exit(2)}
const realPg=require(path.join(ROOT,'node_modules/pg'));
function compile(text,file){
 const out=ts.transpileModule(text,{fileName:file,reportDiagnostics:true,compilerOptions:{
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,strict:true
 }});
 if((out.diagnostics||[]).some(x=>x.category===ts.DiagnosticCategory.Error))
  throw Error('STAGE11_TYPESCRIPT_DIAGNOSTICS');
 return out.outputText;
}
const contextModule={exports:{}};
const contextRequire=id=>{
 if(id==='node:async_hooks'||id==='async_hooks')
  return {AsyncLocalStorage:require('node:async_hooks').AsyncLocalStorage};
 throw Error('STAGE11_CONTEXT_IMPORT_UNAPPROVED');
};
const contextFactory=vm.runInNewContext('(function(require,module,exports){'+
 compile(contextSource,'transaction-timeout-context.ts')+'\n})',{}, {timeout:1000});
contextFactory(contextRequire,contextModule,contextModule.exports);
function adapter(source,tag){
 const recorded=[];
 class SocketPool extends realPg.Pool{
  constructor(config){
   super({...config,host:SOCK,port:5432,user:'postgres',database:'postgres',
     password:undefined,ssl:false,max:1,connectionTimeoutMillis:5000});
   // pg's Pool.query uses a callback to Pool.connect; never override connect.
   this.on('connect',(client)=>{
    if(client.__stage11Wrapped)return;
    const actualQuery=client.query.bind(client);
    client.query=(...args)=>{
     const sql=String(args[0]).trim();
     if(!/^(?:begin\s+read\s+write|commit|rollback|set\s+local\s+statement_timeout|create\s+table\s+stage11_|insert\s+into\s+stage11_|update\s+stage11_|select\s+(?:1|2|3|value|count\(\*\)|current_setting|pg_sleep)|show\s+statement_timeout)/i.test(sql))
      throw Error('STAGE11_UNAPPROVED_SQL');
     recorded.push(sql);
     return actualQuery(...args);
    };
    client.__stage11Wrapped=true;
   });
  }

 }
 const m={exports:{}};
 const safeRequire=id=>{
  if(id==='pg')return {Pool:SocketPool};
  if(id==='./rows')return {param:x=>x};
  if(id==='./transaction-timeout-context')return contextModule.exports;
  throw Error('STAGE11_ADAPTER_IMPORT_UNAPPROVED');
 };
 new Function('require','module','exports',compile(source,'postgres.ts'))(safeRequire,m,m.exports);
 if(typeof m.exports.PostgresDb!=='function')throw Error('STAGE11_ADAPTER_NOT_FOUND');
 const db=new m.exports.PostgresDb({host:SOCK,user:'postgres',database:'postgres',
  max:1,statementTimeoutMs:10000});
 return {db,recorded,tag};
}
function timeoutMs(t){
 const match=String(t).trim().match(/^(\d+)(ms|s|min)?$/);
 if(!match)throw Error('STAGE11_TIMEOUT_FORMAT_UNEXPECTED');
 return Number(match[1])*({ms:1,s:1000,min:60000}[match[2]||'ms']);
}
function check(test,label){
 assert.ok(test,label);
 console.log('STAGE11_CASE_'+label+'=PASS');
}
async function run(source,label){
 const {db,recorded}=adapter(source,label);
 const table='stage11_'+label;
 try{
  await db.query('CREATE TABLE '+table+' (id integer PRIMARY KEY, value integer NOT NULL)');
  recorded.length=0;
  await db.transaction(async tx=>{
   for(let i=0;i<6;i++){
    const x=await tx.queryOne('SELECT 1 AS value');
    assert.equal(x.value,1);
   }
  });
  const setCount=recorded.filter(x=>/^set\s+local\s+statement_timeout/i.test(x)).length;
  check(recorded.some(x=>/^begin/i.test(x))&&recorded.some(x=>/^commit/i.test(x)),
    label.toUpperCase()+'_COMMIT_BOUNDARIES');
  recorded.length=0;
  await db.transaction(async tx=>{
   await tx.query('INSERT INTO '+table+' (id,value) VALUES ($1,$2)',[1,10]);
   const first=await tx.queryOne('SELECT value FROM '+table+' WHERE id=$1',[1]);
   assert.equal(first.value,10);
   const custom=await tx.queryOne("SELECT current_setting('statement_timeout') AS value",[],
     {timeoutMs:2500});
   assert.equal(timeoutMs(custom.value),2500);
   const reset=await tx.queryOne("SELECT current_setting('statement_timeout') AS value");
   assert.equal(timeoutMs(reset.value),10000);
  });
  const committed=await db.queryOne('SELECT value FROM '+table+' WHERE id=$1',[1]);
  check(committed.value===10,label.toUpperCase()+'_COMMIT_AND_TIMEOUT_OVERRIDES');
  let rolledBack=false;
  try{
   await db.transaction(async tx=>{
    await tx.query('UPDATE '+table+' SET value=$1 WHERE id=$2',[77,1]);
    throw Error('STAGE11_INTENTIONAL_ROLLBACK');
   });
  }catch(e){
   if(e.message==='STAGE11_INTENTIONAL_ROLLBACK')rolledBack=true;
   else throw e;
  }
  const stable=await db.queryOne('SELECT value FROM '+table+' WHERE id=$1',[1]);
  check(rolledBack&&stable.value===10,label.toUpperCase()+'_ROLLBACK_ATOMICITY');
  let cancelled='';
  try{await db.transaction(tx=>tx.query('SELECT pg_sleep(1.15)',[],{timeoutMs:1000}))}
  catch(e){cancelled=String(e.code||'')}
  check(cancelled==='57014',label.toUpperCase()+'_SERVER_TIMEOUT_ENFORCED');
  return setCount;
 }finally{await db.close()}
}
(async()=>{
 console.log('STAGE11_POSTGRES_TRANSPORT=PRIVATE_UNIX_SOCKET');
 console.log('STAGE11_SHADOW_HASH12=e02a19a9f3bf');
 console.log('STAGE11_SQL_PHASE=ORIGINAL_START');
 const before=await run(original,'original');
 console.log('STAGE11_SQL_PHASE=SHADOW_START');
 const after=await run(shadow,'shadow');
 console.log('STAGE11_ORIGINAL_SET_LOCAL_FOR_6_QUERIES='+before);
 console.log('STAGE11_SHADOW_SET_LOCAL_FOR_6_QUERIES='+after);
 check(before===6&&after===1,'SET_LOCAL_DEDUPED_REAL_POSTGRES');
 console.log('STAGE11_REAL_POSTGRES_INTEGRATION=PASS');
 console.log('STAGE11_PRODUCTION_DATABASE_CONNECTED=false');
 console.log('STAGE11_LIVE_WALLET_OPERATIONS=0');
 console.log('STAGE11_LIVE_3098_UNCHANGED=true');
})().catch(e=>{
 console.log('STAGE11_REAL_POSTGRES_INTEGRATION=FAIL CODE='+
   String(e.code||e.message||'ERROR').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,70));
 process.exitCode=2;
});
