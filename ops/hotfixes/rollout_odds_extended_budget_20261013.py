#!/usr/bin/env python3
"""Guarded hotfix: bounded extended bookmaker calls, truthful odds source time.

Only replace an exact verified The Odds API provider file. No database writes.
No changes to live odds, football stats, settlement, wallet, or HTTP frontend.
"""
import fcntl, hashlib, json, os, pathlib, pwd, stat, subprocess, sys, tempfile, time, urllib.request

P=pathlib.Path
ROOT=P('/opt/nova-releases/24dab3702c58a5baa4b5f18ccc1eee15b2c6fdac')
TARGET=ROOT/'src/providers/the-odds-api.ts'
REV='159c32c7c24fcf0143feaf354fb0a6a6cefa8005'
OLD_BLOB='15d4a993d7c126e364b43af1f300a8d7ebb68579'
NEW_BLOB='59ddbc1ecfef33c014d01a3736e9b61faf4b0b7b'
BULK='betvima-odds-worker'
GUARDS=('betvima-live-odds-worker','betvima-settlement-worker','betvima-football-stats-worker')
OWNER=pwd.getpwnam('novaadmin')
def stop(message):raise RuntimeError('SAFETY_STOP: '+message)
def blob(raw):return hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest()
def cmd(*args,timeout=120,cwd=None):return subprocess.run(args,capture_output=True,text=True,timeout=timeout,cwd=cwd)
def pm(*args):
 r=cmd('/usr/sbin/runuser','-u','novaadmin','--','/usr/bin/env',
     'PM2_HOME=/home/novaadmin/.pm2','/usr/bin/pm2',*args,timeout=120)
 if r.returncode:stop('PM2 command failed '+args[0]+' exit='+str(r.returncode))
 return r.stdout
def ps():return json.loads(pm('jlist'))
def online(all_apps,name):
 found=[p for p in all_apps if p.get('name')==name]
 if len(found)!=1 or found[0].get('pm2_env',{}).get('status')!='online' or not found[0].get('pid'):
  stop('Expected exactly one online PM2 service '+name)
 return found[0]
def atomic(path,data,original_stat):
 fd,tmp=tempfile.mkstemp(prefix='.betvima-extended-budget-',dir=path.parent)
 try:
  with os.fdopen(fd,'wb') as f:f.write(data);f.flush();os.fsync(f.fileno())
  os.chown(tmp,original_stat.st_uid,original_stat.st_gid)
  os.chmod(tmp,stat.S_IMODE(original_stat.st_mode))
  os.replace(tmp,path)
 finally:
  if os.path.exists(tmp):os.unlink(tmp)
def main():
 if os.geteuid()!=0:stop('Run only as root on verified VPS')
 with open('/run/lock/betvima-bulk-odds-patch.lock','a+b') as lock:
  fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
  before=ps()
  bulk=online(before,BULK)
  guards={name:online(before,name) for name in GUARDS}
  if bulk['pm2_env'].get('pm_cwd')!=str(ROOT):
   stop('Odds process release differs from audited installation')
  if not TARGET.is_file() or TARGET.is_symlink():
   stop('Provider file missing or symlink')
  previous=TARGET.read_bytes()
  meta=TARGET.stat()
  if blob(previous)==NEW_BLOB:
   print('ALREADY_DEPLOYED: Extended odds budget provider',flush=True)
   return
  if blob(previous)!=OLD_BLOB:
   stop('Unknown customized provider version; nothing changed')
  url='https://raw.githubusercontent.com/uonesmj/Betvima/'+REV+'/src/providers/the-odds-api.ts'
  with urllib.request.urlopen(url,timeout=45) as r:code=r.read(100001)
  if len(code)>100000 or blob(code)!=NEW_BLOB:
   stop('Reviewed immutable provider digest mismatch')
  if b'ODDS_EXTENDED_BUDGET_EXHAUSTED' not in code or b'ODDS_EXTENDED_BATCH_SUMMARY' not in code:
   stop('Expected budget and diagnostic markers missing')
  if b'ODDS_PROVIDER_CORE_BATCH_SUMMARY' not in code or b'OUT_OF_USAGE_CREDITS' not in code:
   stop('Existing core quote and quota protections not preserved')
  if code.count(b'if (!sourceUpdatedAt || !Number.isFinite(Date.parse(sourceUpdatedAt))) continue;')!=2:
   stop('Unverified bookmaker timestamp handling')
  compiler=ROOT/'node_modules/typescript/bin/tsc'
  if not compiler.is_file():stop('TypeScript compiler missing')
  backup=P('/home/novaadmin')/('odds-extended-budget-backup-'+str(int(time.time())))
  backup.mkdir(mode=0o700)
  (backup/'the-odds-api.ts').write_bytes(previous)
  print('BACKUP_CREATED '+str(backup),flush=True)
  modified=False;restarted=False
  try:
   modified=True
   atomic(TARGET,code,meta)
   test=cmd('/usr/sbin/runuser','-u','novaadmin','--','/usr/bin/node',
       str(compiler),'--noEmit','--pretty','false','--incremental','false',
       cwd=str(ROOT),timeout=240)
   if test.returncode:
    print('TYPECHECK_ERRORS','\n'.join((test.stdout+test.stderr).splitlines()[:15])[:1400],flush=True)
    stop('TypeScript validation failed')
   print('TYPECHECK_PASS',flush=True)
   current=ps()
   if online(current,BULK)['pid']!=bulk['pid']:
    stop('Bulk odds PID changed during preparation')
   for name,proc in guards.items():
    if online(current,name)['pid']!=proc['pid']:
     stop('Protected process changed during preparation')
   restarted=True
   pm('restart',BULK)
   time.sleep(15)
   after=ps()
   if online(after,BULK)['pid']==bulk['pid']:
    stop('Expected new bulk odds PID')
   for name,proc in guards.items():
    if online(after,name)['pid']!=proc['pid']:
     stop('Protected process unexpectedly changed')
   print('ODDS_EXTENDED_BUDGET_DEPLOYED revision='+REV,flush=True)
   print('ODDS_BULK_ONLINE pid='+str(online(after,BULK)['pid']),flush=True)
   print('LIVE_SETTLEMENT_AND_STATS_UNCHANGED',flush=True)
  except Exception:
   if modified:
    atomic(TARGET,previous,meta)
    print('ODDS_PROVIDER_ROLLBACK_COMPLETE',flush=True)
   if restarted:
    try:
     pm('restart',BULK)
     print('PREVIOUS_ODDS_PROCESS_RESTORED',flush=True)
    except Exception: print('URGENT: manually verify bulk odds worker status',flush=True)
   raise
if __name__=='__main__':
 try:main()
 except Exception as e:
  print(str(e),flush=True)
  sys.exit(1)
