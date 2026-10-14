"""Installed web-only deployer; called only after owner-approved GitHub OIDC.

No migrations or workers. Candidate build is isolated; unhealthy switches roll back.
"""
import base64, hashlib, importlib.util, json, os, pathlib, pwd, re, shutil, socket, subprocess, sys, time, types, urllib.parse, urllib.request, urllib.error
LIB=pathlib.Path('/usr/local/lib/betvima-continuous')
spec=importlib.util.spec_from_file_location('trusted_controller',LIB/'controller.py');c=importlib.util.module_from_spec(spec);spec.loader.exec_module(c)
ROUTE=pathlib.Path('/etc/nginx/sites-enabled/betvima.com')
STATIC=pathlib.Path('/etc/nginx/snippets/betvima-static-compat.conf')
PRODUCTION_STAGES = frozenset((
    'preflight','recover_previous','extract_source','migration_registry',
    'backup','registry_check','dependencies','unit_tests','typecheck',
    'lint','build','asset_security','copy_release','start_candidate',
    'candidate_health','switch_route','public_health','persist','complete'
))
SAFE_FAILURE_CODES = frozenset((
    'previous_attempt_requires_inspection',
    'migration_change_requires_separate_approval',
    'approved_0195_required','runtime_configuration_incomplete',
    'command_failed_output_suppressed','health_failed','not_ready',
    'financial_auth_guard_failed','identity_failed','release_already_exists',
    'invalid_invocation','active_web_not_identified','existing_pm2_required',
    'previous_release_still_owned','candidate_release_still_running',
    'private_value_in_browser_assets','verified_migration_registry_required',
    'backup_session_pooler_required','backup_session_policy_not_verified',
))
CURRENT_STAGE = 'preflight'
CURRENT_REVISION = None

def progress(stage, state='running', failure=None):
    """Root-private, fixed-vocabulary progress; never include credentials/logs."""
    global CURRENT_STAGE
    if stage not in PRODUCTION_STAGES: raise ValueError('invalid_progress_stage')
    CURRENT_STAGE = stage
    content = {'stage':stage, 'state':state, 'revision':CURRENT_REVISION, 'at':int(time.time())}
    if failure is not None:
        code = str(failure)
        content['reason'] = code if code in SAFE_FAILURE_CODES else 'details_suppressed'
    c.atomic(c.STATE/'production-progress.json', json.dumps(content).encode(), 0o600)

def quarantine_failed(directory, root, apps, *, removable_stopped_process=None):
    """Preserve failed attempts rather than blocking the next owner-approved run."""
    if not directory.exists(): return False
    if directory.is_symlink() or not directory.is_dir() or directory.parent != root:
        raise ValueError('previous_attempt_requires_inspection')
    for app in apps:
        e = app.get('pm2_env',{})
        if e.get('pm_cwd') != str(directory): continue
        if (removable_stopped_process is not None
                and app.get('name') == removable_stopped_process
                and e.get('status') != 'online'):
            continue
        raise ValueError('candidate_release_still_running')
    archive = root.parent/('failed-'+root.name)
    archive.mkdir(mode=0o700,exist_ok=True)
    archive.chmod(0o700)
    target = archive/(directory.name+'-'+str(time.time_ns()))
    directory.rename(target)
    return True

def verify_applied_migrations(candidate, active, values):
    """Read-only registry approval for ADDED migration files only.

    SQL files are never executed by this web deployer. Every added migration
    must already be registered non-baseline with its exact SHA-256.
    Changed or deleted previously approved SQL remains a hard blocker.
    """
    before, after = files_digest(active), files_digest(candidate)
    if before == after: return
    if any(after.get(name)!=sha for name,sha in before.items()):
        raise ValueError('migration_change_requires_separate_approval')
    # 0161a is a historical, already-applied compatibility migration. Keep
    # four-digit naming for new files, with this one explicit legacy exception;
    # every added file still needs an exact SHA-256, non-baseline registry match.
    added = {name:sha for name,sha in after.items() if name not in before}
    if not added or len(added)>12 or not all(re.fullmatch(r'(?:[0-9]{4}_[a-z0-9_]+|0161a_fresh_db_numeric_sequence)\.sql',name) for name in added):
        raise ValueError('migration_change_requires_separate_approval')
    quoted = ','.join("'"+name+"'" for name in sorted(added))
    sql = ("BEGIN READ ONLY; SELECT filename,checksum,baseline "
           "FROM nova.migrations WHERE filename IN ("+quoted+"); ROLLBACK;")
    output = c.run(['/usr/bin/psql','-X','--no-password','-qAt',
                    '-v','ON_ERROR_STOP=1'],input=sql.encode(),env=connection(values))
    verified = {}
    for row in output.decode().splitlines():
        pieces = row.split('|')
        if len(pieces)!=3: raise ValueError('verified_migration_registry_required')
        filename,digest,baseline = pieces
        if baseline!='f' or filename in verified: raise ValueError('verified_migration_registry_required')
        verified[filename] = digest
    if verified!=added: raise ValueError('verified_migration_registry_required')


