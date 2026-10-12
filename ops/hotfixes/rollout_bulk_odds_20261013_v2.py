#!/usr/bin/env python3
"""Verified, rollback-capable hotpatch for BetVima bulk odds worker only."""
import fcntl, hashlib, json, os, pathlib, stat, subprocess, sys, tempfile, time, urllib.request
P=pathlib.Path
RELEASE=P('/opt/nova-releases/24dab3702c58a5baa4b5f18ccc1eee15b2c6fdac')
SOURCE=RELEASE/'src/workers/odds.worker.ts'
HELPER=RELEASE/'src/workers/prematch-refresh-cadence.ts'
BUDGET=RELEASE/'src/workers/odds-refresh-budget.ts'
OLD_REV='9edeed66434e1ffcc62d15856b88eeb536d1721c'
REV='3af3f7e5f07cce22045e73a7c30bdfa4ec7b2bc7'
OLD_BLOB='33e159ab069d3c8f455e6c25b66efd4f0a3dcd04'
SOURCE_BLOB='450086f5d8b3d2f931f17a4e707058027091b95a'
HELPER_BLOB='ec4bc6ed176000b9630d4955529aebe2df373b30'
BUDGET_BLOB='73351a25d5b877219b0a324eaeff1537c3157de2'
LOCAL_BLOB='506aa07416d8dfbf46016cbdc29bd6088e8eef25'

def stop(msg): raise RuntimeError('SAFETY_STOP: '+msg)
def blob(data): return hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()
def fetch(rev,path,expected):
    url=f'https://raw.githubusercontent.com/uonesmj/Betvima/{rev}/{path}'
    with urllib.request.urlopen(url,timeout=40) as r: data=r.read(300001)
    if len(data)>300000 or blob(data)!=expected: stop('Remote Git blob mismatch: '+path)
    return data

def proc(*args, timeout=120, cwd=None):
    return subprocess.run(args,timeout=timeout,cwd=cwd,capture_output=True,text=True)
def pm(*args):
    r=proc('/usr/sbin/runuser','-u','novaadmin','--','/usr/bin/env',
           'PM2_HOME=/home/novaadmin/.pm2','/usr/bin/pm2',*args,timeout=95)
    if r.returncode: stop('PM2 '+args[0]+' failed (exit '+str(r.returncode)+')')
    return r.stdout

def apps(): return json.loads(pm('jlist'))
def app(items,name):
    got=[x for x in items if x.get('name')==name]
    if len(got)!=1 or got[0].get('pm2_env',{}).get('status')!='online':
        stop('Required PM2 process missing/offline: '+name)
    return got[0]

def atomic(path,data,reference):
    if path.is_symlink(): stop('Symlink target refused: '+str(path))
    fd,tmp=tempfile.mkstemp(prefix='.odds-patch-',dir=path.parent)
    try:
        with os.fdopen(fd,'wb') as f: f.write(data); f.flush(); os.fsync(f.fileno())
        os.chown(tmp,reference.st_uid,reference.st_gid)
        os.chmod(tmp,stat.S_IMODE(reference.st_mode))
        os.replace(tmp,path)
    finally:
        if os.path.exists(tmp): os.unlink(tmp)

