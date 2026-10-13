#!/usr/bin/env python3
"""Install a separate 5Dollar football-statistics-only PM2 worker.

No edits or restart to the web, odds, live odds, settlement or financial workers.
All downloaded code must match immutable Git blob checksums and compile first.
"""
import fcntl, hashlib, json, os, pathlib, pwd, stat, subprocess, sys, tempfile, time, urllib.request

P = pathlib.Path
REV = 'c1cc6aee2662e23057c4441575ccb382226141a7'
ROOT = P('/opt/nova-releases/24dab3702c58a5baa4b5f18ccc1eee15b2c6fdac')
ENV = P('/var/www/nova/.env.production')
SERVICE = 'betvima-football-stats-worker'
WRAPPER = P('/home/novaadmin/football-stats-start.sh')
FILES = {
  'src/workers/fivedollar-stats.worker.ts':'cb40083cda8a401a8be66046ab84f650f7aa837a',
  'src/workers/entrypoints/football-stats.worker.ts':'8b410d9f176f1de599fdf34000fac0c63f54a8f5',
}
WATCHED = ('betvima-odds-worker','betvima-live-odds-worker','betvima-settlement-worker')
OWNER = pwd.getpwnam('novaadmin')
def stop(s):raise RuntimeError('SAFETY_STOP: '+s)
def blob(b):return hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
def command(*args,timeout=100,cwd=None):
 return subprocess.run(args,capture_output=True,text=True,timeout=timeout,cwd=cwd)
def pm(*args):
 r=command('/usr/sbin/runuser','-u','novaadmin','--','/usr/bin/env',
           'PM2_HOME=/home/novaadmin/.pm2','/usr/bin/pm2',*args,timeout=100)
 if r.returncode:stop('PM2 '+args[0]+' failed (exit '+str(r.returncode)+')')
 return r.stdout
def apps():return json.loads(pm('jlist'))
def service(l,name):
 x=[p for p in l if p.get('name')==name]
 if len(x)!=1 or x[0].get('pm2_env',{}).get('status')!='online':stop('Service not uniquely online: '+name)
 return x[0]
def get(path,expected):
 url='https://raw.githubusercontent.com/uonesmj/Betvima/'+REV+'/'+path
 with urllib.request.urlopen(url,timeout=45) as response:data=response.read(180001)
 if len(data)>180000 or blob(data)!=expected:stop('Code integrity check failed for '+path)
 return data
def put(path,data,mode=0o640):
 path.parent.mkdir(parents=True,exist_ok=True)
 if path.is_symlink():stop('Refusing symlink path: '+str(path))
 fd,tmp=tempfile.mkstemp(prefix='.fivedollar-stats-',dir=path.parent)
 try:
  with os.fdopen(fd,'wb') as output:
   output.write(data);output.flush();os.fsync(output.fileno())
  os.chown(tmp,OWNER.pw_uid,OWNER.pw_gid)
  os.chmod(tmp,mode)
  os.replace(tmp,path)
 finally:
  if os.path.exists(tmp):os.unlink(tmp)
def verify_env():
 if not ENV.is_file():stop('Trusted .env.production missing')
 # No API key or database password is printed, copied to output, or passed as argv.
 code=("set -a; source /var/www/nova/.env.production >/dev/null 2>&1; set +a; "
       "test -n \"\${FIVEDOLLAR_API_KEY:-}\" && "
       "test \"\${FIVEDOLLAR_API_BASE_URL:0:8}\" = 'https://' && "
       "test -n \"\${SUPABASE_DB_URL:-\${DATABASE_URL:-}}\"")
 result=command('/usr/sbin/runuser','-u','novaadmin','--','/bin/bash','-c',code)
 if result.returncode:stop('novaadmin cannot read configured API and DB credentials (values not exposed)')
