#!/usr/bin/env node
'use strict';
/**
 * BetVima Stage18A: offline integrity + contents manifest for owner's existing
 * Stage17 NOVA schema-only archive, with a fixed SHA-256 and 97 table guard.
 *
 * Safe by construction:
 * - NO Supabase client, DB URI, DATABASE_URL, PostgreSQL TCP or SQL.
 * - NO pg_restore database target; pg_restore is only invoked with --list
 *   and --file=/dev/null to validate archive decompression.
 * - NO schema source, customer records, passwords or archive bytes printed.
 * - Does not create/delete/update files or restart casino port 3098.
 */
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const cp=require('node:child_process');
const ROOT='/root/betvima-stage5';
const ARCHIVE='/root/betvima-stage5/stage17-schema-only.l6OC0V/private-nova-schema-only.dump';
const EXPECTED_SHA256='1d297d5dec78418afc4ca019614af8e344f725a3a95f0a47a8dcadcade0e4a61';
const PG_RESTORE='/usr/lib/postgresql/17/bin/pg_restore';
function msg(k,v){console.log('STAGE18_'+k+'='+v);}
function abort(code){msg('ABORT',code);process.exitCode=2;throw Error('CONTROLLED_ABORT');}
function metadata(pathname,expectedMode){
 const st=fs.lstatSync(pathname);
 if(st.isSymbolicLink())abort('SYMLINK_NOT_PERMITTED');
 if(st.uid!==0)abort('ROOT_OWNERSHIP_REQUIRED');
 if((st.mode & 0o777)!==expectedMode)abort('UNEXPECTED_FILE_PERMISSIONS');
 return st;
}
async function sha256(file){
 return await new Promise((resolve,reject)=>{
  const digest=crypto.createHash('sha256');
  const input=fs.createReadStream(file,{highWaterMark:65536});
  input.once('error',reject);
  input.on('data',d=>digest.update(d));
  input.once('end',()=>resolve(digest.digest('hex')));
 });
}
function executeRestore(args,timeout){
 const r=cp.spawnSync(PG_RESTORE,args,{
  encoding:'utf8',timeout,maxBuffer:8*1024*1024,
  env:{PATH:'/usr/lib/postgresql/17/bin:/usr/bin:/bin',HOME:'/root',LANG:'C',LC_ALL:'C'}
 });
 if(r.error?.code==='ETIMEDOUT')abort('ARCHIVE_VALIDATION_TIMEOUT');
 if(r.status!==0||r.error)abort('ARCHIVE_UNREADABLE_OR_CORRUPT');
 return r;
}
(async()=>{
 msg('MODE','OFFLINE_SCHEMA_ARCHIVE_VALIDATION');
 if(process.getuid()!==0)abort('ROOT_REQUIRED');
 if(!fs.existsSync(ROOT)||fs.lstatSync(ROOT).isSymbolicLink())abort('ROOT_DIRECTORY_UNEXPECTED');
 const parent=path.dirname(ARCHIVE);
 if(!parent.startsWith(ROOT+'/stage17-schema-only.'))abort('ARCHIVE_LOCATION_UNEXPECTED');
 const ps=metadata(parent,0o700);
 if(!ps.isDirectory())abort('ARCHIVE_PARENT_NOT_DIRECTORY');
 const f=metadata(ARCHIVE,0o600);
 if(!f.isFile()||f.size<1000||f.size>80000000)abort('ARCHIVE_FILE_SIZE_INVALID');
 const real=fs.realpathSync(ARCHIVE);
 if(real!==ARCHIVE)abort('ARCHIVE_PATH_CHANGED');
 const actual=await sha256(ARCHIVE);
 if(actual!==EXPECTED_SHA256)abort('ARCHIVE_SHA256_MISMATCH');
 msg('SHA256','PASS');
 const v=cp.spawnSync(PG_RESTORE,['--version'],{encoding:'utf8',timeout:4000,
  env:{PATH:'/usr/bin:/bin',HOME:'/root',LANG:'C',LC_ALL:'C'}});
 if(v.status!==0||!/\(PostgreSQL\)\s*17\./.test(v.stdout||''))abort('POSTGRES17_RESTORE_CLIENT_REQUIRED');
 const {stdout}=executeRestore(['--list',ARCHIVE],20000);
 const lines=stdout.split('\n').filter(line=>/^\s*\d+;\s/.test(line));
 if(lines.length<97||lines.length>10000)abort('ARCHIVE_TOC_SIZE_UNEXPECTED');
 const banned=lines.filter(line=>/\b(?:TABLE DATA|MATERIALIZED VIEW DATA|SEQUENCE SET|BLOBS|BLOB COMMENTS)\b/i.test(line));
 if(banned.length)abort('DATA_BEARING_TOC_ENTRIES_PRESENT');
 // Pg_restore TOC syntax: 1234; 1259 OID TABLE nova table_name owner
 const entries=lines.map(x=>x.replace(/^\s*\d+;\s+\d+\s+\d+\s+/,''));
 const count=(type)=>entries.filter(e=>e.startsWith(type+' nova ')).length;
 const tbl=count('TABLE'),trigger=count('TRIGGER'),policy=count('POLICY'),fn=count('FUNCTION'),
       view=count('VIEW'),index=count('INDEX'),seq=count('SEQUENCE');
 if(tbl!==97)abort('TABLE_COUNT_MISMATCH');
 // These counts are root production catalog metadata, safe to disclose.
 // Keep policy and trigger counts as strict guards to detect incomplete backups.
 if(trigger!==45)abort('TRIGGER_COUNT_MISMATCH');
 if(policy!==87)abort('RLS_POLICY_COUNT_MISMATCH');
 msg('ARCHIVE_CUSTOM_TABLES',tbl);
 msg('ARCHIVE_TRIGGERS',trigger);
 msg('ARCHIVE_RLS_POLICIES',policy);
 msg('ARCHIVE_FUNCTIONS',fn);
 msg('ARCHIVE_INDEXES_EXPLICIT',index);
 msg('ARCHIVE_SEQUENCES',seq);
 msg('ARCHIVE_VIEWS',view);
 msg('ARCHIVE_DATA_RECORDS',0);
 // Decompress and read whole archive into /dev/null, never output SQL or use DB.
 executeRestore(['--schema-only','--file=/dev/null',ARCHIVE],45000);
 msg('ARCHIVE_DECOMPRESSION','PASS');
 msg('POSTGRESQL_NETWORK_CONNECTIONS',0);
 msg('PRODUCTION_DB_SQL_WRITES',0);
 msg('LIVE_3098_CHANGED',false);
 msg('STAGE18A_ARCHIVE_MANIFEST','PASS');
})().catch(e=>{
 if(e.message!=='CONTROLLED_ABORT')msg('FAIL_SAFE',String(e.code||e.name||'ERROR').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,40));
 process.exitCode=2;
});