def run():
    if os.geteuid()!=0: stop('Run as root')
    with open('/run/lock/betvima-bulk-odds-patch.lock','a+b') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        if not SOURCE.is_file():
            stop('Bulk odds source missing in original PM2 release')
        # The original 24dab release predates the odds-refresh-budget module.
        # Its absence is EXPECTED; fetch that small helper with a verified Git blob.
        if not (RELEASE/'node_modules/.bin/tsc').is_file():
            stop('TypeScript checker missing from original release; no changes')
        before=apps()
        bulk=app(before,'betvima-odds-worker')
        live=app(before,'betvima-live-odds-worker')
        financial=app(before,'betvima-settlement-worker')
        if bulk['pm2_env']['pm_cwd']!=str(RELEASE) or financial['pm2_env']['pm_cwd']!=str(RELEASE):
            stop('Original worker paths changed')
        if bulk['pm2_env'].get('pm_exec_path')!=str(RELEASE/'src/workers/entrypoints/odds.worker.ts'):
            stop('Worker entry point changed')
        if live['pm2_env'].get('pm_cwd')==str(RELEASE): stop('Live and bulk unexpectedly share a source')
        original=SOURCE.read_bytes()
        if blob(original)!=LOCAL_BLOB:
            stop('Server worker content differs from inspected version; nothing changed')
        old=fetch(OLD_REV,'src/workers/odds.worker.ts',OLD_BLOB)
        incoming=fetch(REV,'src/workers/odds.worker.ts',SOURCE_BLOB)
        helper=fetch(REV,'src/workers/prematch-refresh-cadence.ts',HELPER_BLOB)
        budget=fetch(REV,'src/workers/odds-refresh-budget.ts',BUDGET_BLOB)
        if HELPER.is_symlink() or BUDGET.is_symlink():
            stop('Unexpected source helper symlink')
        oldhelper=HELPER.read_bytes() if HELPER.exists() else None
        oldbudget=BUDGET.read_bytes() if BUDGET.exists() else None
        if oldbudget is not None and blob(oldbudget)!=BUDGET_BLOB:
            stop('Unexpected existing refresh-budget helper; no changes')
        with tempfile.TemporaryDirectory(prefix='odds-merge-') as tmp:
            a,b,c=[P(tmp)/x for x in ('local','base','reviewed')]
            for p,d in ((a,original),(b,old),(c,incoming)): p.write_bytes(d)
            merged=proc('git','merge-file','-p',str(a),str(b),str(c),timeout=45)
            if merged.returncode: stop('Local modifications conflict with tested update; no changes')
            candidate=merged.stdout.encode()
        for mark in (b'prematchRefreshCadence(',b'duePrematchRefreshes(',
                     b'const normalSyncPending = pending.filter((row) => Boolean(row.provider_id))',
                     b'sourceOddsMaxAgeSeconds(market.isLive)'):
            if mark not in candidate: stop('Safety/freshness guard missing from merge')
        backup=P('/home/novaadmin')/('odds-backup-'+str(int(time.time())))
        backup.mkdir(mode=0o700)
        (backup/'odds.worker.ts').write_bytes(original)
        if oldhelper is not None: (backup/'prematch-refresh-cadence.ts').write_bytes(oldhelper)
        if oldbudget is not None: (backup/'odds-refresh-budget.ts').write_bytes(oldbudget)
        backup.chmod(0o700)
        print('Verified source, rollback backup:',backup,flush=True)
        s_stat=SOURCE.stat()
        h_stat=HELPER.stat() if HELPER.exists() else s_stat
        b_stat=BUDGET.stat() if BUDGET.exists() else s_stat
        modified=False
        restarted=False
        try:
            modified=True
            atomic(SOURCE,candidate,s_stat)
            atomic(HELPER,helper,h_stat)
            if oldbudget is None: atomic(BUDGET,budget,b_stat)
            check=proc('/usr/sbin/runuser','-u','novaadmin','--',
                       str(RELEASE/'node_modules/.bin/tsc'),'--noEmit','--pretty','false',
                       '--incremental','false',timeout=180,cwd=RELEASE)
            if check.returncode:
                print('TYPECHECK_ERRORS:', '\n'.join((check.stdout+check.stderr).splitlines()[:7])[:800],flush=True)
                stop('Typecheck failed before restart')
            print('TypeScript check passed; restarting bulk odds only',flush=True)
            restarted=True
            pm('restart','betvima-odds-worker')
            time.sleep(16)
            after=apps()
            fresh=app(after,'betvima-odds-worker')
            nextlive=app(after,'betvima-live-odds-worker')
            nextfinancial=app(after,'betvima-settlement-worker')
            if fresh.get('pid')==bulk.get('pid') or not fresh.get('pid'):
                stop('Bulk worker did not restart')
            if nextlive.get('pid')!=live.get('pid') or nextfinancial.get('pid')!=financial.get('pid'):
                stop('A separate worker unexpectedly changed')
            print('DEPLOYED: '+REV,flush=True)
            print('BULK_WORKER_ONLINE pid='+str(fresh.get('pid')),flush=True)
            print('LIVE_AND_SETTLEMENT_WORKERS_UNCHANGED',flush=True)
            print('BACKUP_AT '+str(backup),flush=True)
        except Exception:
            if modified:
                atomic(SOURCE,original,s_stat)
                if oldhelper is None: HELPER.unlink(missing_ok=True)
                else: atomic(HELPER,oldhelper,h_stat)
                if oldbudget is None: BUDGET.unlink(missing_ok=True)
                else: atomic(BUDGET,oldbudget,b_stat)
                print('SOURCE_ROLLBACK_COMPLETE',flush=True)
            if restarted:
                try: pm('restart','betvima-odds-worker'); print('OLD_WORKER_RESTARTED',flush=True)
                except Exception: print('URGENT: verify bulk PM2 status manually',flush=True)
            raise

if __name__=='__main__':
    try: run()
    except Exception as error:
        print(str(error),flush=True)
        sys.exit(1)
