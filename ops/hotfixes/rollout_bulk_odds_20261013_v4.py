#!/usr/bin/env python3
"""BetVima guarded surgical bulk-odds hotpatch: keep server-local implementations."""
import fcntl,hashlib,json,os,pathlib,stat,subprocess,sys,tempfile,time,urllib.request
P=pathlib.Path
RELEASE=P('/opt/nova-releases/24dab3702c58a5baa4b5f18ccc1eee15b2c6fdac')
SOURCE=RELEASE/'src/workers/odds.worker.ts'
HELPER=RELEASE/'src/workers/prematch-refresh-cadence.ts'
REV='3af3f7e5f07cce22045e73a7c30bdfa4ec7b2bc7'
SOURCE_EXPECTED='506aa07416d8dfbf46016cbdc29bd6088e8eef25'
HELPER_EXPECTED='ec4bc6ed176000b9630d4955529aebe2df373b30'
def abort(msg):raise RuntimeError('SAFETY_STOP: '+msg)
def blob(data):return hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()
def get_helper():
    url='https://raw.githubusercontent.com/uonesmj/Betvima/'+REV+'/src/workers/prematch-refresh-cadence.ts'
    with urllib.request.urlopen(url,timeout=40) as resp:data=resp.read(100001)
    if len(data)>100000 or blob(data)!=HELPER_EXPECTED:abort('GitHub cadence helper verification failed')
    return data
def pm(*args):
    r=subprocess.run(['/usr/sbin/runuser','-u','novaadmin','--','/usr/bin/env',
                      'PM2_HOME=/home/novaadmin/.pm2','/usr/bin/pm2',*args],
                      timeout=90,text=True,capture_output=True)
    if r.returncode:abort('PM2 '+args[0]+' failed: '+str(r.returncode))
    return r.stdout
def app(items,name):
    matches=[x for x in items if x.get('name')==name]
    if len(matches)!=1 or matches[0].get('pm2_env',{}).get('status')!='online':
        abort('Expected healthy PM2 service: '+name)
    return matches[0]
def apps():return json.loads(pm('jlist'))
def atomic(target,data,reference):
    if target.is_symlink():abort('Symlink target refused: '+str(target))
    fd,tmp=tempfile.mkstemp(prefix='.odds-patch-',dir=target.parent)
    try:
        with os.fdopen(fd,'wb') as out:
            out.write(data);out.flush();os.fsync(out.fileno())
        os.chown(tmp,reference.st_uid,reference.st_gid)
        os.chmod(tmp,stat.S_IMODE(reference.st_mode))
        os.replace(tmp,target)
    finally:
        if os.path.exists(tmp):os.unlink(tmp)
def patch_candidate(original):
    candidate=original.decode('utf-8')
    for patch in PATCHES:
        if patch['label']=='extendedUses':
            a=candidate.find('        const extendedPending =')
            b=candidate.find('        console.log("ODDS_PREMATCH_FETCH_START"',a)
            if a<0 or b<=a:abort('Extended provider section not found')
            section=candidate[a:b]
            if section.count('EXTENDED_ODDS_MAX_MATCHES_PER_CYCLE')!=3:
                abort('Extended quota budget changed')
            candidate=candidate[:a]+section.replace('EXTENDED_ODDS_MAX_MATCHES_PER_CYCLE','cadence.extendedLimit')+candidate[b:]
        else:
            if candidate.count(patch['a'])!=1:
                abort('Server source drift in patch '+patch['label']+' ('+str(candidate.count(patch['a']))+')')
            candidate=candidate.replace(patch['a'],patch['b'],1)
    required=('prematchRefreshCadence(sourceProvider.name','duePrematchRefreshes(now',
              'cadence.nearLimit','cadence.midLimit','cadence.farLimit',
              'cadence.extendedLimit','maxAgeSeconds: market.isLive ? 45 : 300',
              'const normalSyncPending = pending.filter((row) => Boolean(row.provider_id))')
    if not all(marker in candidate for marker in required):abort('Expected bookmaker safeguards missing')
    if 'ODDS_NORMAL_SYNC_SKIPPED_EXTENDED' in candidate:abort('Stale extended bypass remained')
    if 'resolveTeamLogo' not in candidate:abort('Server-local logo logic was changed')
    return candidate.encode('utf-8')
