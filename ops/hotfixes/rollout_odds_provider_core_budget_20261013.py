#!/usr/bin/env python3
"""Guarded provider-only BetVima fix for long odds tick stalls.

Update audited The Odds API core fetch + settlement-compatible optional
market selector. Never change database/settlement/wallet, reconfigure PM2,
restart live odds, stats, settlement or HTTP processes.
"""
import fcntl, hashlib, json, os, pathlib, pwd, stat, subprocess, sys, tempfile, time, urllib.request

P=pathlib.Path
ROOT=P('/opt/nova-releases/24dab3702c58a5baa4b5f18ccc1eee15b2c6fdac')
PROVIDER=ROOT/'src/providers/the-odds-api.ts'
SELECTOR=ROOT/'src/providers/extended-event-markets.ts'
REV='8f53c706cf36c04790d5e8e17f7c59724fb18864'
FILE_BLOBS={
 'src/providers/the-odds-api.ts':('4ebc0293d886811894384f9cdd9f13f773db702c','15d4a993d7c126e364b43af1f300a8d7ebb68579'),
 'src/providers/extended-event-markets.ts':('143dc9533dbf1bdd445b53a9daa0a20b16025061','24ee63e6c8e41721380939025af49c4597827298'),
}
BULK='betvima-odds-worker'
GUARDED=('betvima-live-odds-worker','betvima-settlement-worker','betvima-football-stats-worker')
OWNER=pwd.getpwnam('novaadmin')
def fail(message):raise RuntimeError('SAFETY_STOP: '+message)
def blob(content):return hashlib.sha1(b'blob '+str(len(content)).encode()+b'\0'+content).hexdigest()
def shell(*cmd,timeout=120,cwd=None):
 return subprocess.run(cmd,capture_output=True,text=True,timeout=timeout,cwd=cwd)
def pm(*args):
 r=shell('/usr/sbin/runuser','-u','novaadmin','--','/usr/bin/env',
         'PM2_HOME=/home/novaadmin/.pm2','/usr/bin/pm2',*args,timeout=120)
 if r.returncode:fail('PM2_'+args[0]+'_FAILED status='+str(r.returncode))
 return r.stdout
def all_pm():return json.loads(pm('jlist'))
def online(procs,name):
 matches=[p for p in procs if p.get('name')==name]
 if len(matches)!=1 or matches[0].get('pm2_env',{}).get('status')!='online' or not matches[0].get('pid'):
  fail('Unexpected PM2 process status: '+name)
 return matches[0]
def download(path,expected):
 url='https://raw.githubusercontent.com/uonesmj/Betvima/'+REV+'/'+path
 with urllib.request.urlopen(url,timeout=50) as res:
  raw=res.read(100001)
 if len(raw)>100000 or blob(raw)!=expected:
  fail('Git content integrity failed: '+path)
 return raw
def atomic(path,contents,existing_stat):
 fd,tmp=tempfile.mkstemp(prefix='.odds-core-guarded-',dir=path.parent)
 try:
  with os.fdopen(fd,'wb') as handle:
   handle.write(contents);handle.flush();os.fsync(handle.fileno())
  os.chown(tmp,existing_stat.st_uid,existing_stat.st_gid)
  os.chmod(tmp,stat.S_IMODE(existing_stat.st_mode))
  os.replace(tmp,path)
 finally:
  if os.path.exists(tmp):os.unlink(tmp)