def pm2(args,env=None):
    account=pwd.getpwnam('novaadmin')
    def demote():os.setgroups([]);os.setgid(account.pw_gid);os.setuid(account.pw_uid);os.umask(0o077)
    values={'PATH':'/usr/bin:/bin','HOME':'/home/novaadmin','PM2_HOME':'/home/novaadmin/.pm2',**(env or {})}
    if not pathlib.Path('/home/novaadmin/.pm2/rpc.sock').is_socket():raise ValueError('existing_pm2_required')
    return c.run(['/usr/bin/node','/usr/lib/node_modules/pm2/bin/pm2']+args,preexec_fn=demote,env=values)

def registry_helpers():
    wrapper=pathlib.Path('/usr/local/sbin/betvima-stage-prepare').read_text()
    code=wrapper.split("<<'PREP_PY'\n",1)[1].rsplit('\nPREP_PY',1)[0]
    match=re.search(r"base64.b64decode\('([A-Za-z0-9+/=]+)'\)",code)
    audit=types.ModuleType('fixed_audit');exec(compile(base64.b64decode(match[1]),'<fixed-audit>','exec'),audit.__dict__)
    return audit

def connection(values):
    u=urllib.parse.urlsplit(values.get('SUPABASE_DB_URL') or values['DATABASE_URL'])
    q=[(k,v) for k,v in urllib.parse.parse_qsl(u.query) if k not in ('pgbouncer','connection_limit','pool_timeout')]
    env=registry_helpers().db_connection(urllib.parse.urlunsplit(u._replace(query=urllib.parse.urlencode(q))))
    if not env:raise ValueError('validated_database_connection_required')
    env.update(PGSSLMODE='verify-full',PGSSLROOTCERT='/root/betvima-public-ca.crt',PGOPTIONS='-c default_transaction_read_only=on -c statement_timeout=0 -c lock_timeout=3000')
    return env

def backup_connection(values):
    """Use Supabase's *session* pooler, never the short-lived transaction port.

    The normal web app stays on 6543. A whole-database COPY may exceed the
    transaction pooler's per-statement lifetime, which produced incomplete
    dumps and a Postgres 57014 error during two production deployments.
    Preserve the verified database identity, user, SSL and credentials; only
    switch to the already-available port 5432 for this one backup process.
    """
    raw=values.get('SUPABASE_DB_URL') or values.get('DATABASE_URL')
    if not raw:raise ValueError('backup_session_pooler_required')
    parsed=urllib.parse.urlsplit(raw)
    host=(parsed.hostname or '').lower()
    if (parsed.scheme not in ('postgres','postgresql')
            or not host.endswith('.pooler.supabase.com')
            or parsed.port!=6543
            or not (parsed.username or '').startswith('postgres.')):
        raise ValueError('backup_session_pooler_required')
    env=connection(values)
    if (str(env.get('PGHOST','')).lower()!=host
            or str(env.get('PGPORT',''))!='6543'
            or env.get('PGSSLMODE')!='verify-full'
            or not env.get('PGSSLROOTCERT')
            or 'statement_timeout=0' not in env.get('PGOPTIONS','')):
        raise ValueError('backup_session_pooler_required')
    env['PGPORT']='5432'
    env['PGAPPNAME']='betvima_pre_release_verified_backup'
    return env

