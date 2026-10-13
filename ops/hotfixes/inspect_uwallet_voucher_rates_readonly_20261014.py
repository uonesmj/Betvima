#!/usr/bin/env python3
"""Read-only uWallet rate inspection using the same authorization headers as BetVima.
GET /v1/coin only. No voucher creation, redemption, wallet write or key printing.
"""
import json,os,pathlib,re,subprocess,sys

PM2HOME="/home/novaadmin/.pm2"
NAME="betvima-notification-worker"
JS=r"""
const base=(process.env.UWALLET_BASE_URL||'https://api.uwallet.biz').replace(/\/$/,'');
const token=process.env.UWALLET_TOKEN;
const usd=(process.env.UWALLET_UVOUCHER_COIN||'').toLowerCase();
const hot=(process.env.UWALLET_HOTVOUCHER_COIN||'').toLowerCase();
if(!token || !usd || !hot){console.log('PROVIDER_CONFIG_INCOMPLETE');process.exit(0);}
let u;
try{u=new URL(base+'/v1/coin')}catch{console.log('PROVIDER_URL_INVALID');process.exit(0)}
if(u.protocol!=='https:' || u.username || u.password){console.log('PROVIDER_URL_UNSAFE');process.exit(0)}
const controller=new AbortController();
setTimeout(()=>controller.abort(),12000).unref();
(async()=>{
 try{
  const r=await fetch(u.href,{method:'GET',headers:{Authorization:token,'Content-Type':'application/json'},cache:'no-store',signal:controller.signal});
  console.log('UWALLET_READONLY_STATUS',r.status);
  if(!r.ok) return;
  const result=await r.json();
  const rows=Array.isArray(result)?result:Array.isArray(result?.data)?result.data:[];
  const findCoin=(name)=>rows.find(c=>String(c?.symbol??c?.coin??'').toLowerCase()===name);
  const one=findCoin(usd),two=findCoin(hot);
  console.log('UWALLET_USD_COIN_FOUND',!!one);
  console.log('UWALLET_HOT_COIN_FOUND',!!two);
  const findSwap=(coin,target)=>Array.isArray(coin?.swap)?coin.swap.find(x=>String(x?.coin??'').toLowerCase()===target):undefined;
  const outbound=findSwap(one,hot),inbound=findSwap(two,usd);
  const valid=(v)=>typeof v==='number'||typeof v==='string'?/^\d+(?:\.\d{1,10})?$/.test(String(v))&&Number(v)>0:false;
  console.log('USD_TO_HOT_SWAP_AVAILABLE',valid(outbound?.percent));
  console.log('HOT_TO_USD_SWAP_AVAILABLE',valid(inbound?.percent));
  // The existing BetVima service interprets percent / 100 as HotVoucher units per USD.
  if(valid(outbound?.percent)){
   const units=Number(outbound.percent)/100;
   console.log('CURRENT_HOT_UNITS_PER_USD',units.toFixed(6));
   console.log('INFERRED_TOMAN_PER_USD_IF_HOT_IS_IRR',(units/10).toFixed(2));
  }
  if(valid(inbound?.percent)){
   console.log('CURRENT_REVERSE_PERCENT',String(inbound.percent));
  }
  const fields=(x)=>x&&typeof x==='object'?Object.keys(x).filter(k=>/^(buy|sell|bid|ask|buyRate|sellRate|buyPrice|sellPrice|rate|price|updatedAt|timestamp)$/i.test(k)):[];
  console.log('USD_COIN_PRICING_FIELD_NAMES',fields(one).sort().join(',')||'none');
  console.log('HOT_COIN_PRICING_FIELD_NAMES',fields(two).sort().join(',')||'none');
  console.log('USD_TO_HOT_PRICING_FIELD_NAMES',fields(outbound).sort().join(',')||'none');
  console.log('HOT_TO_USD_PRICING_FIELD_NAMES',fields(inbound).sort().join(',')||'none');
  console.log('COIN_LIST_COUNT',rows.length);
 }catch(e){
  const name=String(e?.name||'');
  console.log('UWALLET_READONLY_ERROR',name==='AbortError'?'TIMEOUT':name==='TypeError'?'NETWORK_OR_TLS':'OTHER');
 }
})()
"""

def main():
    if os.geteuid()!=0:
        print("ROOT_REQUIRED");return
    p=subprocess.run(["/usr/sbin/runuser","-u","novaadmin","--","/usr/bin/env","PM2_HOME="+PM2HOME,"/usr/bin/pm2","jlist"],text=True,capture_output=True,timeout=35)
    if p.returncode:
        print("PM2_QUERY_FAILED");return
    rows=json.loads(p.stdout)
    matches=[a for a in rows if a.get("name")==NAME and a.get("pm2_env",{}).get("status")=="online"]
    if len(matches)!=1:
        print("EMAIL_WORKER_NOT_UNIQUELY_ONLINE");return
    a=matches[0]
    pid=a.get("pid")
    root=a.get("pm2_env",{}).get("pm_cwd")
    if not isinstance(pid,int) or not isinstance(root,str) or not root.startswith("/opt/nova-releases/"):
        print("PROCESS_CONTEXT_NOT_VALID");return
    raw=(pathlib.Path("/proc")/str(pid)/"environ").read_bytes()
    env={}
    for item in raw.split(b"\x00"):
        if b"=" not in item:continue
        k,v=item.split(b"=",1)
        k=k.decode("ascii","ignore")
        if re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*",k):
            env[k]=v.decode("utf-8","surrogateescape")
    env["HOME"]="/home/novaadmin"
    env["PATH"]="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
    p=subprocess.run(["/usr/sbin/runuser","-u","novaadmin","--","/usr/bin/node","-e",JS],text=True,capture_output=True,env=env,cwd=root,timeout=25)
    for line in p.stdout.splitlines():
        if re.match(r"^[A-Z_]+ (?:[A-Za-z0-9.,_-]+|\d+(?:\.\d+)?)$",line):
            print(line[:200])
    if p.returncode:
        print("NODE_READONLY_PROBE_EXIT_NONZERO")
    print("UWALLET_RATE_DIAGNOSTIC_COMPLETE")

if __name__=="__main__":
    try:main()
    except Exception as e:print("READONLY_DIAGNOSTIC_FAILED",type(e).__name__)
