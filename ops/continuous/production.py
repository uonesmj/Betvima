"""Installed web-only deployer; called only after owner-approved GitHub OIDC.

No migrations or workers. Candidate build is isolated; unhealthy switches roll back.
"""
import base64, hashlib, importlib.util, json, os, pathlib, pwd, re, shutil, socket, subprocess, sys, time, types, urllib.parse, urllib.request, urllib.error
LIB=pathlib.Path('/usr/local/lib/betvima-continuous')
spec=importlib.util.spec_from_file_location('trusted_controller',LIB/'controller.py');c=importlib.util.module_from_spec(spec);spec.loader.exec_module(c)
ROUTE=pathlib.Path('/etc/nginx/sites-enabled/betvima.com')
STATIC=pathlib.Path('/etc/nginx/snippets/betvima-static-compat.conf')

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
    partial=path/'database.dump.partial';env=connection(values)
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
    os.umask(0o077)
    if os.geteuid()!=0 or not re.fullmatch('[0-9a-f]{40}',sha):raise ValueError('invalid_invocation')
    route=ROUTE.read_text();snippet=STATIC.read_text()
    current=set(re.findall(r'proxy_pass http://127\.0\.0\.1:(\d+);',route))
    if len(current)!=1:raise ValueError('ambiguous_current_upstream')
    oldport=int(next(iter(current)))
    apps=json.loads(pm2(['jlist']))
    old=next((a for a in apps if int(a.get('pm2_env',{}).get('PORT',0) or 0)==oldport and a['pm2_env'].get('status')=='online'),None)
    if not old:raise ValueError('active_web_not_identified')
    olddir=pathlib.Path(old['pm2_env']['pm_cwd'])
    if olddir.parent!=pathlib.Path('/opt/nova-releases'):raise ValueError('unexpected_active_release')
    values={k:str(v) for k,v in old['pm2_env'].items() if re.fullmatch('[A-Z][A-Z0-9_]*',k) and isinstance(v,(str,int))}
    for k in tuple(values):
        if k in ('NODE_OPTIONS','LD_PRELOAD','LD_LIBRARY_PATH','BASH_ENV','ENV','NODE_TLS_REJECT_UNAUTHORIZED') or k.startswith(('DYLD_','LD_')):values.pop(k)
    values.update(NODE_ENV='production',APP_ENV='production',NODE_EXTRA_CA_CERTS='/etc/betvima/certs/supabase-root-2021.crt',NEXT_TELEMETRY_DISABLED='1')
    if not all(values.get(k) for k in ('SUPABASE_DB_URL','NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY')):raise ValueError('runtime_configuration_incomplete')
    directory=c.ROOT/'releases'/('production-'+sha)
    if directory.exists():raise ValueError('previous_attempt_requires_inspection')
    directory.mkdir(mode=0o755);directory.chmod(0o755)
    c.unpack((c.STATE/'production-source.tar').read_bytes(),directory)
    if files_digest(directory/'supabase/migrations')!=files_digest(olddir/'supabase/migrations'):raise ValueError('migration_change_requires_separate_approval')
    backupdir=backup(values)
    # Registry check is SELECT only; no migration runner is invoked.
    sql="BEGIN READ ONLY; SELECT EXISTS(SELECT 1 FROM nova.migrations WHERE filename='0195_live_betting_missing_switch_fails_closed.sql' AND checksum='55ec6c22d1a09b84423ec1c290212d9bc717ce2d9a96edac47a0a678164fd4b7' AND NOT baseline); ROLLBACK;"
    if c.run(['/usr/bin/psql','-X','--no-password','-qAt','-v','ON_ERROR_STOP=1'],input=sql.encode(),env=connection(values)).strip()!=b't':raise ValueError('approved_0195_required')
    (directory/'node_modules').symlink_to(c.ensure_dependencies(directory),target_is_directory=True)
    account=pwd.getpwnam('betvima_build')
    for folder,dirs,files in os.walk(directory,followlinks=False):
        os.chown(folder,account.pw_uid,account.pw_gid)
        for name in files:os.chown(pathlib.Path(folder)/name,account.pw_uid,account.pw_gid,follow_symlinks=False)
    for args in (['/usr/bin/node','node_modules/vitest/vitest.mjs','run','tests/unit','--no-cache'],['/usr/bin/node','node_modules/typescript/bin/tsc','--noEmit'],['/usr/bin/node','node_modules/next/dist/bin/next','lint']):c.sandbox(directory,args,c.PREVIEW_ENV)
    c.sandbox(directory,['/usr/bin/node','node_modules/next/dist/bin/next','build'],values)
    private=[v.encode() for k,v in values.items() if not k.startswith('NEXT_PUBLIC_') and len(v)>20 and any(w in k for w in ('KEY','TOKEN','PASSWORD','SECRET','DATABASE_URL','DB_URL'))]
    for file in (directory/'.next/static').rglob('*'):
        if file.is_file() and any(secret in file.read_bytes() for secret in private):raise ValueError('private_value_in_browser_assets')
    release=pathlib.Path('/opt/nova-releases')/sha
    if release.exists():raise ValueError('release_already_exists')
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
        pm2(['start',str(release/'node_modules/next/dist/bin/next'),'--name',name,'--cwd',str(release),'--interpreter','/usr/bin/node','--','start','--hostname','127.0.0.1','-p',str(port)],values)
        wait_health('http://127.0.0.1:'+str(port),build)
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
        wait_health('https://betvima.com',build)
        pm2(['save'])
        c.atomic(c.STATE/'production-status.json',json.dumps({'revision':sha,'build':build,'state':'healthy','rollback_directory':str(state),'backup_directory':str(backupdir),'workers_changed':False,'migration_run':False}).encode(),0o644)
    except Exception:
        c.atomic(ROUTE,route.encode(),0o644);c.atomic(STATIC,snippet.encode(),0o644)
        c.run(['/usr/sbin/nginx','-t']);c.run(['systemctl','reload','nginx']);wait_health('https://betvima.com',oldbuild)
        try:pm2(['stop',name]);pm2(['save'])
        except Exception:pass
        raise

if __name__=='__main__':
    try:main(sys.argv[1])
    except Exception:print('production_deploy_blocked_or_rolled_back_details_suppressed');sys.exit(1)
