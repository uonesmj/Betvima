#!/usr/bin/env python3
"""Safely update only bulk odds detail-eligibility query; preserve all VPS-specific edits."""
import fcntl, hashlib, json, os, pathlib, pwd, stat, subprocess, sys, tempfile, time, urllib.request
P=pathlib.Path
ROOT=P('/opt/nova-releases/24dab3702c58a5baa4b5f18ccc1eee15b2c6fdac')
SOURCE=ROOT/'src/workers/odds.worker.ts'
PROVIDER=ROOT/'src/providers/the-odds-api.ts'
HELPER=ROOT/'src/providers/extended-event-markets.ts'
BASE='479a8e28572a26a0c6a00db90924187345411875'
NEW='636c78d8bf97c0e7638fe7441705cad78aa3271d'
BASE_BLOB='bedc7f692e7cab0c4f98b173add442a20529198c'
NEW_BLOB='fb7ee29ab71b1a953f9af046298df9e35d30df71'
PROVIDER_BLOB='4ebc0293d886811894384f9cdd9f13f773db702c'
HELPER_BLOB='143dc9533dbf1bdd445b53a9daa0a20b16025061'
def stop(message): raise RuntimeError('SAFETY_STOP: '+message)
def blob(data): return hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()
def fetch(rev,expected):
 url='https://raw.githubusercontent.com/uonesmj/Betvima/'+rev+'/src/workers/odds.worker.ts'
 with urllib.request.urlopen(url,timeout=45) as reply:data=reply.read(180001)
 if len(data)>180000 or blob(data)!=expected:stop('GitHub source verification failed')
 return data.decode('utf8')
def run(*args,timeout=100,cwd=None):
 return subprocess.run(args,capture_output=True,text=True,timeout=timeout,cwd=cwd)
def pm(*args):
 result=run('/usr/sbin/runuser','-u','novaadmin','--','/usr/bin/env',
            'PM2_HOME=/home/novaadmin/.pm2','/usr/bin/pm2',*args)
 if result.returncode:stop('PM2 '+args[0]+' failed '+str(result.returncode))
 return result.stdout
def apps(): return json.loads(pm('jlist'))
def service(items,name):
 found=[item for item in items if item.get('name')==name]
 if len(found)!=1 or found[0].get('pm2_env',{}).get('status')!='online':
  stop('Unexpected process status: '+name)
 return found[0]
def atomic(path,data,original_stat):
 if path.is_symlink():stop('Refusing symlink target: '+str(path))
 fd,tmp=tempfile.mkstemp(prefix='.odds-event-filter-',dir=path.parent)
 try:
  with os.fdopen(fd,'wb') as out:
   out.write(data);out.flush();os.fsync(out.fileno())
  os.chown(tmp,original_stat.st_uid,original_stat.st_gid)
  os.chmod(tmp,stat.S_IMODE(original_stat.st_mode))
  os.replace(tmp,path)
 finally:
  if os.path.exists(tmp):os.unlink(tmp)
def fragment(code):
 start=('                 where m.provider = $2\n'
        "                   and m.status::text = 'scheduled'\n"
        '                   and m.provider_id is not null\n'
        '                   and m.scheduled_at > now()\n')
 end="                     ($3::boolean and m.scheduled_at <= now() + interval '30 minutes')"
 if code.count(start)!=1:stop('Expected exactly one extended SQL WHERE clause in reviewed source')
 a=code.index(start);b=code.find(end,a)
 if b<0 or b-a>2500:stop('Reviewed extended SQL query structure changed')
 return code[a:b]
def source_pids():
 found=[]
 service_user_uid=pwd.getpwnam('novaadmin').pw_uid
 for node in P('/proc').iterdir():
  if not node.name.isdigit():continue
  try:
   if os.readlink(node/'cwd')!=str(ROOT):continue
   if int((node/'status').read_text().split('Uid:')[1].split()[0])!=service_user_uid:continue
   cmd=(node/'cmdline').read_bytes().replace(b'\x00',b' ')
   if b'src/workers/entrypoints/odds.worker.ts' in cmd:found.append(int(node.name))
  except (OSError,IndexError,ValueError,PermissionError):pass
 return sorted(found)