def main():
    if os.geteuid()!=0:abort('Root required')
    with open('/run/lock/betvima-bulk-odds-patch.lock','a+b') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        if not SOURCE.is_file():
            abort('Active bulk-worker release source missing')
        # Production copytree dereferences npm .bin symlinks. The installed
        # node_modules/.bin/tsc may exist but resolve ../lib/tsc.js against
        # .bin rather than the real TypeScript package. Call the package's
        # actual compiler by absolute path instead.
        compiler=None
        for path in (
            RELEASE/'node_modules/typescript/bin/tsc',
            P('/opt/nova-releases/9edeed66434e1ffcc62d15856b88eeb536d1721c/node_modules/typescript/bin/tsc'),
            P('/opt/nova-releases/0dcade1f3299935e6eaff732484538df62ddf5fa/node_modules/typescript/bin/tsc'),
        ):
            if not path.is_file():
                continue
            preflight=subprocess.run(
                ['/usr/sbin/runuser','-u','novaadmin','--','/usr/bin/node',str(path),'--version'],
                cwd=str(RELEASE),timeout=25,capture_output=True,text=True)
            if preflight.returncode==0 and preflight.stdout.strip().startswith('Version '):
                compiler=path
                print('COMPILER_PREFLIGHT_OK: '+str(path)+' '+preflight.stdout.strip(),flush=True)
                break
        if compiler is None:
            abort('No working TypeScript compiler found; unchanged')
        before=apps()
        bulk=app(before,'betvima-odds-worker')
        live=app(before,'betvima-live-odds-worker')
        settlement=app(before,'betvima-settlement-worker')
        if bulk['pm2_env']['pm_cwd']!=str(RELEASE) or settlement['pm2_env']['pm_cwd']!=str(RELEASE):
            abort('Bulk/settlement release ownership changed')
        if bulk['pm2_env'].get('pm_exec_path')!=str(RELEASE/'src/workers/entrypoints/odds.worker.ts'):
            abort('Odds entrypoint identity changed')
        if live['pm2_env'].get('pm_cwd')==str(RELEASE):
            abort('Live shares bulk source unexpectedly')
        original=SOURCE.read_bytes()
        if blob(original)!=SOURCE_EXPECTED:abort('Bulk worker revision differs from verified source; no changes')
        if HELPER.is_symlink() or (HELPER.exists() and blob(HELPER.read_bytes())!=HELPER_EXPECTED):
            abort('Unexpected existing helper content')
        helper_data=get_helper()
        candidate=patch_candidate(original)
        source_stat=SOURCE.stat()
        helper_stat=HELPER.stat() if HELPER.exists() else source_stat
        old_helper=HELPER.read_bytes() if HELPER.exists() else None
        backup=P('/home/novaadmin')/('odds-surgical-backup-'+str(int(time.time())))
        backup.mkdir(mode=0o700)
        (backup/'odds.worker.ts').write_bytes(original)
        if old_helper is not None:(backup/'prematch-refresh-cadence.ts').write_bytes(old_helper)
        os.chmod(backup,0o700)
        print('Preflight passed. Backup:',backup,flush=True)
        modified=False;restarted=False
        try:
            modified=True
            atomic(SOURCE,candidate,source_stat)
            atomic(HELPER,helper_data,helper_stat)
            check=subprocess.run(['/usr/sbin/runuser','-u','novaadmin','--',
                                  '/usr/bin/node',str(compiler),'--noEmit','--pretty','false','--incremental','false'],
                                  cwd=str(RELEASE),timeout=180,capture_output=True,text=True)
            if check.returncode:
                print('TYPECHECK_ERRORS:', '\n'.join((check.stdout+check.stderr).splitlines()[:12])[:1600],flush=True)
                abort('TypeScript check failed, full source restored')
            print('TYPECHECK_PASS',flush=True)
            restarted=True
            pm('restart','betvima-odds-worker')
            time.sleep(16)
            after=apps()
            newbulk=app(after,'betvima-odds-worker')
            newlive=app(after,'betvima-live-odds-worker')
            newsettle=app(after,'betvima-settlement-worker')
            if newbulk.get('pid')==bulk.get('pid') or not newbulk.get('pid'):
                abort('Odds worker did not restart correctly')
            if newlive.get('pid')!=live.get('pid') or newsettle.get('pid')!=settlement.get('pid'):
                abort('Unrelated process changed')
            print('BETVIMA_BULK_ODDS_DEPLOYED: surgical cadence from '+REV,flush=True)
            print('ODDS_WORKER_ONLINE: pid='+str(newbulk.get('pid')),flush=True)
            print('LIVE_AND_SETTLEMENT_UNCHANGED',flush=True)
        except Exception:
            if modified:
                atomic(SOURCE,original,source_stat)
                if old_helper is None:HELPER.unlink(missing_ok=True)
                else:atomic(HELPER,old_helper,helper_stat)
                print('SOURCE_ROLLBACK_DONE',flush=True)
            if restarted:
                try:pm('restart','betvima-odds-worker');print('OLD_ODDS_WORKER_RESTARTED',flush=True)
                except Exception:print('MANUAL_CHECK_REQUIRED: bulk odds PM2 restart',flush=True)
            raise
