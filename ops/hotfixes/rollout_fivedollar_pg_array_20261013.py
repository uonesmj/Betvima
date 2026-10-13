#!/usr/bin/env python3
"""Guarded, reversible PostgreSQL text-array + stats-tick-only hotfix.

No modification, restart or reconfiguration to betting odds, live odds,
settlement, wallet, HTTP frontend or any PostgreSQL function.
"""
import fcntl, hashlib, json, os, pathlib, pwd, stat, subprocess, sys, tempfile, time, urllib.request

P=pathlib.Path
ROOT=P('/opt/nova-releases/24dab3702c58a5baa4b5f18ccc1eee15b2c6fdac')
SYNC=ROOT/'src/workers/sports-provider-sync.ts'
STATS=ROOT/'src/workers/fivedollar-stats.worker.ts'
REV='b59359a006f514af78ad9863cc3953c2acaa048d'
NEW_STATS_BLOB='fa9735060b04dc7247f5e5e1adab2a0f01723831'
OLD_STATS_BLOB='cb40083cda8a401a8be66046ab84f650f7aa837a'
NEW_SYNC_BLOB='fa5a67cd0cf068bace7004df99b575fbf09b854a'
BASE_SYNC_REV='c1cc6aee2662e23057c4441575ccb382226141a7'
BASE_SYNC_BLOB='50dbb1ef113b387b7299c27182c40a2131a81931'
SERVICE='betvima-football-stats-worker'
GUARDED=('betvima-odds-worker','betvima-live-odds-worker','betvima-settlement-worker')
OWNER=pwd.getpwnam('novaadmin')

def stop(message):raise RuntimeError('SAFETY_STOP: '+message)
def blob(content):return hashlib.sha1(b'blob '+str(len(content)).encode()+b'\0'+content).hexdigest()
def run(*args,timeout=90,cwd=None):
 return subprocess.run(args,capture_output=True,text=True,timeout=timeout,cwd=cwd)
def pm(*args):
 r=run('/usr/sbin/runuser','-u','novaadmin','--','/usr/bin/env',
       'PM2_HOME=/home/novaadmin/.pm2','/usr/bin/pm2',*args)
 if r.returncode:stop('PM2_FAILED '+args[0]+' exit '+str(r.returncode))
 return r.stdout
def apps():return json.loads(pm('jlist'))
def one(items,name):
 matching=[a for a in items if a.get('name')==name]
 if len(matching)!=1 or matching[0].get('pm2_env',{}).get('status')!='online':
  stop('Service is not uniquely online: '+name)
 return matching[0]
def remote(path,expected,revision=REV):
 url='https://raw.githubusercontent.com/uonesmj/Betvima/'+revision+'/'+path
 with urllib.request.urlopen(url,timeout=45) as f:data=f.read(150001)
 if len(data)>150000 or blob(data)!=expected:stop('Reviewed Git blob mismatch: '+path)
 return data
def atomic(path,content,old_stat):
 if path.is_symlink():stop('Refusing symlink path')
 fd,tmp=tempfile.mkstemp(prefix='.football-array-patch-',dir=path.parent)
 try:
  with os.fdopen(fd,'wb') as target:
   target.write(content);target.flush();os.fsync(target.fileno())
  os.chown(tmp,old_stat.st_uid,old_stat.st_gid)
  os.chmod(tmp,stat.S_IMODE(old_stat.st_mode))
  os.replace(tmp,path)
 finally:
  if os.path.exists(tmp):os.unlink(tmp)

