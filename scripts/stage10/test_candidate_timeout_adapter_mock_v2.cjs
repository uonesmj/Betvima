#!/usr/bin/env node
'use strict';
/**
 * BetVima Stage10: execute candidate TS database adapter with in-memory pg mock.
 * No PostgreSQL, users, network, live process, wallet account, server secrets.
 * Requires locally available TypeScript compiler, already installed by many builds.
 * Input: one downloaded candidate postgres.ts from draft GitHub branch.
 */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),vm=require('node:vm'),crypto=require('node:crypto');
const source=process.argv[2];
if(!source || !fs.existsSync(source)) throw Error('STAGE10_CANDIDATE_TS_FILE_REQUIRED');
let ts;
for (const guess of ['typescript',
 '/opt/nova-releases/casino-3098-eligible-fallback-HU6Rbl/node_modules/typescript',
 path.join(path.dirname(path.dirname(process.execPath)),'lib/node_modules/typescript'),
 '/usr/local/lib/node_modules/typescript']){
 try{ts=require(guess);break}catch{}
}
if(!ts){
 console.log('STAGE10_TEST=BLOCKED_TYPESCRIPT_COMPILER_UNAVAILABLE');
 process.exit(2);
}
const code=fs.readFileSync(source,'utf8');
const numericCache =
  code.includes('private appliedStatementTimeoutMs: number | null = null') &&
  (code.includes('this.appliedStatementTimeoutMs !== timeout') ||
   code.includes('this.appliedStatementTimeoutMs !== nextStatementTimeoutMs'));
const sqlCache =
  code.includes('private stage10AppliedTimeoutSql: string | null = null') &&
  code.includes('this.stage10AppliedTimeoutSql !== stage10TimeoutSql');
