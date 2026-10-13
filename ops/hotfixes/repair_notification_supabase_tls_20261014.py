#!/usr/bin/env python3
"""One-service, verified-TLS recovery for BetVima notification worker.

Public Supabase 2021 Root CA only, SHA-256 pinned from official certificate.
No financial or voucher mutation, no disabling TLS, no secrets in output.
Changes NODE_EXTRA_CA_CERTS for notification PM2 process only after
a verified-TLS read-only PostgreSQL query as novaadmin.
"""
import hashlib
import os
import pathlib
import re
import subprocess
import sys
import time
import json

NAME="betvima-notification-worker"
PM2HOME="/home/novaadmin/.pm2"
CERT_PATH=pathlib.Path("/home/novaadmin/.config/betvima/supabase-root-2021.crt")
CERT_SHA256="700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7"
CERT_PEM="-----BEGIN CERTIFICATE-----\nMIIDxDCCAqygAwIBAgIUbLxMod62P2ktCiAkxnKJwtE9VPYwDQYJKoZIhvcNAQEL\nBQAwazELMAkGA1UEBhMCVVMxEDAOBgNVBAgMB0RlbHdhcmUxEzARBgNVBAcMCk5l\ndyBDYXN0bGUxFTATBgNVBAoMDFN1cGFiYXNlIEluYzEeMBwGA1UEAwwVU3VwYWJh\nc2UgUm9vdCAyMDIxIENBMB4XDTIxMDQyODEwNTY1M1oXDTMxMDQyNjEwNTY1M1ow\nazELMAkGA1UEBhMCVVMxEDAOBgNVBAgMB0RlbHdhcmUxEzARBgNVBAcMCk5ldyBD\nYXN0bGUxFTATBgNVBAoMDFN1cGFiYXNlIEluYzEeMBwGA1UEAwwVU3VwYWJhc2Ug\nUm9vdCAyMDIxIENBMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAqQXW\nQyHOB+qR2GJobCq/CBmQ40G0oDmCC3mzVnn8sv4XNeWtE5XcEL0uVih7Jo4Dkx1Q\nDmGHBH1zDfgs2qXiLb6xpw/CKQPypZW1JssOTMIfQppNQ87K75Ya0p25Y3ePS2t2\nGtvHxNjUV6kjOZjEn2yWEcBdpOVCUYBVFBNMB4YBHkNRDa/+S4uywAoaTWnCJLUi\ncvTlHmMw6xSQQn1UfRQHk50DMCEJ7Cy1RxrZJrkXXRP3LqQL2ijJ6F4yMfh+Gyb4\nO4XajoVj/+R4GwywKYrrS8PrSNtwxr5StlQO8zIQUSMiq26wM8mgELFlS/32Uclt\nNaQ1xBRizkzpZct9DwIDAQABo2AwXjALBgNVHQ8EBAMCAQYwHQYDVR0OBBYEFKjX\nuXY32CztkhImng4yJNUtaUYsMB8GA1UdIwQYMBaAFKjXuXY32CztkhImng4yJNUt\naUYsMA8GA1UdEwEB/wQFMAMBAf8wDQYJKoZIhvcNAQELBQADggEBAB8spzNn+4VU\ntVxbdMaX+39Z50sc7uATmus16jmmHjhIHz+l/9GlJ5KqAMOx26mPZgfzG7oneL2b\nVW+WgYUkTT3XEPFWnTp2RJwQao8/tYPXWEJDc0WVQHrpmnWOFKU/d3MqBgBm5y+6\njB81TU/RG2rVerPDWP+1MMcNNy0491CTL5XQZ7JfDJJ9CCmXSdtTl4uUQnSuv/Qx\nCea13BX2ZgJc7Au30vihLhub52De4P/4gonKsNHYdbWjg7OWKwNv/zitGDVDB9Y2\nCMTyZKG3XEu5Ghl1LEnI3QmEKsqaCLv12BnVjbkSeZsMnevJPs1Ye6TjjJwdik5P\no/bKiIz+Fq8=\n-----END CERTIFICATE-----\n"

def stop(reason):
    raise RuntimeError("SAFETY_STOP:"+reason)

def run(cmd,env=None,cwd=None,timeout=40):
    return subprocess.run(cmd,env=env,cwd=cwd,capture_output=True,text=True,timeout=timeout)

def jlist():
    p=run(["/usr/sbin/runuser","-u","novaadmin","--",
           "/usr/bin/env","PM2_HOME="+PM2HOME,
           "/usr/bin/pm2","jlist"])
    if p.returncode:stop("PM2_LIST_FAILED")
    try:return json.loads(p.stdout)
    except Exception:stop("PM2_JSON_INVALID")

def active():
    rows=[a for a in jlist() if a.get("name")==NAME]
    if len(rows)!=1:stop("NOTIFICATION_PROCESS_COUNT_"+str(len(rows)))
    app=rows[0]
    if app.get("pm2_env",{}).get("status")!="online" or not app.get("pid"):
        stop("NOTIFICATION_NOT_ONLINE")
    return app