def main():
 if os.geteuid()!=0:stop('Root is required')
 with open('/run/lock/betvima-bulk-odds-patch.lock','a+b') as lock:
  fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
  state=apps()
  bulk=service(state,'betvima-odds-worker')
  live=service(state,'betvima-live-odds-worker')
  settlement=service(state,'betvima-settlement-worker')
  if bulk['pm2_env'].get('pm_cwd')!=str(ROOT) or settlement['pm2_env'].get('pm_cwd')!=str(ROOT):
   stop('Bulk or settlement release changed')
  if live['pm2_env'].get('pm_cwd')==str(ROOT):stop('Live and bulk releases overlap')
  if bulk['pm2_env'].get('pm_exec_path')!=str(ROOT/'src/workers/entrypoints/odds.worker.ts'):
   stop('Bulk entry point changed')
  found=source_pids()
  print('DETECTED_BULK_PIDS:',found,flush=True)
  if len(found)>1 or (found and found[0]!=bulk.get('pid')):
   stop('Conflicting bulk process; no process stopped')
  if not SOURCE.is_file() or not PROVIDER.is_file() or not HELPER.is_file():
   stop('Expected worker/provider/helper missing')
  if blob(PROVIDER.read_bytes())!=PROVIDER_BLOB or blob(HELPER.read_bytes())!=HELPER_BLOB:
   stop('Advanced market provider version differs from tested deployment')
  old=fetch(BASE,BASE_BLOB)
  new=fetch(NEW,NEW_BLOB)
  oldfrag=fragment(old)
  newfrag=fragment(new)
  if oldfrag==newfrag or "primary_market.key in ('h2h', 'spreads', 'totals')" not in newfrag:
   stop('Reviewed query did not include 404 eligibility fix')
  original=SOURCE.read_bytes()
  local=original.decode('utf8')
  # The currently running server retains a short v4-formatted SQL predicate:
  # `and (($3::boolean ... ) or ($4::boolean ...))`. The reviewed repo
  # has the same predicate split across lines. Both are equivalent; leave the
  # server-only formatting and all other hotfixes untouched.
  common=('                 where m.provider = $2\n'
          "                   and m.status::text = 'scheduled'\n"
          '                   and m.provider_id is not null\n'
          '                   and m.scheduled_at > now()\n')
  short_boolean=("                   and (($3::boolean and m.scheduled_at <= now() + interval '30 minutes') "
                 "or ($4::boolean and m.scheduled_at > now() + interval '30 minutes'))\n")
  if not oldfrag.startswith(common) or not newfrag.startswith(common):
   stop('Reviewed extended query common prefix mismatched')
  extended_addition=newfrag[len(common):]
  if not extended_addition.endswith('                   and (\n'):
   stop('Reviewed extended query suffix changed')
  filter_only=extended_addition[:-len('                   and (\n')]
  if "primary_market.key in ('h2h', 'spreads', 'totals')" not in filter_only:
   stop('Reviewed eligibility check missing')
  server_before=common+short_boolean
  server_after=common+filter_only+short_boolean
  if local.count(server_after)==1 or local.count(newfrag)==1:
   print('ALREADY_DEPLOYED: 404 extended query filter',flush=True)
   return
  if 'ODDS_BULK_LIVE_SKIP' not in local or 'prematchRefreshCadence(' not in local:
   stop('Expected previously tested server safeguards missing')
  if local.count(server_before)==1:
   candidate=local.replace(server_before,server_after,1).encode('utf8')
  elif local.count(oldfrag)==1:
   candidate=local.replace(oldfrag,newfrag,1).encode('utf8')
  else:
   stop('Unexpected locally customized extended query; no changes')
  compiler=ROOT/'node_modules/typescript/bin/tsc'
  check=run('/usr/sbin/runuser','-u','novaadmin','--','/usr/bin/node',str(compiler),'--version',cwd=str(ROOT))
  if check.returncode!=0 or not check.stdout.strip().startswith('Version '):
   stop('Working TypeScript compiler unavailable')
  src_stat=SOURCE.stat()
  backup=P('/home/novaadmin')/('odds-404-filter-backup-'+str(int(time.time())))
  backup.mkdir(mode=0o700)
  (backup/'odds.worker.ts').write_bytes(original)
  print('BACKUP_CREATED',backup,flush=True)
  changed=False;restarted=False
  try:
   changed=True
   atomic(SOURCE,candidate,src_stat)
   result=run('/usr/sbin/runuser','-u','novaadmin','--','/usr/bin/node',str(compiler),
              '--noEmit','--pretty','false','--incremental','false',timeout=240,cwd=str(ROOT))
   if result.returncode:
    print('TYPECHECK_ERRORS:', '\n'.join((result.stdout+result.stderr).splitlines()[:16])[:1800],flush=True)
    stop('TypeScript failed')
   print('TYPECHECK_PASS',flush=True)
   before_restart=apps()
   if service(before_restart,'betvima-odds-worker').get('pid')!=bulk.get('pid'):
    stop('Bulk PID changed during typechecking')
   restarted=True
   pm('restart','betvima-odds-worker')
   time.sleep(15)
   after=apps()
   after_bulk=service(after,'betvima-odds-worker')
   after_live=service(after,'betvima-live-odds-worker')
   after_settle=service(after,'betvima-settlement-worker')
   if after_bulk.get('pid')==bulk.get('pid') or not after_bulk.get('pid'):
    stop('Bulk worker failed to restart')
   if after_live.get('pid')!=live.get('pid') or after_settle.get('pid')!=settlement.get('pid'):
    stop('Live or settlement PID changed')
   print('ODDS_EXTENDED_404_FILTER_DEPLOYED revision='+NEW,flush=True)
   print('ODDS_BULK_ONLINE pid='+str(after_bulk.get('pid')),flush=True)
   print('LIVE_AND_SETTLEMENT_UNCHANGED',flush=True)
  except Exception:
   if changed:
    atomic(SOURCE,original,src_stat)
    print('SOURCE_ROLLBACK_COMPLETE',flush=True)
   if restarted:
    try:pm('restart','betvima-odds-worker');print('PREVIOUS_BULK_WORKER_RESTARTED',flush=True)
    except Exception:print('URGENT: check PM2 odds-worker status',flush=True)
   raise
if __name__=='__main__':
 try:main()
 except Exception as error:
  print(str(error),flush=True)
  sys.exit(1)
