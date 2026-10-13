#!/usr/bin/env python3
"""Guarded, rollbackable BetVima bulk odds-only priority hotfix."""
import hashlib, json, os, pathlib, runpy, stat, subprocess, sys, tempfile, time, urllib.request, fcntl, pwd
P=pathlib.Path
ROOT=P('/opt/nova-releases/24dab3702c58a5baa4b5f18ccc1eee15b2c6fdac')
SOURCE=ROOT/'src/workers/odds.worker.ts'
PROVIDER=ROOT/'src/providers/the-odds-api.ts'
HELPER=ROOT/'src/providers/odds-request-admission.ts'
OLD_BACKUP=P('/home/novaadmin/odds-surgical-backup-1791850052/odds.worker.ts')
OLD_SCRIPT=P('/tmp/betvima-odds-v4.py')
OLD_SCRIPT_SHA='c01e368a55961e9852bf20e568bd506bdd766f8c92fd4382b7826569669f1383'
BASE_SHA='506aa07416d8dfbf46016cbdc29bd6088e8eef25'
REV='4ccda40e49db37179599604c16ff95182f21a1b2'
BLOBS={
 'src/workers/odds.worker.ts':'db380fd7613bc144b348e44c6bb6e5135d4b71b9',
 'src/providers/the-odds-api.ts':'34949e480b7313c1be47505a5f6ac7560714d1d8',
 'src/providers/odds-request-admission.ts':'7f05b01852c8b4243029df5f4cec23763ba45aab',
}
OLD_PROVIDER='3dd5c5cab6ca62b8c972ed9295a5e3f9e085630b'
OLD_PROVIDER_REV='24dab3702c58a5baa4b5f18ccc1eee15b2c6fdac'
def stop(s):raise RuntimeError('SAFETY_STOP: '+s)
def blob(d):return hashlib.sha1(b'blob '+str(len(d)).encode()+b'\0'+d).hexdigest()
def fetched(path):
 url='https://raw.githubusercontent.com/uonesmj/Betvima/'+REV+'/'+path
 with urllib.request.urlopen(url,timeout=40) as resp:d=resp.read(200001)
 if len(d)>200000 or blob(d)!=BLOBS[path]:stop('Source verification failed: '+path)
 return d
def run(*cmd,timeout=90,cwd=None):
 return subprocess.run(cmd,capture_output=True,text=True,timeout=timeout,cwd=cwd)
def pm(*cmd):
 p=run('/usr/sbin/runuser','-u','novaadmin','--','/usr/bin/env','PM2_HOME=/home/novaadmin/.pm2','/usr/bin/pm2',*cmd)
 if p.returncode:stop('PM2 failed: '+cmd[0]+' exit='+str(p.returncode))
 return p.stdout
def app(items,name):
 a=[i for i in items if i.get('name')==name]
 if len(a)!=1 or a[0].get('pm2_env',{}).get('status')!='online':stop('PM2 changed: '+name)
 return a[0]
def atomic(path,data,origin):
 if path.is_symlink():stop('Symlink target')
 fd,tmp=tempfile.mkstemp(prefix='.bulk-odds-',dir=path.parent)
 try:
  with os.fdopen(fd,'wb') as f:f.write(data);f.flush();os.fsync(f.fileno())
  os.chmod(tmp,stat.S_IMODE(origin.st_mode));os.chown(tmp,origin.st_uid,origin.st_gid)
  os.replace(tmp,path)
 finally:
  if os.path.exists(tmp):os.unlink(tmp)
def local_bulk_processes():
 found=[]
 uid=pwd.getpwnam('novaadmin').pw_uid
 for f in P('/proc').iterdir():
  if not f.name.isdigit():continue
  try:
   cwd=os.readlink(f/'cwd')
   cmdline=(f/'cmdline').read_bytes().replace(b'\0',b' ').decode('utf8','replace')
   realuid=int((f/'status').read_text().split('Uid:')[1].split()[0])
   if cwd==str(ROOT) and realuid==uid and 'src/workers/entrypoints/odds.worker.ts' in cmdline:
    found.append(int(f.name))
  except (OSError,ValueError,IndexError):pass
 return found