def main():
 if os.geteuid()!=0:stop('Root is required')
 with open('/run/lock/betvima-football-stats-install.lock','a+b') as lock:
  fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
  before=apps()
  guarded={name:service(before,name) for name in WATCHED}
  for name,process in guarded.items():
   if not process.get('pid'):stop('Missing PM2 PID: '+name)
  if guarded['betvima-odds-worker']['pm2_env'].get('pm_cwd')!=str(ROOT):
   stop('Odds source release differs from inspected version')
  if len([x for x in before if x.get('name')==SERVICE])>0:
   existing=service(before,SERVICE)
   for relative,expected in FILES.items():
    p=ROOT/relative
    if not p.is_file() or blob(p.read_bytes())!=expected:
     stop('Existing stats service code differs from verified revision')
   print('FIVEDOLLAR_STATS_ALREADY_ONLINE pid='+str(existing.get('pid')),flush=True)
   return
  if not (ROOT/'node_modules/typescript/bin/tsc').is_file():
   stop('Local TypeScript compiler missing')
  if not (ROOT/'node_modules/tsx').exists():
   stop('Local tsx runtime missing')
  verify_env()
  files={relative:get(relative,digest) for relative,digest in FILES.items()}
  originals={}
  for relative in FILES:
   path=ROOT/relative
   originals[relative]=path.read_bytes() if path.exists() else None
   if path.is_symlink() or originals[relative] is not None:
    stop('Refusing to overwrite an existing stats entrypoint or worker source')
  if WRAPPER.is_symlink() or WRAPPER.exists():
   stop('Existing stats launcher not recognized; refuse overwrite')
  code=('#!/usr/bin/env bash\n'
        'set -euo pipefail\n'
        'set -a\n'
        'source /var/www/nova/.env.production\n'
        'set +a\n'
        'export NODE_ENV=production APP_ENV=production\n'
        'export WORKER_ID=betvima-new-vps-football-stats\n'
        'cd /opt/nova-releases/24dab3702c58a5baa4b5f18ccc1eee15b2c6fdac\n'
        'exec /usr/bin/node --import tsx src/workers/entrypoints/football-stats.worker.ts\n').encode()
  installed=False
  started=False
  try:
   installed=True
   for relative,contents in files.items():put(ROOT/relative,contents)
   put(WRAPPER,code,0o700)
   # Validate against this exact VPS release, not a different Git checkout.
   tsc=command('/usr/sbin/runuser','-u','novaadmin','--','/usr/bin/node',
     str(ROOT/'node_modules/typescript/bin/tsc'),
     '--noEmit','--incremental','false','--pretty','false',
     cwd=str(ROOT),timeout=240)
   if tsc.returncode:
    print('TYPECHECK_ERROR_LINES','\n'.join((tsc.stdout+tsc.stderr).splitlines()[:12])[:1200],flush=True)
    stop('VPS local typecheck failed; files will be removed')
   print('TYPECHECK_PASS',flush=True)
   right_before=apps()
   for name,earlier in guarded.items():
    if service(right_before,name).get('pid')!=earlier.get('pid'):
     stop('Unrelated service changed during compilation; do not start')
   started=True
   pm('start',str(WRAPPER),'--name',SERVICE,'--interpreter','bash','--cwd',str(ROOT))
   time.sleep(20)
   after=apps()
   worker=service(after,SERVICE)
   for name,earlier in guarded.items():
    if service(after,name).get('pid')!=earlier.get('pid'):
     stop('Unrelated service PID changed unexpectedly')
   if not worker.get('pid'):stop('Stats worker did not obtain a PID')
   pm('save')
   print('FIVEDOLLAR_FOOTBALL_STATS_ONLINE pid='+str(worker.get('pid')),flush=True)
   print('ODDS_LIVE_SETTLEMENT_UNCHANGED',flush=True)
   print('NO_ODDS_OR_FINANCIAL_WRITE_PATHS',flush=True)
  except Exception:
   if started:
    try:pm('delete',SERVICE);print('NEW_STATS_WORKER_REMOVED',flush=True)
    except Exception:print('URGENT: check new stats worker manually',flush=True)
   if installed:
    for relative in FILES:
     try:(ROOT/relative).unlink(missing_ok=True)
     except OSError:pass
    WRAPPER.unlink(missing_ok=True)
    print('STATS_ONLY_SOURCE_ROLLBACK',flush=True)
   raise
if __name__=='__main__':
 try:main()
 except Exception as error:
  print(str(error),flush=True)
  sys.exit(1)