def main():
 if os.geteuid()!=0:fail('Must run as root on the approved VPS')
 with open('/run/lock/betvima-bulk-odds-patch.lock','a+b') as lock:
  fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
  initial=all_pm()
  bulk=online(initial,BULK)
  protected={name:online(initial,name) for name in GUARDED}
  if bulk.get('pm2_env',{}).get('pm_cwd')!=str(ROOT):
   fail('Odds worker release path differs from audited production')
  if not (ROOT/'node_modules/typescript/bin/tsc').is_file():
   fail('TypeScript compiler missing')
  originals={}
  stats={}
  for relative,(old,new) in FILE_BLOBS.items():
   path=ROOT/relative
   if not path.is_file() or path.is_symlink():fail('Invalid target file '+relative)
   contents=path.read_bytes()
   originals[relative]=contents
   stats[relative]=path.stat()
   current=blob(contents)
   if current!=old:
    if current==new:fail('Already or partially patched; refuse to restart')
    fail('Unknown VPS modifications; refuse replacement of '+relative)
  updates={relative:download(relative,new) for relative,(_old,new) in FILE_BLOBS.items()}
  # The price owner must remain The Odds API, not the fixture-only 5Dollar.
  core=updates['src/providers/the-odds-api.ts']
  selector=updates['src/providers/extended-event-markets.ts']
  for marker in (b'ODDS_CORE_REQUEST_BUDGET_EXHAUSTED',
    b'ODDS_PROVIDER_SPORT_BATCH_FAILED',b'ODDS_PROVIDER_CORE_BATCH_SUMMARY',
    b'OUT_OF_USAGE_CREDITS',b'market.last_update'):
   if marker not in core:fail('Expected provider safety marker missing')
  if b'NOT_AUTOMATICALLY_SETTLEABLE' not in selector or b'isAutomatedSettlementMarket' not in selector:
   fail('Expected settlement restriction missing')
  backup=P('/home/novaadmin')/('odds-provider-core-budget-backup-'+str(int(time.time())))
  backup.mkdir(mode=0o700)
  for relative,contents in originals.items():
   (backup/P(relative).name).write_bytes(contents)
  print('BACKUP_CREATED '+str(backup),flush=True)
  changed=False
  restarted=False
  try:
   changed=True
   for relative,data in updates.items():
    atomic(ROOT/relative,data,stats[relative])
   tsc=shell('/usr/sbin/runuser','-u','novaadmin','--','/usr/bin/node',
      str(ROOT/'node_modules/typescript/bin/tsc'),
      '--noEmit','--pretty','false','--incremental','false',
      cwd=str(ROOT),timeout=240)
   if tsc.returncode:
    print('TYPECHECK_ERRORS','\n'.join((tsc.stdout+tsc.stderr).splitlines()[:15])[:1700],flush=True)
    fail('VPS TypeScript check failed, rollback required')
   print('TYPECHECK_PASS',flush=True)
   just_before=all_pm()
   if online(just_before,BULK).get('pid')!=bulk.get('pid'):fail('Bulk worker unexpectedly changed')
   for name,proc in protected.items():
    if online(just_before,name).get('pid')!=proc.get('pid'):fail('Protected worker unexpectedly changed')
   restarted=True
   pm('restart',BULK)
   time.sleep(18)
   after=all_pm()
   newbulk=online(after,BULK)
   if newbulk.get('pid')==bulk.get('pid'):fail('Bulk worker PID did not change after restart')
   for name,proc in protected.items():
    if online(after,name).get('pid')!=proc.get('pid'):fail('Protected worker PID changed unexpectedly')
   print('ODDS_PROVIDER_CORE_BUDGET_DEPLOYED revision='+REV,flush=True)
   print('ODDS_BULK_ONLINE pid='+str(newbulk.get('pid')),flush=True)
   print('LIVE_SETTLEMENT_AND_STATS_UNCHANGED',flush=True)
  except Exception:
   if changed:
    for relative,contents in originals.items():
     atomic(ROOT/relative,contents,stats[relative])
    print('PROVIDER_FILES_ROLLED_BACK',flush=True)
   if restarted:
    try:
     pm('restart',BULK)
     print('PREVIOUS_ODDS_PROCESS_RESTORED',flush=True)
    except Exception:print('URGENT: inspect bulk odds worker',flush=True)
   raise
if __name__=='__main__':
 try:main()
 except Exception as e:
  print(str(e),flush=True)
  sys.exit(1)