if(!(numericCache || sqlCache)) {
 console.log('STAGE10_TEST=BLOCKED_CANDIDATE_GUARD_FAILED');
 process.exit(2);
}
const output=ts.transpileModule(code,{compilerOptions:{
  target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,strict:true
},fileName:'postgres.ts',reportDiagnostics:true});
const errors=(output.diagnostics||[]).filter(x=>x.category===ts.DiagnosticCategory.Error);
if(errors.length){
 console.log('STAGE10_TYPESCRIPT_TRANSPILE=FAIL COUNT='+errors.length);process.exit(2);
}
const calls=[],release=[];
let failing=false;
const client={
 async query(sql,values){
  calls.push({sql,values});
  if(failing && sql==='SELECT FAIL')throw Error('DB_TEST_FAILURE');
  return {rows:[{balance_minor:1000}]};
 },
 release(){release.push(true)}
};
class FakePool {
 async query(sql,values){calls.push({sql,values});return {rows:[]}}
 async connect(){return client}
 on(){return this}
 async end(){}
}
const compiledModule={exports:{}};
const LIVE_SOURCE_ROOT='/opt/nova-releases/casino-3098-eligible-fallback-HU6Rbl/src/server/db';
let contextLoaded=false;
function loadExactProductionContextModule(){
 const modulePath=path.join(LIVE_SOURCE_ROOT,'transaction-timeout-context.ts');
 const root=fs.realpathSync(LIVE_SOURCE_ROOT);
 const contextPath=fs.realpathSync(modulePath);
 if(!contextPath.startsWith(root+path.sep)||fs.lstatSync(modulePath).isSymbolicLink()){
   throw Error('STAGE10_CONTEXT_PATH_GUARD_FAILED');
 }
 const raw=fs.readFileSync(contextPath);
 if(raw.length>25000)throw Error('STAGE10_CONTEXT_MODULE_TOO_LARGE');
 const original=raw.toString('utf8');
 if(!/\b(?:export|module\.exports)\b/.test(original))
   throw Error('STAGE10_CONTEXT_NO_EXPORTS');
 console.log('STAGE10_CONTEXT_SOURCE_SHA12='+crypto.createHash('sha256').update(raw).digest('hex').slice(0,12));
 const compiled=ts.transpileModule(original,{compilerOptions:{
   target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,strict:true
 },fileName:'transaction-timeout-context.ts',reportDiagnostics:true});
 if((compiled.diagnostics||[]).some(x=>x.category===ts.DiagnosticCategory.Error))
   throw Error('STAGE10_CONTEXT_TYPESCRIPT_DIAGNOSTICS');
 // Sandboxed source, not a guessed no-op stub. The ONLY enabled import is
 // Node's in-memory AsyncLocalStorage. No process, fetch, fs, or secrets.
 const safeRequire=name=>{
   if(name==='node:async_hooks'||name==='async_hooks'){
     return {AsyncLocalStorage:require('node:async_hooks').AsyncLocalStorage};
   }
   throw Error('STAGE10_CONTEXT_UNEXPECTED_IMPORT_'+name);
 };
 const sandbox=vm.createContext({});
 const factory=vm.runInContext('(function(require,module,exports){\n'+
    compiled.outputText+'\n})',sandbox,{timeout:1000,filename:'stage10-context-isolated.cjs'});
 const contextModule={exports:{}};
 factory(safeRequire,contextModule,contextModule.exports);
 const exportsKeys=Object.keys(contextModule.exports);
 if(!exportsKeys.length)throw Error('STAGE10_CONTEXT_EMPTY_EXPORTS');
 console.log('STAGE10_CONTEXT_REAL_IMPLEMENTATION_IN_MEMORY=true');
 console.log('STAGE10_CONTEXT_EXPORT_COUNT='+exportsKeys.length);
 contextLoaded=true;
 return contextModule.exports;
}
const stubRequire=id=>{
 if(id==='pg')return {Pool:FakePool};
 if(id==='./rows')return {param:x=>x};
 if(id==='./transaction-timeout-context')return loadExactProductionContextModule();
 throw Error('UNEXPECTED_IMPORT_'+id);
};
try {
 new Function('require','module','exports',output.outputText)(stubRequire,compiledModule,compiledModule.exports);
} catch(e) {
 console.log('STAGE10_ADAPTER_LOAD=FAIL CODE='+String(e?.message||e?.name||'UNKNOWN').replace(/[^A-Za-z0-9_./-]/g,'').slice(0,100));
 process.exit(2);
}
const {PostgresDb}=compiledModule.exports;
const sql=()=>calls.map(x=>x.sql);
function reset(){calls.length=0;release.length=0;failing=false}
function check(cond,label){assert.ok(cond,label);console.log('STAGE10_CASE_'+label+'=PASS')}
(async()=>{
 const db=new PostgresDb({statementTimeoutMs:15000});
 await db.transaction(async tx=>{
  await tx.query('SELECT A',[1]);
  await tx.queryOne('SELECT B',[2]);
  await tx.rpc('synthetic_fixture',{p_amount:1000});
 });
 check(sql().filter(x=>x==='set local statement_timeout = 15000').length===1,
  'SAME_TIMEOUT_DEDUPED');
 check(sql()[0]==='begin read write'&&sql().at(-1)==='commit','TRANSACTION_COMMIT');
 check(calls.find(x=>x.sql==='SELECT A').values[0]===1,'SQL_BINDINGS_UNCHANGED');
 reset();
 await db.transaction(async tx=>{
  await tx.query('SELECT A');
  await tx.query('SELECT B',[],{timeoutMs:2500});
  await tx.query('SELECT C',[],{timeoutMs:2500});
  await tx.query('SELECT D');
 });
 check(sql().filter(x=>x.startsWith('set local statement_timeout')).join('|')===
  'set local statement_timeout = 15000|set local statement_timeout = 2500|set local statement_timeout = 15000',
  'OVERRIDES_AND_RESET');
 reset();
 await db.transaction(async tx=>{
  await tx.query('SELECT A');
  await tx.query('SET LOCAL statement_timeout = 7000');
  await tx.query('SELECT B');
 });
 check(sql().filter(x=>x==='set local statement_timeout = 15000').length===2,
  'EXPLICIT_SQL_SETTING_INVALIDATES_CACHE');
 reset();
 failing=true;
 let failed=false;
 try{await db.transaction(tx=>tx.query('SELECT FAIL'))}catch{failed=true}
 check(failed&&sql().at(-1)==='rollback'&&!sql().includes('commit'),
  'ROLLBACK_ON_SQL_FAILURE');
 reset();
 await db.transaction(tx=>tx.query('SELECT A'));
 await db.transaction(tx=>tx.query('SELECT B'));
 check(sql().filter(x=>x==='set local statement_timeout = 15000').length===2,
  'STATE_DOES_NOT_LEAK_ACROSS_TRANSACTIONS');
 reset();
 await db.query('SELECT A');
 check(!sql().some(x=>x.includes('set local')),'NONTRANSACTION_QUERY_UNMODIFIED');
 console.log('STAGE10_CONTEXT_SOURCE_LOADED='+String(contextLoaded));
 console.log('STAGE10_MOCK_NO_REAL_DB=true');
 console.log('STAGE10_MOCK_NO_REAL_MONEY=true');
 console.log('STAGE10_CANDIDATE_MOCK_REGRESSION=PASS');
})().catch(e=>{
 console.log('STAGE10_CANDIDATE_MOCK_REGRESSION=FAIL CODE='+String(e.code||e.name||'ERROR'));
 process.exitCode=1;
});