def proc_env(pid):
    try:raw=(pathlib.Path("/proc")/str(pid)/"environ").read_bytes()
    except Exception:stop("PROCESS_ENV_READ_FAILED")
    out={}
    for part in raw.split(b"\x00"):
        if b"=" in part:
            k,v=part.split(b"=",1)
            key=k.decode("ascii","ignore")
            if re.fullmatch("[A-Za-z_][A-Za-z0-9_]*",key):
                out[key]=v.decode("utf8","surrogateescape")
    return out

def error_label(stderr):
    checks=[
        (r"self.signed|unable to verify|CERT_|SSL|TLS|UNABLE_TO_VERIFY|certificate", "TLS_CERTIFICATE"),
        (r"ENOTFOUND|EAI_AGAIN|could not translate", "DNS_FAILED"),
        (r"28P01|authentication failed|SASL", "DB_AUTH_FAILED"),
        (r"ECONNREFUSED|connection refused", "DB_CONN_REFUSED"),
        (r"ETIMEDOUT|timed out|timeout", "DB_TIMEOUT"),
        (r"ERR_MODULE_NOT_FOUND|Cannot find module", "NODE_MODULE_MISSING"),
        (r"TLS_NOT_VERIFIED", "TLS_NOT_VERIFIED"),
        (r"NO_DATABASE_URL", "NO_DATABASE_URL"),
        (r"NO_HEARTBEAT", "NO_FRESH_HEARTBEAT"),
    ]
    for pattern,label in checks:
        if re.search(pattern,stderr,re.I):return label
    return "OTHER_CHECK_FAILURE"

PROBE=r"""
const pg=require('pg');
const fs=require('fs');
const raw=process.env.SUPABASE_DB_URL||process.env.DATABASE_URL;
if(!raw){console.error('NO_DATABASE_URL');process.exit(8)}
async function verify(label,config){
 const client=new pg.Client({...config,connectionTimeoutMillis:15000});
 try{
  await client.connect();
  const sock=client.connection?.stream;
  if(sock?.encrypted!==true || sock?.authorized!==true)throw Error('TLS_NOT_VERIFIED');
  const r=await client.query('select 1 as ok');
  if(r.rows?.[0]?.ok!==1)throw Error('DB_PING_FAILED');
  console.log(label);
 }finally{
  try{await client.end()}catch(_){}
 }
}
(async()=>{
 const c=new URL(raw);
 for(const k of ['sslmode','sslrootcert','sslcert','sslkey','sslcrl','sslpassword','ssl']){
  c.searchParams.delete(k);
 }
 const ca=fs.readFileSync(process.env.NODE_EXTRA_CA_CERTS,'utf8');
 await verify('STRICT_CA_VERIFIED', {connectionString:c.toString(),ssl:{ca,rejectUnauthorized:true}});
 await verify('DEFAULT_URL_VERIFIED', {connectionString:raw});
 process.stdout.write('READONLY_VERIFIED_TLS_DB_PASS\\n',()=>process.exit(0));
})().catch(e=>{
 console.error(String(e?.code||e?.message||'DB_PROBE_FAILED').slice(0,120));
 process.exit(1);
});
"""

CHECK_HEARTBEAT=r"""
const pg=require('pg');
const url=process.env.SUPABASE_DB_URL||process.env.DATABASE_URL;
const c=new pg.Client({connectionString:url,connectionTimeoutMillis:13000});
(async()=>{
try{
 await c.connect();
 if(c.connection.stream?.authorized!==true) throw Error('TLS_NOT_VERIFIED');
 const q=await c.query(
 'select exists(select 1 from nova.worker_heartbeats where worker=$1 and worker_id=$2 and last_seen_at>now()-interval \'30 seconds\') ok',
 ['notification',process.env.WORKER_ID||'notification-betvima']);
 const ok=q.rows[0]?.ok===true;
 await c.end();
 process.stdout.write((ok?'NOTIFICATION_HEARTBEAT_VERIFIED':'NOTIFICATION_HEARTBEAT_MISSING')+'\\n',()=>process.exit(ok?0:2));
}catch(e){
 console.error(String(e?.code||e?.message||'HEARTBEAT_ERROR').slice(0,140));
 try{await c.end()}catch(_){}
 process.exitCode=1;
}
})();
"""

def node_as_worker(program,env,cwd):
    if not (pathlib.Path(cwd)/"node_modules"/"pg").exists():
        stop("NODE_POSTGRES_PACKAGE_NOT_FOUND")
    return run(["/usr/sbin/runuser","-u","novaadmin","--",
                "/usr/bin/env","NODE_EXTRA_CA_CERTS="+env["NODE_EXTRA_CA_CERTS"],
                "/usr/bin/node","-e",program],env=env,cwd=cwd,timeout=33)

