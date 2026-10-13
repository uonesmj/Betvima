#!/usr/bin/env python3
"""Guarded, narrow production rollout for already-audited 5Dollar football odds.
Only the dedicated live-odds PM2 process may restart. No database writes.
Refuses unexpected versions, paths, processes and source bytes. Restores on error.
Prerequisite: authenticated SQL quote guards already applied to production.
"""
import fcntl
import hashlib
import json
import os
import pathlib
import pwd
import stat
import subprocess
import sys
import tempfile
import time
import urllib.request

P=pathlib.Path
ROOT=P('/opt/nova-releases/0dcade1f3299935e6eaff732484538df62ddf5fa')
BASE_REV='0dcade1f3299935e6eaff732484538df62ddf5fa'
REV='ff35935d5b7efb63f522073a2702ef9ba889a32b'
LIVE='betvima-live-odds-worker'
PROTECTED=('betvima-odds-worker','betvima-settlement-worker','betvima-football-stats-worker')
OWNER=pwd.getpwnam('novaadmin')
FILES={
 # (confirmed VPS source blob, immutable GitHub 32c929c base blob, desired ff35935 blob)
 'src/workers/odds.worker.ts':('33e159ab069d3c8f455e6c25b66efd4f0a3dcd04','f16cfbc0117aaf7f1a7dc4cae0f6d2b03237f628','a82444c04eca811875ef8c20689e2c92e567ebb4'),
 'src/workers/sports-provider-sync.ts':('07610e9fcfa058a46987e024de7fb76ffb361701','07610e9fcfa058a46987e024de7fb76ffb361701','cdf48b7d6c3b49f9627c2445c5d2087930c6a342'),
 'src/providers/5dollar-football-api.ts':('5b118b93f1794933c38cb17a56bc197a49a8ef35','5b118b93f1794933c38cb17a56bc197a49a8ef35','65abc27f687a4f0f73f8b9cafb1c945fb1570deb'),
 'src/providers/fivedollar-authenticated-h2h.ts':(None,None,'dff19aa30ee0ab7d407c893f5f50a6d81a42db6c'),
 # New pure scheduling dependencies, not present in the old worker release.
 'src/workers/prematch-refresh-cadence.ts':(None,None,'ec4bc6ed176000b9630d4955529aebe2df373b30'),
 'src/workers/prematch-selection-fairness.ts':(None,None,'12af303a0bac2046add4b81ea84cbbe9a3a12537'),
}
def stop(message):
 raise RuntimeError('SAFETY_STOP: '+message)
def blob(v):
 return hashlib.sha1(b'blob '+str(len(v)).encode()+b'\0'+v).hexdigest()
def cmd(*args,timeout=120,cwd=None,env=None):
 return subprocess.run(args,capture_output=True,text=True,timeout=timeout,cwd=cwd,env=env)
def pm(*args,enabled=None):
 environment={'PM2_HOME':'/home/novaadmin/.pm2'}
 if enabled is not None:environment['FIVEDOLLAR_BETTING_ODDS_ENABLED']='true' if enabled else 'false'
 r=cmd('/usr/sbin/runuser','-u','novaadmin','--','/usr/bin/env',
       *(f'{key}={value}' for key,value in environment.items()),
       '/usr/bin/pm2',*args,timeout=120)
 if r.returncode:stop('PM2_'+args[0]+'_FAILED')
 return r.stdout
def apps():return json.loads(pm('jlist'))
def online(data,name):
 found=[proc for proc in data if proc.get('name')==name]
 if len(found)!=1 or found[0].get('pm2_env',{}).get('status')!='online' or not found[0].get('pid'):
  stop('SERVICE_NOT_READY_'+name)
 return found[0]
def atomic(path,raw,stat_info=None):
 fd,tmp=tempfile.mkstemp(prefix='.fivedollar-atomic-',dir=path.parent)
 try:
  with os.fdopen(fd,'wb') as f:
   f.write(raw);f.flush();os.fsync(f.fileno())
  os.chown(tmp,stat_info.st_uid if stat_info else OWNER.pw_uid,
           stat_info.st_gid if stat_info else OWNER.pw_gid)
  os.chmod(tmp,stat.S_IMODE(stat_info.st_mode) if stat_info else 0o644)
  os.replace(tmp,path)
 finally:
  if os.path.exists(tmp):os.unlink(tmp)