def backup(values):
    parent=pathlib.Path('/root/betvima-backups')
    for report in sorted(parent.glob('*/verification.json'),reverse=True):
        try:
            data=json.loads(report.read_text());dump=report.parent/'database.dump'
            if data.get('full_database_backup')=='complete_archive_stream_verified' and time.time()-dump.stat().st_mtime<86400 and dump.stat().st_size==data.get('size_bytes'):
                h=hashlib.file_digest(dump.open('rb'),'sha256').hexdigest()
                if h==data.get('sha256'):return report.parent
        except Exception:pass
    path=parent/('auto-pre-release-'+time.strftime('%Y%m%dT%H%M%SZ',time.gmtime()));path.mkdir(mode=0o700)
    partial=path/'database.dump.partial';env=backup_connection(values)
    # Supavisor may ignore libpq PGOPTIONS startup parameters: newly opened
    # sessions have the database defaults (e.g. '2min|off|off'). Session mode
    # supports SET and keeps these settings *only in this connection*.
    # Probe with explicit, separate session statements, never ALTER DATABASE
    # or ALTER ROLE. pg_dump 17 independently starts its own connection and
    # issues SET statement_timeout = 0 before its first COPY.
    sql=("SET statement_timeout TO 0;\n"
         "SET default_transaction_read_only TO on;\n"
         "BEGIN READ ONLY;\n"
         "SELECT current_setting('statement_timeout'),"
         "current_setting('default_transaction_read_only'),"
         "current_setting('transaction_read_only');\n"
         "ROLLBACK;\n")
    state=c.run(['/usr/bin/psql','-X','--no-password','-qAt',
                 '-v','ON_ERROR_STOP=1'],input=sql.encode(),env=env,timeout=30).strip()
    if state!=b'0|on|on':raise ValueError('backup_session_policy_not_verified')
    c.run(['/usr/bin/pg_dump','--no-password','--format=custom','--compress=1','--no-owner','--no-privileges','--file='+str(partial)],env=env,timeout=3600)
    c.run(['/usr/bin/pg_restore','--file=/dev/null',str(partial)],timeout=1200)
    dump=path/'database.dump';partial.rename(dump)
    report={'full_database_backup':'complete_archive_stream_verified','size_bytes':dump.stat().st_size,'sha256':hashlib.file_digest(dump.open('rb'),'sha256').hexdigest()}
    c.atomic(path/'verification.json',json.dumps(report).encode());return path

def files_digest(directory):
    return {str(p.relative_to(directory)):hashlib.sha256(p.read_bytes()).hexdigest() for p in directory.rglob('*.sql')}

def health(base,build):
    for path in ('/','/live','/sports/football','/auth/login','/wallet','/api/health/ready','/api/v1/matches?pageSize=1'):
        req=urllib.request.Request(base+path,headers={'Host':'betvima.com','Cache-Control':'no-cache','Connection':'close'})
        with urllib.request.urlopen(req,timeout=25) as response:
            body=response.read(5*1024*1024)
            if response.status!=200:raise ValueError('health_failed')
            if path=='/' and build.encode() not in body:raise ValueError('identity_failed')
            if path=='/api/health/ready' and json.loads(body).get('ready') is not True:raise ValueError('not_ready')
    for path in ('/api/v1/wallet','/api/v1/bets'):
        try:urllib.request.urlopen(urllib.request.Request(base+path,headers={'Host':'betvima.com'}),timeout=15)
        except urllib.error.HTTPError as error:
            if error.code==401:continue
        raise ValueError('financial_auth_guard_failed')

def wait_health(base,build):
    for attempt in range(15):
        try:health(base,build);return
        except Exception:time.sleep(2)
    raise ValueError('health_failed')