def restart_ca(path):
    newenv={"PATH":"/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
            "HOME":"/home/novaadmin","PM2_HOME":PM2HOME,
            "NODE_EXTRA_CA_CERTS":str(path)}
    p=run(["/usr/sbin/runuser","-u","novaadmin","--",
           "/usr/bin/env","PM2_HOME="+PM2HOME,
           "NODE_EXTRA_CA_CERTS="+str(path),
           "/usr/bin/pm2","restart",NAME,"--update-env"],env=newenv,timeout=90)
    if p.returncode:stop("NOTIFICATION_RESTART_FAILED")

def main():
    if os.geteuid():stop("ROOT_REQUIRED")
    existing=active()
    oldpid=existing["pid"]
    cwd=existing.get("pm2_env",{}).get("pm_cwd")
    if not isinstance(cwd,str) or not cwd.startswith("/opt/nova-releases/") or not pathlib.Path(cwd).is_dir():
        stop("UNEXPECTED_RELEASE_PATH")
    env=proc_env(oldpid)
    if env.get("NODE_TLS_REJECT_UNAUTHORIZED")=="0" or env.get("PGSSLMODE","").lower() in ("disable","allow"):
        stop("TLS_VERIFICATION_ALREADY_DISABLED")
    if not (env.get("SUPABASE_DB_URL") or env.get("DATABASE_URL")):
        stop("DATABASE_URL_MISSING")
    if env.get("WORKER_ID") and env["WORKER_ID"]!="notification-betvima":
        stop("UNEXPECTED_WORKER_ID")
    print("WORKER_AND_DB_CONFIG_VERIFIED",flush=True)
    certificate=CERT_PEM.encode("ascii")
    if hashlib.sha256(certificate).hexdigest()!=CERT_SHA256:
        stop("PINNED_SUPABASE_CA_HASH_FAILED")
    CERT_PATH.parent.mkdir(mode=0o755,parents=True,exist_ok=True)
    if CERT_PATH.is_symlink():stop("CA_PATH_SYMLINK_REJECTED")
    if CERT_PATH.exists():
        if CERT_PATH.read_bytes()!=certificate:stop("CA_FILE_ALREADY_DIFFERENT")
    else:
        fd=os.open(str(CERT_PATH),os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o644)
        with os.fdopen(fd,"wb") as f:f.write(certificate)
    os.chmod(CERT_PATH,0o644)
    userenv=dict(env)
    userenv["NODE_EXTRA_CA_CERTS"]=str(CERT_PATH)
    userenv["HOME"]="/home/novaadmin"
    userenv["PATH"]="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
    userenv.pop("NODE_OPTIONS",None)
    userenv.pop("NODE_TLS_REJECT_UNAUTHORIZED",None)
    userenv.pop("PGSSLMODE",None)
    p=node_as_worker(PROBE,userenv,cwd)
    if p.returncode or "READONLY_VERIFIED_TLS_DB_PASS" not in p.stdout:
        print("TLS_DB_PROBE_RESULT",error_label(p.stderr),flush=True)
        stop("TLS_DATABASE_PROBE_FAILED")
    print("READONLY_VERIFIED_TLS_DB_PASS",flush=True)
    restart_ca(CERT_PATH)
    current=active()
    if current["pid"]==oldpid:stop("NOTIFICATION_PID_UNCHANGED")
    ca_value=current.get("pm2_env",{}).get("NODE_EXTRA_CA_CERTS")
    if ca_value!=str(CERT_PATH):stop("PM2_CA_ENV_NOT_APPLIED")
    restartedpid=current["pid"]
    print("NOTIFICATION_RESTARTED_WITH_VERIFIED_CA",flush=True)
    time.sleep(20)
    current=active()
    if current["pid"]!=restartedpid:
        stop("NOTIFICATION_RESTARTED_AGAIN")
    hb=node_as_worker(CHECK_HEARTBEAT,userenv,cwd)
    if hb.returncode or "NOTIFICATION_HEARTBEAT_VERIFIED" not in hb.stdout:
        print("NOTIFICATION_HEARTBEAT_CHECK",error_label(hb.stderr),flush=True)
        stop("NOTIFICATION_HEARTBEAT_NOT_CONFIRMED")
    print("NOTIFICATION_HEARTBEAT_VERIFIED",flush=True)
    saved=run(["/usr/sbin/runuser","-u","novaadmin","--",
               "/usr/bin/env","PM2_HOME="+PM2HOME,
               "/usr/bin/pm2","save"],timeout=45)
    if saved.returncode:stop("PM2_SAVE_FAILED")
    print("NOTIFICATION_PM2_SAVED",flush=True)
    print("EMAIL_DELIVERY_RESUMED_VERIFY_QUEUED_STATUSES",flush=True)
    print("NO_NEW_VOUCHER_OR_WALLET_MUTATION",flush=True)
if __name__=="__main__":
    try: main()
    except Exception as e:
        msg=str(e)
        print(msg if msg.startswith("SAFETY_STOP:") else "SAFETY_STOP:"+type(e).__name__,flush=True)
        sys.exit(1)