def main():
 if os.geteuid()!=0:stop('Root required')
 with open('/run/lock/betvima-bulk-odds-patch.lock','a+b') as lock:
  fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
  before=json.loads(pm('jlist'))
  bulk=app(before,'betvima-odds-worker')
  live=app(before,'betvima-live-odds-worker')
  settle=app(before,'betvima-settlement-worker')
  if bulk['pm2_env'].get('pm_cwd')!=str(ROOT) or settle['pm2_env'].get('pm_cwd')!=str(ROOT):
   stop('PM2 source release no longer matches')
  if live['pm2_env'].get('pm_cwd')==str(ROOT):stop('Dedicated live source unexpectedly shared')
  if bulk['pm2_env'].get('pm_exec_path')!=str(ROOT/'src/workers/entrypoints/odds.worker.ts'):
   stop('PM2 bulk entrypoint differs')
  processes=local_bulk_processes()
  print('BULK_PROCESS_PIDS:',processes,flush=True)
  if len(processes)>1:stop('Multiple bulk odds processes detected; refuse unsafe restart')
  if processes and bulk.get('pid') not in processes:stop('PM2 PID does not match local odds entrypoint')
  if not OLD_BACKUP.is_file() or not OLD_SCRIPT.is_file():stop('Prior verified rollback files missing')
  if hashlib.sha256(OLD_SCRIPT.read_bytes()).hexdigest()!=OLD_SCRIPT_SHA:stop('Original v4 rollout file was changed')
  original=OLD_BACKUP.read_bytes()
  if blob(original)!=BASE_SHA:stop('Previous worker backup is not trusted')
  expected=runpy.run_path(str(OLD_SCRIPT),run_name='_verified_v4')['patch_candidate'](original)
  current=SOURCE.read_bytes()
  if current!=expected:stop('Deployed v4 source differs; no changes')
  old_provider=PROVIDER.read_bytes()
  # Preserve any server-local provider edits when they merge without conflict
  # against the verified historic Git version. Never force a conflicted merge.
  provider_locally_modified=blob(old_provider)!=OLD_PROVIDER
  if HELPER.is_symlink():stop('Invalid existing admission helper')
  old_helper=HELPER.read_bytes() if HELPER.exists() else None
  if old_helper is not None and blob(old_helper)!=BLOBS['src/providers/odds-request-admission.ts']:
   stop('Unexpected existing admission helper')
  reviewed=fetched('src/workers/odds.worker.ts').decode('utf8')
  new_provider=fetched('src/providers/the-odds-api.ts')
  new_helper=fetched('src/providers/odds-request-admission.ts')
  if provider_locally_modified:
   baseline_url='https://raw.githubusercontent.com/uonesmj/Betvima/'+OLD_PROVIDER_REV+'/src/providers/the-odds-api.ts'
   with urllib.request.urlopen(baseline_url,timeout=40) as resp:baseline=resp.read(200001)
   if len(baseline)>200000 or blob(baseline)!=OLD_PROVIDER:
    stop('Unable to verify historic Odds API provider baseline')
   with tempfile.TemporaryDirectory(prefix='odds-provider-merge-') as tempdir:
    a,b,c=[P(tempdir)/name for name in ('local','base','reviewed')]
    a.write_bytes(old_provider);b.write_bytes(baseline);c.write_bytes(new_provider)
    merged=run('/usr/bin/git','merge-file','-p',str(a),str(b),str(c),timeout=50)
    if merged.returncode:
     stop('Server-local Odds API changes conflict with reviewed fix; untouched')
    new_provider=merged.stdout.encode('utf8')
   if b'createRequestAdmissionQueue' not in new_provider or b'<<<<<<<' in new_provider:
    stop('Provider merge did not retain the priority guard')
   print('LOCAL_PROVIDER_EDITS_MERGED_CONFLICT_FREE',flush=True)
  candidate=current.decode('utf8')
  # Only introduce dedicated-live detection. Keep the locally verified
  # prematch cadence and all other server-specific odds logic unchanged.
  marker='let lastLiveOddsAt = 0;'
  nextmarker='let lastExtendedLiveOddsAt = 0;'
  old_state=candidate.split(marker,1)[1].split(nextmarker,1)[0]
  new_state=reviewed.split(marker,1)[1].split(nextmarker,1)[0]
  if candidate.count(marker)!=1 or candidate.count(nextmarker)!=1 or new_state==old_state:
   stop('Unexpected per-provider heartbeat state')
  candidate=candidate.replace(marker+old_state+nextmarker,marker+new_state+nextmarker,1)
  begin='        if (includeLive) {'
  end='        const configuredPrematchProviders'
  a=candidate.index(begin);b=candidate.index(end,a)
  x=reviewed.index(begin);y=reviewed.index(end,x)
  old_block=candidate[a:b];new_block=reviewed[x:y]
  if old_block.count('await runDedicatedLiveTick(ctx)')!=1 or new_block.count('ODDS_BULK_LIVE_SKIP')!=1:
   stop('Bulk live fallback source mismatch')
  candidate=candidate[:a]+new_block+candidate[b:]
  if candidate.count('ODDS_BULK_LIVE_SKIP')!=1 or 'prematchRefreshCadence(' not in candidate:
   stop('Required safeguards not found')
  new_source=candidate.encode('utf8')
  src_stat=SOURCE.stat();prov_stat=PROVIDER.stat()
  helper_stat=HELPER.stat() if HELPER.exists() else prov_stat
  compiler=ROOT/'node_modules/typescript/bin/tsc'
  check=run('/usr/sbin/runuser','-u','novaadmin','--','/usr/bin/node',str(compiler),'--version',cwd=str(ROOT))
  if check.returncode or 'Version' not in check.stdout:stop('Local TypeScript compiler unavailable')
  backup=P('/home/novaadmin')/('odds-priority-backup-'+str(int(time.time())))
  backup.mkdir(mode=0o700)
  (backup/'odds.worker.ts').write_bytes(current)
  (backup/'the-odds-api.ts').write_bytes(old_provider)
  if old_helper is not None:(backup/'odds-request-admission.ts').write_bytes(old_helper)
  print('SAFE_BACKUP:',backup,flush=True)
  changed=False;restarted=False
  try:
   changed=True
   atomic(SOURCE,new_source,src_stat)
   atomic(PROVIDER,new_provider,prov_stat)
   atomic(HELPER,new_helper,helper_stat)
   result=run('/usr/sbin/runuser','-u','novaadmin','--','/usr/bin/node',str(compiler),'--noEmit','--pretty','false','--incremental','false',cwd=str(ROOT),timeout=240)
   if result.returncode:
    print('TYPECHECK_ERRORS:', '\n'.join((result.stdout+result.stderr).splitlines()[:13])[:1400],flush=True)
    stop('Typecheck failed')
   print('TYPECHECK_PASS',flush=True)
   restarted=True
   pm('restart','betvima-odds-worker')
   time.sleep(15)
   after=json.loads(pm('jlist'))
   newbulk=app(after,'betvima-odds-worker')
   newlive=app(after,'betvima-live-odds-worker')
   newsettle=app(after,'betvima-settlement-worker')
   if newbulk.get('pid')==bulk.get('pid') or not newbulk.get('pid'):stop('Bulk worker failed to restart')
   if newlive.get('pid')!=live.get('pid') or newsettle.get('pid')!=settle.get('pid'):
    stop('Unrelated live or financial worker PID changed')
   print('ODDS_PRIORITY_ROLLOUT_VERIFIED revision='+REV+' pid='+str(newbulk.get('pid')),flush=True)
   print('LIVE_AND_SETTLEMENT_UNCHANGED',flush=True)
  except Exception:
   if changed:
    atomic(SOURCE,current,src_stat);atomic(PROVIDER,old_provider,prov_stat)
    if old_helper is None:HELPER.unlink(missing_ok=True)
    else:atomic(HELPER,old_helper,helper_stat)
    print('SOURCE_ROLLBACK_DONE',flush=True)
   if restarted:
    try:pm('restart','betvima-odds-worker');print('OLD_BULK_ODDS_RESTARTED',flush=True)
    except Exception:print('URGENT: verify bulk odds PM2',flush=True)
   raise
if __name__=='__main__':
 try:main()
 except Exception as e:print(str(e),flush=True);sys.exit(1)
