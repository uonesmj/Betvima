#!/usr/bin/env python3
"""Guarded BetVima bookmaker-quote fairness hotfix for customized VPS odds worker.

Never replaces the customized running odds worker with an upstream copy.
Never edits 5Dollar stats, live-price, settlement, web, wallet or financial data.
"""
import fcntl, hashlib, json, os, pathlib, pwd, stat, subprocess, sys, tempfile, time, urllib.request

P=pathlib.Path
REV='2d759a7e5efd04d811219214d8bb4c9829fce661'
ROOT=P('/opt/nova-releases/24dab3702c58a5baa4b5f18ccc1eee15b2c6fdac')
WORKER=ROOT/'src/workers/odds.worker.ts'
HELPER=ROOT/'src/workers/prematch-selection-fairness.ts'
HELPER_BLOB='12af303a0bac2046add4b81ea84cbbe9a3a12537'
BULK='betvima-odds-worker'
GUARDED=('betvima-live-odds-worker','betvima-settlement-worker','betvima-football-stats-worker')
OWNER=pwd.getpwnam('novaadmin')
IMPORT_OLD="import { duePrematchRefreshes, prematchRefreshCadence, type PrematchRefreshClock } from './prematch-refresh-cadence';"
IMPORT_NEW=IMPORT_OLD+"\nimport { selectFairPrematchRefreshes, selectFairExtendedRefreshes } from './prematch-selection-fairness';"
CLOCK_OLD="const lastPrematchByProvider = new Map<string, PrematchRefreshClock>();"
CLOCK_NEW=CLOCK_OLD+(
 "\nconst lastPrematchAttemptByProvider = new Map<string, Map<string, number>>();"
 "\nconst lastExtendedAttemptByProvider = new Map<string, Map<string, number>>();")
def stop(msg):raise RuntimeError('SAFETY_STOP: '+msg)
def blob(raw):return hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest()
def run(*args,timeout=120,cwd=None):
 return subprocess.run(args,capture_output=True,text=True,timeout=timeout,cwd=cwd)
def pm(*args):
 result=run('/usr/sbin/runuser','-u','novaadmin','--','/usr/bin/env',
   'PM2_HOME=/home/novaadmin/.pm2','/usr/bin/pm2',*args,timeout=150)
 if result.returncode:stop('PM2 '+args[0]+' failed code='+str(result.returncode))
 return result.stdout
def apps():return json.loads(pm('jlist'))
def one(items,name):
 matching=[x for x in items if x.get('name')==name]
 if len(matching)!=1 or matching[0].get('pm2_env',{}).get('status')!='online' or not matching[0].get('pid'):
  stop('Process not uniquely online: '+name)
 return matching[0]
def replace_once(src,old,new):
 count=src.count(old)
 if count!=1:stop('Unexpected source anchor count '+str(count)+': '+old[:75])
 return src.replace(old,new,1)
