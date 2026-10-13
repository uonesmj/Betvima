#!/usr/bin/env python3
"""Read-only Supabase TLS verifier: never prints connection strings or secrets.
Checks existing notification worker and two isolated PostgreSQL SELECT 1 probes.
Never writes the database, starts/restarts a process, or issues vouchers.
"""
import hashlib, json, os, pathlib, re, subprocess, sys

NAME="betvima-notification-worker"
PM2_HOME="/home/novaadmin/.pm2"
CERT=pathlib.Path("/home/novaadmin/.config/betvima/supabase-root-2021.crt")
CERT_SHA256="700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7"

JS=r"""
const fs=require('fs');
const {URL}=require('url');
const Pg=require('pg');
const secret=process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
if(!secret){console.log('STATUS NO_DB_URL');process.exit(1);}
let url;
try{url=new URL(secret)}catch(e){console.log('STATUS BAD_DB_URL');process.exit(1)}
const sslmode=url.searchParams.get('sslmode')||'unset';
console.log('SSL_MODE',(['disable','allow','prefer','require','verify-ca','verify-full'].includes(sslmode)?sslmode:'other'));
console.log('URL_HAS_SSLROOTCERT',url.searchParams.has('sslrootcert'));
console.log('URL_HAS_SSL_CERT_KEY',url.searchParams.has('sslcert')||url.searchParams.has('sslkey'));
console.log('URL_IS_POSTGRES',url.protocol==='postgres:'||url.protocol==='postgresql:');
function safeError(err){
 const code=String(err?.code||'');
 const known={
  '28P01':'PG_AUTHENTICATION','28000':'PG_AUTHORIZATION','3D000':'PG_DATABASE_MISSING',
  '53300':'PG_TOO_MANY_CONNECTIONS','ECONNREFUSED':'CONNECT_REFUSED',
  'ETIMEDOUT':'CONNECT_TIMEOUT','ENOTFOUND':'DNS_FAILURE','EAI_AGAIN':'DNS_RETRY',
  'ECONNRESET':'CONNECT_RESET','EHOSTUNREACH':'HOST_UNREACHABLE',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE':'TLS_BAD_CHAIN',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY':'TLS_BAD_ISSUER',
  'SELF_SIGNED_CERT_IN_CHAIN':'TLS_BAD_CHAIN',
  'DEPTH_ZERO_SELF_SIGNED_CERT':'TLS_SELF_SIGNED',
  'ERR_TLS_CERT_ALTNAME_INVALID':'TLS_HOSTNAME_MISMATCH',
  'ERR_SSL_SSLV3_ALERT_HANDSHAKE_FAILURE':'TLS_HANDSHAKE',
  'CERT_HAS_EXPIRED':'TLS_EXPIRED'
 };
 if(known[code])return known[code];
 const msg=String(err?.message||'').toLowerCase();
 if(msg.includes('tls_not_verified'))return 'TLS_NOT_VERIFIED';
 if(msg.includes('db_query_failed'))return 'DB_QUERY_FAILED';
 if(msg.includes('ssl'))return 'OTHER_TLS_ERROR';
 if(msg.includes('certificate'))return 'OTHER_CERTIFICATE_ERROR';
 if(msg.includes('timeout'))return 'OTHER_TIMEOUT';
 if(msg.includes('authentication'))return 'OTHER_AUTH';
 if(msg.includes('connect'))return 'OTHER_CONNECTION_ERROR';
 return 'OTHER_UNCLASSIFIED_ERROR';
}
async function test(label,config){
 const client=new Pg.Client({...config,connectionTimeoutMillis:12500});
 let phase='connect';
 try{
  await client.connect();
  const socket=client.connection?.stream;
  const encrypted=socket?.encrypted===true;
  const authorized=socket?.authorized===true;
  console.log(label+'_TLS_ENCRYPTED',encrypted);
  console.log(label+'_TLS_AUTHORIZED',authorized);
  if(!encrypted||!authorized)throw Error('TLS_NOT_VERIFIED');
  phase='query';
  const r=await client.query('select 1 as ok');
  if(r.rows?.[0]?.ok!==1)throw Error('DB_QUERY_FAILED');
  console.log(label+'_RESULT','VERIFIED_TLS_AND_SELECT_OK');
 }catch(e){
  console.log(label+'_ERROR_PHASE',phase);
  console.log(label+'_RESULT',safeError(e));
 }finally{
  try{await client.end()}catch(e){}
 }
}
(async()=>{
 const cert=process.env.BETVIMA_CA_PATH;
 const sanitized=new URL(url);
 for(const key of ['sslmode','sslrootcert','sslcert','sslkey','sslpassword','sslcrl','ssl'])
   sanitized.searchParams.delete(key);
 await test('STRICT_CA',{connectionString:sanitized.toString(),
   ssl:{ca:fs.readFileSync(cert,'utf8'),rejectUnauthorized:true}});
 await test('URL_DEFAULT',{connectionString:secret});
})();
"""