def main(sha):
    global CURRENT_REVISION
    CURRENT_REVISION = sha
    os.umask(0o077)
    if os.geteuid()!=0 or not re.fullmatch('[0-9a-f]{40}',sha):raise ValueError('invalid_invocation')
    progress('preflight')
    route=ROUTE.read_text();snippet=STATIC.read_text()
    current=set(re.findall(r'proxy_pass http://127\.0\.0\.1:(\d+);',route))
    if len(current)!=1:raise ValueError('ambiguous_current_upstream')
    oldport=int(next(iter(current)))
    apps=json.loads(pm2(['jlist']))
    # Financial workers may inherit PORT from the web environment; identify
    # the actual routed web process by its unique process name, never by port alone.
    websites=[a for a in apps
              if a.get('name','').startswith('nova-cd-')
              and a.get('pm2_env',{}).get('status')=='online'
              and int(a.get('pm2_env',{}).get('PORT',0) or 0)==oldport]
    if len(websites)!=1:raise ValueError('active_web_not_identified')
    old=websites[0]
    olddir=pathlib.Path(old['pm2_env']['pm_cwd'])
    if olddir.parent!=pathlib.Path('/opt/nova-releases'):raise ValueError('unexpected_active_release')
    values={k:str(v) for k,v in old['pm2_env'].items() if re.fullmatch('[A-Z][A-Z0-9_]*',k) and isinstance(v,(str,int))}
    for k in tuple(values):
        if k in ('NODE_OPTIONS','LD_PRELOAD','LD_LIBRARY_PATH','BASH_ENV','ENV','NODE_TLS_REJECT_UNAUTHORIZED') or k.startswith(('DYLD_','LD_')):values.pop(k)
    values.update(NODE_ENV='production',APP_ENV='production',NODE_EXTRA_CA_CERTS='/etc/betvima/certs/supabase-root-2021.crt',NEXT_TELEMETRY_DISABLED='1')
    if not all(values.get(k) for k in ('SUPABASE_DB_URL','NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY')):raise ValueError('runtime_configuration_incomplete')
    progress('recover_previous')
    directory=c.ROOT/'releases'/('production-'+sha)
    # Every new GitHub run still needs the owner's OIDC approval. Only failed
    # artifacts for that exact revision are archived, never deleted or reused.
    quarantine_failed(directory,c.ROOT/'releases',apps)
    progress('extract_source')
    directory.mkdir(mode=0o755);directory.chmod(0o755)
    c.unpack((c.STATE/'production-source.tar').read_bytes(),directory)
    progress('migration_registry')
    verify_applied_migrations(directory/'supabase/migrations',
                              olddir/'supabase/migrations',values)
    progress('backup')
    backupdir=backup(values)
    progress('registry_check')
    # Registry check is SELECT only; no migration runner is invoked.
    sql="BEGIN READ ONLY; SELECT EXISTS(SELECT 1 FROM nova.migrations WHERE filename='0195_live_betting_missing_switch_fails_closed.sql' AND checksum='55ec6c22d1a09b84423ec1c290212d9bc717ce2d9a96edac47a0a678164fd4b7' AND NOT baseline); ROLLBACK;"
    if c.run(['/usr/bin/psql','-X','--no-password','-qAt','-v','ON_ERROR_STOP=1'],input=sql.encode(),env=connection(values)).strip()!=b't':raise ValueError('approved_0195_required')
    progress('dependencies')
    (directory/'node_modules').symlink_to(c.ensure_dependencies(directory),target_is_directory=True)
    account=pwd.getpwnam('betvima_build')
    for folder,dirs,files in os.walk(directory,followlinks=False):
        os.chown(folder,account.pw_uid,account.pw_gid)
        for name in files:os.chown(pathlib.Path(folder)/name,account.pw_uid,account.pw_gid,follow_symlinks=False)
    for label,args in (
        ('unit_tests',['/usr/bin/node','node_modules/vitest/vitest.mjs','run','tests/unit','--no-cache']),
        ('typecheck',['/usr/bin/node','node_modules/typescript/bin/tsc','--noEmit']),
        ('lint',['/usr/bin/node','node_modules/next/dist/bin/next','lint'])
    ):
        progress(label)
        c.sandbox(directory,args,c.PREVIEW_ENV)
    progress('build')
    c.sandbox(directory,['/usr/bin/node','node_modules/next/dist/bin/next','build'],values)
    progress('asset_security')
    private=[v.encode() for k,v in values.items() if not k.startswith('NEXT_PUBLIC_') and len(v)>20 and any(w in k for w in ('KEY','TOKEN','PASSWORD','SECRET','DATABASE_URL','DB_URL'))]
    for file in (directory/'.next/static').rglob('*'):
        if file.is_file() and any(secret in file.read_bytes() for secret in private):raise ValueError('private_value_in_browser_assets')
    progress('copy_release')
    release=pathlib.Path('/opt/nova-releases')/sha
    if release.exists():
        if release==olddir: raise ValueError('previous_release_still_owned')
        current_apps=json.loads(pm2(['jlist']))
        by_cwd=[a for a in current_apps if a.get('pm2_env',{}).get('pm_cwd')==str(release)]
        if any(a.get('name')!='nova-cd-'+sha[:12] or a.get('pm2_env',{}).get('status')=='online' for a in by_cwd):
            raise ValueError('candidate_release_still_running')
        # Only a STOPPED web candidate from this exact revision may be removed.
        if by_cwd: pm2(['delete','nova-cd-'+sha[:12]])
        quarantine_failed(release,release.parent,[],removable_stopped_process=None)
    shutil.copytree(directory,release,symlinks=False)
    for apk in (olddir/'public/downloads').glob('*.apk'):
        target=release/'public/downloads'/apk.name;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(apk,target)
    owner=pwd.getpwnam('novaadmin')
    for folder,dirs,files in os.walk(release):
        os.chown(folder,owner.pw_uid,owner.pw_gid)
        for name in files:os.chown(pathlib.Path(folder)/name,owner.pw_uid,owner.pw_gid)
    port=None
    for number in range(3002,3020):
        with socket.socket() as listener:
            try:listener.bind(('127.0.0.1',number));port=number;break
            except OSError:pass
    if port is None:raise ValueError('no_candidate_port')
    values.update(PORT=str(port),HOSTNAME='127.0.0.1',PATH='/usr/bin:/bin',HOME='/home/novaadmin',PM2_HOME='/home/novaadmin/.pm2')
    name='nova-cd-'+sha[:12];build=(release/'.next/BUILD_ID').read_text().strip();oldbuild=(olddir/'.next/BUILD_ID').read_text().strip()
    state=pathlib.Path('/root/betvima-backups')/('auto-web-'+time.strftime('%Y%m%dT%H%M%SZ',time.gmtime()));state.mkdir(mode=0o700)
    c.atomic(state/'nginx.before.conf',route.encode());c.atomic(state/'static.before.conf',snippet.encode());c.atomic(state/'pm2.before.json',json.dumps(apps).encode())
    switched=False
    try:
        progress('start_candidate')
        pm2(['start',str(release/'node_modules/next/dist/bin/next'),'--name',name,'--cwd',str(release),'--interpreter','/usr/bin/node','--','start','--hostname','127.0.0.1','-p',str(port)],values)
        progress('candidate_health')
        wait_health('http://127.0.0.1:'+str(port),build)
        progress('switch_route')
        changed=route.replace('proxy_pass http://127.0.0.1:'+str(oldport)+';','proxy_pass http://127.0.0.1:'+str(port)+';')
        # Preserve previous-version immutable assets and the original APK aliases.
        first=True
        def ports(match):
            nonlocal first
            value=port if first else oldport;first=False;return 'proxy_pass http://127.0.0.1:'+str(value)+';'
        updated=re.sub(r'proxy_pass http://127\.0\.0\.1:\d+;',ports,snippet)
        if first:raise ValueError('static_fallback_missing')
        c.atomic(ROUTE,changed.encode(),0o644);c.atomic(STATIC,updated.encode(),0o644)
        c.run(['/usr/sbin/nginx','-t']);c.run(['systemctl','reload','nginx']);switched=True
        progress('public_health')
        wait_health('https://betvima.com',build)
        progress('persist')
        pm2(['save'])
        c.atomic(c.STATE/'production-status.json',json.dumps({'revision':sha,'build':build,'state':'healthy','rollback_directory':str(state),'backup_directory':str(backupdir),'workers_changed':False,'migration_run':False}).encode(),0o644)
        progress('complete','verified')
    except Exception:
        c.atomic(ROUTE,route.encode(),0o644);c.atomic(STATIC,snippet.encode(),0o644)
        c.run(['/usr/sbin/nginx','-t']);c.run(['systemctl','reload','nginx']);wait_health('https://betvima.com',oldbuild)
        try:pm2(['stop',name]);pm2(['save'])
        except Exception:pass
        raise

if __name__=='__main__':
    try:main(sys.argv[1])
    except Exception as error:
        # The reason is allowlisted; untrusted exception strings and financial
        # logs remain root-private and never enter GitHub Actions output.
        try:progress(CURRENT_STAGE,'failed',error)
        except Exception:pass
        print('production_deploy_blocked_or_rolled_back_details_suppressed')
        sys.exit(1)