def retrieve(path,expected,revision=REV):
 url='https://raw.githubusercontent.com/uonesmj/Betvima/'+revision+'/'+path
 with urllib.request.urlopen(url,timeout=45) as r:raw=r.read(180000)
 if len(raw)>179999 or blob(raw)!=expected:stop('IMMUTABLE_SOURCE_CHECK_FAILED_'+path)
 return raw

def three_way_merge(name,local,base,desired):
 # Preserve audited VPS-only customizations rather than replacing the source.
 # git merge-file refuses conflicting changes and never modifies the originals.
 with tempfile.TemporaryDirectory(prefix='betvima-fivedollar-merge-') as temporary:
  folder=P(temporary)
  for label,content in (('local',local),('base',base),('desired',desired)):
   (folder/label).write_bytes(content)
  r=cmd('/usr/bin/git','merge-file','--stdout',
        str(folder/'local'),str(folder/'base'),str(folder/'desired'),timeout=45)
  if r.returncode!=0:stop('CUSTOM_SOURCE_MERGE_CONFLICT_'+name)
  merged=r.stdout.encode('utf-8')
  if b'<<<<<<<' in merged or b'>>>>>>>' in merged:
   stop('UNRESOLVED_SOURCE_CONFLICT_'+name)
  return merged
def main():
 if os.geteuid()!=0:stop('ROOT_REQUIRED')
 if not ROOT.is_dir():stop('RELEASE_ROOT_UNRECOGNIZED')
 with open('/run/lock/betvima-fivedollar-live-odds.lock','a+b') as lock:
  fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
  # Safe activation order: web must already enforce source-dated 45-second
  # live quotes, or it could display stale 5Dollar prices as actionable.
  try:
   request=urllib.request.Request('https://betvima.com/api/v1/live?limit=1',
                                  headers={'Accept':'application/json'})
   with urllib.request.urlopen(request,timeout=35) as response:
    if response.status!=200:stop('WEB_CATALOGUE_HTTP_STATUS')
    snapshot=response.read(262145)
   if len(snapshot)>262144 or b'fivedollar-authenticated-45s-v1' not in snapshot:
    stop('WEB_CATALOGUE_INTEGRITY_VERSION_NOT_DEPLOYED')
  except RuntimeError:raise
  except Exception:stop('WEB_CATALOGUE_INTEGRITY_PREFLIGHT_UNAVAILABLE')
  print('WEB_CATALOGUE_INTEGRITY_VERIFIED',flush=True)
  before=apps()
  live=online(before,LIVE)
  protected={name:online(before,name) for name in PROTECTED}
  if live['pm2_env'].get('pm_cwd')!=str(ROOT):stop('LIVE_WORKER_RELEASE_CHANGED')
  if live['pm2_env'].get('pm_exec_path')!=str(ROOT/'src/workers/entrypoints/odds.worker.ts'):
   stop('LIVE_WORKER_ENTRYPOINT_UNEXPECTED')
  if live['pm2_env'].get('FIVEDOLLAR_BETTING_ODDS_ENABLED')=='true':
   stop('LIVE_ODDS_FLAG_ALREADY_ENABLED')
  originals={}
  newbytes={}
  for name,(server_sha,base_sha,new_sha) in FILES.items():
   path=ROOT/name
   if path.is_symlink():stop('SOURCE_SYMLINK_'+name)
   if server_sha is None:
    if path.exists():stop('NEW_SOURCE_ALREADY_PRESENT_'+name)
    originals[name]=(None,None)
    newbytes[name]=retrieve(name,new_sha)
   else:
    if not path.is_file():stop('SOURCE_FILE_MISSING_'+name)
    old=path.read_bytes()
    if blob(old)!=server_sha:
     stop('UNREVIEWED_CUSTOM_SOURCE_'+name+'_blob_'+blob(old))
    originals[name]=(old,path.stat())
    base=retrieve(name,base_sha,BASE_REV)
    target=retrieve(name,new_sha)
    newbytes[name]=three_way_merge(name,old,base,target)
    print('SOURCE_MERGE_CLEAN '+name,flush=True)
  # The dependency files come from the same reviewed immutable GitHub revision.
  if not all(name in newbytes for name in (
      'src/workers/prematch-refresh-cadence.ts',
      'src/workers/prematch-selection-fairness.ts',
  )):stop('REQUIRED_SCHEDULING_DEPENDENCIES_MISSING')
  print('SCHEDULING_DEPENDENCIES_VERIFIED',flush=True)
  required=(
    b'FIVEDOLLAR_BETTING_ODDS_ENABLED',b'authenticatedFiveDollarH2h',
    b'lastFiveDollarLiveOddsAttempt',b'ODDS_LIVE_WORKER_SYNC_DONE',
  )
  allcode=b'\n'.join(newbytes.values())
  if any(marker not in allcode for marker in required):stop('SOURCE_SECURITY_MARKER_MISSING')
  compiler=ROOT/'node_modules/typescript/bin/tsc'
  if not compiler.is_file():stop('TYPESCRIPT_COMPILER_MISSING')
  backup=P('/home/novaadmin')/('fivedollar-odds-live-backup-'+str(int(time.time())))
  backup.mkdir(mode=0o700)
  for name,(raw,_) in originals.items():
   if raw is not None:
    destination=backup/(name.replace('/','__'))
    destination.write_bytes(raw)
    destination.chmod(0o600)
  print('BACKUP_CREATED '+str(backup),flush=True)
  changed=[]
  restarted=False
  try:
   for name,raw in newbytes.items():
    old,oldstat=originals[name]
    atomic(ROOT/name,raw,oldstat)
    changed.append(name)
   check=cmd('/usr/sbin/runuser','-u','novaadmin','--','/usr/bin/node',
             str(compiler),'--noEmit','--pretty','false','--incremental','false',
             cwd=str(ROOT),timeout=240)
   if check.returncode:
    print('TYPECHECK_ERRORS', ' '.join((check.stdout+check.stderr).splitlines()[:7])[:900],flush=True)
    stop('TYPESCRIPT_VALIDATION_FAILED')
   print('TYPECHECK_PASS',flush=True)
   current=apps()
   if online(current,LIVE)['pid']!=live['pid']:stop('LIVE_WORKER_CHANGED_DURING_PREP')
   for name,proc in protected.items():
    if online(current,name)['pid']!=proc['pid']:stop('PROTECTED_PROCESS_CHANGED_DURING_PREP')
   restarted=True
   pm('restart',LIVE,'--update-env',enabled=True)
   time.sleep(18)
   after=apps()
   latest=online(after,LIVE)
   if latest['pid']==live['pid']:stop('LIVE_RESTART_PID_NOT_CHANGED')
   if latest['pm2_env'].get('FIVEDOLLAR_BETTING_ODDS_ENABLED')!='true':
    stop('LIVE_FEATURE_FLAG_NOT_CONFIRMED')
   for name,proc in protected.items():
    if online(after,name)['pid']!=proc['pid']:stop('PROTECTED_PROCESS_CHANGED_AFTER_RESTART')
   pm('save')
   print('FIVEDOLLAR_ODDS_LIVE_DEPLOYED revision='+REV,flush=True)
   print('LIVE_ODDS_WORKER_ONLINE pid='+str(latest['pid']),flush=True)
   print('BULK_SETTLEMENT_STATS_UNCHANGED',flush=True)
  except Exception:
   for name in reversed(changed):
    raw,oldstat=originals[name]
    if raw is None:
     (ROOT/name).unlink(missing_ok=True)
    else:
     atomic(ROOT/name,raw,oldstat)
   print('SOURCE_ROLLBACK_COMPLETED',flush=True)
   if restarted:
    try:
     pm('restart',LIVE,'--update-env',enabled=False)
     pm('save')
     print('LIVE_WORKER_ROLLBACK_COMPLETED',flush=True)
    except Exception:print('URGENT_LIVE_WORKER_MANUAL_CHECK_REQUIRED',flush=True)
   raise
if __name__=='__main__':
 try:main()
 except Exception as e:
  print(str(e),flush=True)
  sys.exit(1)