def main():
 if os.geteuid():stop('Root required')
 with open('/run/lock/betvima-football-stats-install.lock','a+b') as lock:
  fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
  before=apps()
  target=one(before,SERVICE)
  guard={name:one(before,name) for name in GUARDED}
  if not target.get('pid') or target.get('pm2_env',{}).get('pm_cwd')!=str(ROOT):
   stop('Dedicated stats process/release unexpectedly changed')
  if guard['betvima-odds-worker']['pm2_env'].get('pm_cwd')!=str(ROOT):
   stop('Bulk odds release unexpectedly changed')
  if not SYNC.is_file() or not STATS.is_file():stop('Expected source files are missing')
  current_sync=SYNC.read_bytes()
  current_stats=STATS.read_bytes()
  if blob(current_stats)==NEW_STATS_BLOB and b'pgArray(providerIds)' in current_sync:
   print('ALREADY_DEPLOYED: Postgres-array stats fix',flush=True)
   return
  if blob(current_stats)!=OLD_STATS_BLOB:
   stop('Unrecognized locally modified stats worker; nothing was changed')
  old='import type { Db } from "@/lib/ports/db";'
  old_param='    [providerName, providerIds],'
  code=current_sync.decode('utf8')
  if code.count(old)!=1 or code.count(old_param)!=1 or 'export async function resolveFiveDollarMatchRows(' not in code:
   stop('Provider alias resolver differs from examined version; nothing changed')
  if 'import { pgArray } from "@/server/db/rows";' in code:
   stop('Unexpected pre-existing PostgreSQL array import')
  candidate=code.replace(old,old+'\nimport { pgArray } from "@/server/db/rows";',1)
  candidate=candidate.replace(old_param,'    [providerName, pgArray(providerIds)],',1).encode()
  reviewed_sync=remote('src/workers/sports-provider-sync.ts',NEW_SYNC_BLOB)
  reviewed_stats=remote('src/workers/fivedollar-stats.worker.ts',NEW_STATS_BLOB)
  # Independently verify exactly what changed between the reviewed source
  # revisions before applying those two edits surgically on this VPS.
  # The VPS sync module intentionally retains earlier server-specific odds
  # adaptations and must NEVER be replaced wholesale by the GitHub copy.
  baseline=remote('src/workers/sports-provider-sync.ts',BASE_SYNC_BLOB,BASE_SYNC_REV)
  baseline_text=baseline.decode('utf8')
  old_expected=baseline_text.replace(
   old,old+'\nimport { pgArray } from "@/server/db/rows";',1
  ).replace(old_param,'    [providerName, pgArray(providerIds)],',1)
  if old_expected.encode('utf8')!=reviewed_sync:
   stop('Reviewed GitHub changes differ from the two expected array fixes')
  # Confirm the exact database query being patched and that both edits
  # belong to the FiveDollar fixture-ID resolver, never an odds function.
  resolver_start=code.find('export async function resolveFiveDollarMatchRows(')
  if resolver_start<0 or code.count('export async function resolveFiveDollarMatchRows(')!=1:
   stop('Ambiguous FiveDollar fixture resolver')
  resolver_tail=code[resolver_start:]
  if resolver_tail.count(old_param)!=1 or 'from unnest($2::text[]) as f(provider_id)' not in resolver_tail:
   stop('Unexpected FiveDollar PostgreSQL-array query')
  if not candidate.decode('utf8').count('pgArray(providerIds)')==1:
   stop('Unexpected number of converted PostgreSQL array arguments')
  if candidate!=reviewed_sync:
   print('SERVER_CUSTOMIZATIONS_PRESERVED',flush=True)
  tsc=ROOT/'node_modules/typescript/bin/tsc'
  if not tsc.is_file():stop('No local TypeScript compiler')
  stats_stat=STATS.stat()
  sync_stat=SYNC.stat()
  backup=P('/home/novaadmin')/('football-array-backup-'+str(int(time.time())))
  backup.mkdir(mode=0o700)
  (backup/'sports-provider-sync.ts').write_bytes(current_sync)
  (backup/'fivedollar-stats.worker.ts').write_bytes(current_stats)
  print('BACKUP_CREATED',backup,flush=True)
  modified=False
  restarted=False
  try:
   modified=True
   atomic(SYNC,candidate,sync_stat)
   atomic(STATS,reviewed_stats,stats_stat)
   chk=run('/usr/sbin/runuser','-u','novaadmin','--','/usr/bin/node',str(tsc),
            '--noEmit','--pretty','false','--incremental','false',cwd=str(ROOT),timeout=240)
   if chk.returncode:
    print('TYPECHECK_ERRORS','\n'.join((chk.stdout+chk.stderr).splitlines()[:14])[:1400],flush=True)
    stop('Typecheck failed')
   print('TYPECHECK_PASS',flush=True)
   current=apps()
   if one(current,SERVICE).get('pid')!=target.get('pid'):
    stop('Stats process changed while checking')
   for name,app in guard.items():
    if one(current,name).get('pid')!=app.get('pid'):
     stop('Protected process changed; refused to restart')
   restarted=True
   pm('restart',SERVICE)
   time.sleep(15)
   after=apps()
   new_stats=one(after,SERVICE)
   if new_stats.get('pid')==target.get('pid') or not new_stats.get('pid'):
    stop('Dedicated stats restart was not successful')
   for name,app in guard.items():
    if one(after,name).get('pid')!=app.get('pid'):
     stop('Protected process unexpectedly changed')
   print('FIVEDOLLAR_ARRAY_AND_CATALOG_FIX_DEPLOYED revision='+REV,flush=True)
   print('FIVEDOLLAR_STATS_ONLINE pid='+str(new_stats.get('pid')),flush=True)
   print('ODDS_LIVE_SETTLEMENT_UNCHANGED',flush=True)
  except Exception:
   if modified:
    atomic(SYNC,current_sync,sync_stat)
    atomic(STATS,current_stats,stats_stat)
    print('SOURCE_ROLLBACK_COMPLETE',flush=True)
   if restarted:
    try:
     pm('restart',SERVICE)
     print('PREVIOUS_STATS_PROCESS_RESTARTED',flush=True)
    except Exception:print('URGENT: inspect dedicated stats process status',flush=True)
   raise

if __name__=='__main__':
 try:main()
 except Exception as exc:
  print(str(exc),flush=True)
  sys.exit(1)