def main():
    if os.geteuid()!=0:
        print("SAFETY_STOP_ROOT_REQUIRED");return
    if not CERT.is_file() or CERT.is_symlink():
        print("CA_MISSING_OR_UNSAFE");return
    if hashlib.sha256(CERT.read_bytes()).hexdigest()!=CERT_SHA256:
        print("CA_FINGERPRINT_MISMATCH");return
    print("CA_PIN_VERIFIED")
    listproc=subprocess.run(["/usr/sbin/runuser","-u","novaadmin","--",
       "/usr/bin/env","PM2_HOME="+PM2_HOME,"/usr/bin/pm2","jlist"],
       capture_output=True,text=True,timeout=35)
    if listproc.returncode:
        print("PM2_LIST_FAILED");return
    apps=json.loads(listproc.stdout)
    targets=[a for a in apps if a.get("name")==NAME and
             a.get("pm2_env",{}).get("status")=="online"]
    if len(targets)!=1 or not isinstance(targets[0].get("pid"),int):
        print("NOTIFICATION_PROCESS_UNEXPECTED");return
    app=targets[0]
    cwd=app["pm2_env"].get("pm_cwd")
    if not isinstance(cwd,str) or not cwd.startswith("/opt/nova-releases/"):
        print("UNEXPECTED_CWD");return
    pid=app["pid"]
    raw=(pathlib.Path("/proc")/str(pid)/"environ").read_bytes()
    env={}
    for record in raw.split(b"\x00"):
        if b"=" not in record:continue
        k,v=record.split(b"=",1)
        key=k.decode("ascii","ignore")
        if re.fullmatch("[A-Za-z_][A-Za-z0-9_]*",key):
            env[key]=v.decode("utf-8","surrogateescape")
    env["BETVIMA_CA_PATH"]=str(CERT)
    env["NODE_EXTRA_CA_CERTS"]=str(CERT)
    env["HOME"]="/home/novaadmin"
    env["PATH"]="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
    env.pop("NODE_TLS_REJECT_UNAUTHORIZED",None)
    env.pop("NODE_OPTIONS",None)
    env.pop("PGSSLMODE",None)
    p=subprocess.run(["/usr/sbin/runuser","-u","novaadmin","--",
      "/usr/bin/node","-e",JS],cwd=cwd,env=env,
      capture_output=True,text=True,timeout=45)
    for line in p.stdout.splitlines():
        if re.fullmatch(r"[A-Z_]+ (?:[A-Z_]+|true|false|unset|other|disable|allow|prefer|require|verify-ca|verify-full)",line):
            print(line,flush=True)
    if p.returncode:
        categories=[
          ('MODULE_NOT_FOUND','NODE_MODULE_MISSING'),
          ('ERR_MODULE_NOT_FOUND','NODE_MODULE_MISSING'),
          ('SyntaxError','NODE_SCRIPT_SYNTAX'),
          ('TypeError','NODE_SCRIPT_TYPE_ERROR'),
        ]
        label=next((c for pattern,c in categories if pattern in p.stderr),
                   'NONZERO_NODE_RUNTIME')
        print('RUNTIME_DIAGNOSTIC',label)
    print("READONLY_TLS_DIAGNOSTIC_COMPLETE")

if __name__=="__main__":
    try: main()
    except Exception as e:print("DIAGNOSTIC_FAILED",type(e).__name__)