def rewrite(src):
 if src.count("ODDS_BULK_LIVE_SKIP")!=1 or 'prematchRefreshCadence(' not in src:
  stop('VPS odds worker missing expected dedicated-live safety adaptations')
 if 'ODDS_PREMATCH_FAIR_COVERAGE' in src or 'selectFairExtendedRefreshes' in src:
  stop('Partial prior fairness modifications; inspect before retry')
 src=replace_once(src,IMPORT_OLD,IMPORT_NEW)
 src=replace_once(src,CLOCK_OLD,CLOCK_NEW)
 head="        const pending = includePrematch"
 tail="        const extendedPending ="
 a=src.find(head);b=src.find(tail,a+1)
 if a<0 or b<=a:stop('Could not isolate core prematch selection')
 core=src[a:b]
 core=replace_once(core,head,"        const pendingCandidates = includePrematch")
 for n in (5,6,7):
  core=replace_once(core,'bucket_rank <= $'+str(n)+'::int',
     'bucket_rank <= greatest($'+str(n)+'::int * 20, 500)')
 if not core.rstrip().endswith(': [];'):stop('Core selection result has a different termination')
 fairness="""        let recentAttempts = lastPrematchAttemptByProvider.get(sourceProvider.name);
        if (!recentAttempts) {
          recentAttempts = new Map<string, number>();
          lastPrematchAttemptByProvider.set(sourceProvider.name, recentAttempts);
        }
        const pending = selectFairPrematchRefreshes(
          pendingCandidates, now,
          { near: cadence.nearLimit, mid: cadence.midLimit, far: cadence.farLimit },
          { near: includePrematchNear, mid: includePrematchMid, far: includePrematchFar },
          recentAttempts,
        );
        console.log("ODDS_PREMATCH_FAIR_COVERAGE", JSON.stringify({
          provider: sourceProvider.name,
          discoveredCandidates: pendingCandidates.length,
          scheduledAttempts: pending.length,
        }));

"""
 src=src[:a]+core+fairness+src[b:]
 ext_anchor="        const extendedPending ="
 ext_end='        console.log("ODDS_PREMATCH_FETCH_START"'
 x=src.index(ext_anchor);y=src.find(ext_end,x)
 if y<=x:stop('Could not isolate extended-prematch region')
 ext=src[x:y]
 ext=replace_once(ext,ext_anchor,"        const extendedCandidates =")
 if "source_quote.odds_updated_at >= now() - interval '15 minutes'" not in ext:
  stop('Fresh core eligibility predicate missing; refuse extended modification')
 ext=replace_once(ext,"source_quote.odds_updated_at >= now() - interval '15 minutes'",
                      "source_quote.odds_updated_at >= now() - interval '5 minutes'")
 ext=replace_once(ext,"source_quote.provider_timestamp >= now() - interval '15 minutes'",
                      "source_quote.provider_timestamp >= now() - interval '5 minutes'")
 # Only the event-detail candidate limit changes. Provider API request budget stays at <=8.
 ext=replace_once(ext,'limit $1','limit greatest($1::int * 20, 500)')
 first=ext.find('        const extendedNearProviderIds =')
 if first<0 or 'const extendedFarProviderIds =' not in ext or 'const extendedProviderIds = ' not in ext:
  stop('Extended near/far candidate selection differs from reviewed source')
 replacement="""        let extendedAttempts = lastExtendedAttemptByProvider.get(sourceProvider.name);
        if (!extendedAttempts) {
          extendedAttempts = new Map<string, number>();
          lastExtendedAttemptByProvider.set(sourceProvider.name, extendedAttempts);
        }
        const extendedPending = selectFairExtendedRefreshes(
          extendedCandidates, now, cadence.extendedLimit, extendedAttempts,
        );
        const extendedProviderIds = extendedPending
          .map((row) => row.provider_id)
          .filter((id): id is string => Boolean(id));
        console.log("ODDS_EXTENDED_FAIR_COVERAGE", JSON.stringify({
          provider: sourceProvider.name,
          eligibleCandidates: extendedCandidates.length,
          scheduledAttempts: extendedProviderIds.length,
        }));

"""
 ext=ext[:first]+replacement
 src=src[:x]+ext+src[y:]
 if src.count('ODDS_PREMATCH_FAIR_COVERAGE')!=1 or src.count('ODDS_EXTENDED_FAIR_COVERAGE')!=1:
  stop('Fairness patch must be applied exactly once')
 if src.count('const extendedPending = ')!=1 or src.count('const pending = selectFairPrematchRefreshes(')!=1:
  stop('Unexpected resulting scheduling symbols')
 if 'ODDS_BULK_LIVE_SKIP' not in src or 'publish_odds_tick_batch' not in src:
  stop('Critical existing odds safeguards were not preserved')
 return src
def atomic(path,data,existing_stat):
 fd,tmp=tempfile.mkstemp(prefix='.betvima-fair-odds-',dir=path.parent)
 try:
  with os.fdopen(fd,'wb') as output:
   output.write(data);output.flush();os.fsync(output.fileno())
  os.chown(tmp,existing_stat.st_uid,existing_stat.st_gid)
  os.chmod(tmp,stat.S_IMODE(existing_stat.st_mode))
  os.replace(tmp,path)
 finally:
  if os.path.exists(tmp):os.unlink(tmp)