PATCHES = [{"label":"imports","a":"import { pgArray } from '@/server/db/rows';","b":"import { pgArray } from '@/server/db/rows';\nimport { duePrematchRefreshes, prematchRefreshCadence, type PrematchRefreshClock } from './prematch-refresh-cadence';"},{"label":"nearState","a":"let lastPrematchNearOddsAt = 0;\nlet lastPrematchMidOddsAt = 0;\nlet lastPrematchFarOddsAt = 0;\n","b":"const lastPrematchByProvider = new Map<string, PrematchRefreshClock>();\n"},{"label":"extendedState","a":"let lastExtendedPrematchNearOddsAt = 0;\nlet lastExtendedPrematchFarOddsAt = 0;\n","b":""},{"label":"nearConst","a":"const PREMATCH_NEAR_ODDS_INTERVAL_MS = process.env.SPORTS_PROVIDER === \"5dollarfootballapi\" ? 60_000 : 30_000;\nconst PREMATCH_MID_ODDS_INTERVAL_MS = process.env.SPORTS_PROVIDER === \"5dollarfootballapi\" ? 5 * 60_000 : 60_000;\nconst PREMATCH_FAR_ODDS_INTERVAL_MS = process.env.SPORTS_PROVIDER === \"5dollarfootballapi\" ? 15 * 60_000 : 5 * 60_000;\n","b":""},{"label":"extendedConst","a":"const EXTENDED_PREMATCH_NEAR_ODDS_INTERVAL_MS = process.env.SPORTS_PROVIDER === \"5dollarfootballapi\" ? 10 * 60_000 : 60_000;\nconst EXTENDED_PREMATCH_FAR_ODDS_INTERVAL_MS = process.env.SPORTS_PROVIDER === \"5dollarfootballapi\" ? 15 * 60_000 : 5 * 60_000;\nconst EXTENDED_ODDS_MAX_MATCHES_PER_CYCLE = Math.max(\n  1,\n  Number(process.env.ODDS_API_EXTENDED_MAX_MATCHES_PER_CYCLE || 500),\n);\n","b":"const EXTENDED_ODDS_MAX_MATCHES_PER_CYCLE = Math.min(80, Math.max(1, Number(process.env.ODDS_API_EXTENDED_MAX_MATCHES_PER_CYCLE || 40)));\n"},{"label":"nearOut","a":"        const includeExtendedPrematchNear =\n          now - lastExtendedPrematchNearOddsAt >= EXTENDED_PREMATCH_NEAR_ODDS_INTERVAL_MS;\n        const includeExtendedPrematchFar =\n          now - lastExtendedPrematchFarOddsAt >= EXTENDED_PREMATCH_FAR_ODDS_INTERVAL_MS;\n\n        if (includeLive) lastLiveOddsAt = now;\n        if (includeExtendedLive) lastExtendedLiveOddsAt = now;\n        if (includeExtendedPrematchNear) lastExtendedPrematchNearOddsAt = now;\n        if (includeExtendedPrematchFar) lastExtendedPrematchFarOddsAt = now;\n\n        const includePrematchNear = now - lastPrematchNearOddsAt >= PREMATCH_NEAR_ODDS_INTERVAL_MS;\n        const includePrematchMid = now - lastPrematchMidOddsAt >= PREMATCH_MID_ODDS_INTERVAL_MS;\n        const includePrematchFar = now - lastPrematchFarOddsAt >= PREMATCH_FAR_ODDS_INTERVAL_MS;\n\n        if (includePrematchNear) lastPrematchNearOddsAt = now;\n        if (includePrematchMid) lastPrematchMidOddsAt = now;\n        if (includePrematchFar) lastPrematchFarOddsAt = now;\n\n        const includePrematch = includePrematchNear || includePrematchMid || includePrematchFar;\n\n","b":"        if (includeLive) lastLiveOddsAt = now;\n        if (includeExtendedLive) lastExtendedLiveOddsAt = now;\n\n"},{"label":"perProvider","a":"        for (const sourceProvider of configuredPrematchProviders) {\n        const pending = includePrematch","b":"        for (const sourceProvider of configuredPrematchProviders) {\n        const cadence = prematchRefreshCadence(sourceProvider.name, EXTENDED_ODDS_MAX_MATCHES_PER_CYCLE);\n        const last = lastPrematchByProvider.get(sourceProvider.name) ?? { near: 0, mid: 0, far: 0, extendedNear: 0, extendedFar: 0 };\n        const due = duePrematchRefreshes(now, last, cadence);\n        lastPrematchByProvider.set(sourceProvider.name, due.next);\n        const includePrematchNear = due.near;\n        const includePrematchMid = due.mid;\n        const includePrematchFar = due.far;\n        const includeExtendedPrematchNear = due.extendedNear;\n        const includeExtendedPrematchFar = due.extendedFar;\n        const includePrematch = includePrematchNear || includePrematchMid || includePrematchFar;\n        const pending = includePrematch"},{"label":"future","a":"m.status::text = 'scheduled'\n                   and (","b":"m.status::text = 'scheduled'\n                   and m.scheduled_at > now()\n                   and ("},{"label":"rank0","a":"(bucket_order = 0 and $1::boolean and bucket_rank <= 200)","b":"(bucket_order = 0 and $1::boolean and bucket_rank <= $5::int)"},{"label":"rank1","a":"(bucket_order = 1 and $2::boolean and bucket_rank <= 200)","b":"(bucket_order = 1 and $2::boolean and bucket_rank <= $6::int)"},{"label":"rank2","a":"(bucket_order = 2 and $3::boolean and bucket_rank <= 500)","b":"(bucket_order = 2 and $3::boolean and bucket_rank <= $7::int)"},{"label":"nearArgs","a":"              [\n                includePrematchNear,\n                includePrematchMid,\n                includePrematchFar,\n                sourceProvider.name,\n              ]\n","b":"              [\n                includePrematchNear,\n                includePrematchMid,\n                includePrematchFar,\n                sourceProvider.name,\n                cadence.nearLimit,\n                cadence.midLimit,\n                cadence.farLimit,\n              ]\n"},{"label":"extendedQuery","a":"                   and m.scheduled_at > now() + interval '30 minutes'\n                 order by\n                   (","b":"                   and m.scheduled_at > now()\n                   and (($3::boolean and m.scheduled_at <= now() + interval '30 minutes') or ($4::boolean and m.scheduled_at > now() + interval '30 minutes'))\n                 order by\n                   case when m.scheduled_at <= now() + interval '30 minutes' then 0 else 1 end,\n                   ("},{"label":"extendedArgs","a":"                [\n                  EXTENDED_ODDS_MAX_MATCHES_PER_CYCLE,\n                  sourceProvider.name,\n                ],\n","b":"                [\n                  cadence.extendedLimit,\n                  sourceProvider.name,\n                  includeExtendedPrematchNear,\n                  includeExtendedPrematchFar,\n                ],\n"},{"label":"extendedUses","a":"","b":""},{"label":"removeEarly","a":"        if (extendedProviderIds.length > 0) {\n          void runExtendedPrematchOddsDetached(\n            ctx,\n            extendedPending,\n            extendedProviderIds,\n            sourceProvider,\n          );\n        }\n\n","b":""},{"label":"noSkip","a":"        const extendedProviderIdSet = new Set(extendedProviderIds);\n\n        const normalSyncPending = pending.filter((row) => {\n          if (!row.provider_id) return false;\n\n          if (extendedProviderIdSet.has(row.provider_id)) {\n            console.log(\"ODDS_NORMAL_SYNC_SKIPPED_EXTENDED\", JSON.stringify({\n              matchId: row.match_id,\n              providerId: row.provider_id,\n            }));\n            return false;\n          }\n\n          return true;\n        });\n\n","b":"        const normalSyncPending = pending.filter((row) => Boolean(row.provider_id));\n\n"},{"label":"lateExtended","a":"        console.log(\"ODDS_CORE_TICK_DONE\", JSON.stringify({","b":"        if (extendedProviderIds.length > 0) {\n          void runExtendedPrematchOddsDetached(ctx, extendedPending, extendedProviderIds, sourceProvider);\n        }\n        console.log(\"ODDS_CORE_TICK_DONE\", JSON.stringify({"},{"label":"freshSource","a":"              providerTimestamp: new Date(bundle.updatedAt),\n              ingestedAt: new Date(),\n              maxAgeSeconds: 300,","b":"              providerTimestamp: new Date(market.sourceUpdatedAt ?? bundle.updatedAt),\n              ingestedAt: new Date(),\n              maxAgeSeconds: market.isLive ? 45 : 300,"},{"label":"status","a":"              suspend: rejecting ? false : suspending,","b":"              suspend: rejecting ? false : (suspending || quote.status !== 'open'),"}]
if __name__=='__main__':
    try:main()
    except Exception as error:
        print(str(error),flush=True);sys.exit(1)