def main():
 if os.geteuid()!=0:stop('Must run as root')
 with open('/run/lock/betvima-bulk-odds-patch.lock','a+b') as lock:
  fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
  before=apps()
  bulk=one(before,BULK)
  guarded={name:one(before,name) for name in GUARDED}
  if bulk['pm2_env'].get('pm_cwd')!=str(ROOT):
   stop('Unexpected odds-worker release directory; do not patch')
  if not WORKER.is_file() or WORKER.is_symlink() or HELPER.is_symlink():
   stop('Odds source missing or symlink')
  original=WORKER.read_bytes()
  old_state=WORKER.stat()
  if HELPER.exists():
   if not HELPER.is_file() or blob(HELPER.read_bytes())!=HELPER_BLOB:
    stop('Unexpected existing helper content')
   helper_was_present=True
  else:helper_was_present=False
  if b'ODDS_PREMATCH_FAIR_COVERAGE' in original and helper_was_present:
   print('ALREADY_DEPLOYED: Odds fairness scheduler',flush=True)
   return
  src=rewrite(original.decode('utf8')).encode('utf8')
  url='https://raw.githubusercontent.com/uonesmj/Betvima/'+REV+'/src/workers/prematch-selection-fairness.ts'
  with urllib.request.urlopen(url,timeout=45) as response:helper=response.read(12001)
  if len(helper)>12000 or blob(helper)!=HELPER_BLOB:
   stop('Reviewed GitHub helper integrity check failed')
  backup=P('/home/novaadmin')/('odds-fairness-backup-'+str(int(time.time())))
  backup.mkdir(mode=0o700)
  (backup/'odds.worker.ts').write_bytes(original)
  print('BACKUP_CREATED',backup,flush=True)
  changed=False;restarted=False
  try:
   changed=True
   if not helper_was_present:
    fd,tmp=tempfile.mkstemp(prefix='.betvima-fair-helper-',dir=HELPER.parent)
    try:
     with os.fdopen(fd,'wb') as output:
      output.write(helper);output.flush();os.fsync(output.fileno())
     os.chown(tmp,old_state.st_uid,old_state.st_gid)
     os.chmod(tmp,stat.S_IMODE(old_state.st_mode))
     os.replace(tmp,HELPER)
    finally:
     if os.path.exists(tmp):os.unlink(tmp)
   atomic(WORKER,src,old_state)
   tsc=ROOT/'node_modules/typescript/bin/tsc'
   if not tsc.is_file():stop('Local TypeScript compiler missing')
   checked=run('/usr/sbin/runuser','-u','novaadmin','--','/usr/bin/node',str(tsc),
      '--noEmit','--pretty','false','--incremental','false',cwd=str(ROOT),timeout=240)
   if checked.returncode:
    print('TYPECHECK_ERROR','\n'.join((checked.stdout+checked.stderr).splitlines()[:12])[:1400],flush=True)
    stop('TypeScript typecheck failed; restoring original worker')
   print('TYPECHECK_PASS',flush=True)
   current=apps()
   if one(current,BULK).get('pid')!=bulk.get('pid'):stop('Odds worker changed during preparation')
   for name,process in guarded.items():
    if one(current,name).get('pid')!=process.get('pid'):
     stop('Unrelated process changed during preparation')
   restarted=True
   pm('restart',BULK)
   time.sleep(15)
   after=apps()
   active=one(after,BULK)
   if active.get('pid')==bulk.get('pid'):
    stop('Expected odds worker restart was not observed')
   for name,process in guarded.items():
    if one(after,name).get('pid')!=process.get('pid'):
     stop('Unrelated process changed after odds restart')
   print('ODDS_FAIRNESS_DEPLOYED revision='+REV,flush=True)
   print('ODDS_BULK_ONLINE pid='+str(active.get('pid')),flush=True)
   print('LIVE_SETTLEMENT_AND_STATS_UNCHANGED',flush=True)
  except Exception:
   if changed:
    atomic(WORKER,original,old_state)
    if not helper_was_present:HELPER.unlink(missing_ok=True)
    print('SOURCE_ROLLBACK_COMPLETE',flush=True)
   if restarted:
    try:
     pm('restart',BULK)
     print('PREVIOUS_ODDS_PROCESS_RESTORED',flush=True)
    except Exception:
     print('URGENT: inspect main odds process health',flush=True)
   raise

if __name__=='__main__':
 try:main()
 except Exception as error:
  print(str(error),flush=True)
  sys.exit(1)
