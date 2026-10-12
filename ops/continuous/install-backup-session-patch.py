#!/usr/bin/env python3
"""Install a single reviewed backup-only change to Betvima's root deployer.

This is a one-off, commit-pinned, fail-closed administrator operation. It checks
the Supabase Session Pooler on TCP 5432 before changing production.py.
No full pg_dump is run here; the normal approved production workflow performs
the actual backup+archive verification. No financial worker or website restart.
"""
import ast
import fcntl
import hashlib
import json
import os
import pathlib
import pwd
import re
import subprocess
import sys
import tempfile
import urllib.parse
import urllib.request

REPOSITORY = 'uonesmj/Betvima'
LIB=pathlib.Path('/usr/local/lib/betvima-continuous')
STATE=pathlib.Path('/var/lib/betvima-continuous')
TARGET=LIB/'production.py'
ORIGINAL_BLOB='f5eca460b7ecbf201e24222632cfdda82af9edb0'
REPLACEMENT_BLOB='f799e72833ffa61e4962d49c40f8fadc0c1fe8ec'
WEB_PREFIX='nova-cd-'
DATABASE_KEYS=('SUPABASE_DB_URL','DATABASE_URL')

def stop(reason):
    raise SystemExit('STOP: '+reason)

def blob_sha(data):
    return hashlib.sha1(
        b'blob '+str(len(data)).encode()+bytes((0,))+data
    ).hexdigest()

def run(argv, **kwargs):
    return subprocess.run(argv, capture_output=True, text=True, timeout=kwargs.pop('timeout',35), **kwargs)

def app_env():
    r=run(['/usr/sbin/runuser','-u','novaadmin','--',
           '/usr/bin/env','-u','NODE_CHANNEL_FD','-u','NODE_UNIQUE_ID',
           'PM2_HOME=/home/novaadmin/.pm2','/usr/bin/pm2','jlist'])
    if r.returncode:stop('PM2 unavailable')
    try:apps=json.loads(r.stdout)
    except ValueError:stop('PM2 invalid response')
    web=[a for a in apps if a.get('name','').startswith(WEB_PREFIX) and
         a.get('pm2_env',{}).get('status')=='online']
    if len(web)!=1:stop('Expected exactly one online production website')
    for name in ('betvima-settlement-worker','betvima-odds-worker'):
        if not any(a.get('name')==name and a.get('pm2_env',{}).get('status')=='online' for a in apps):
            stop('Protected worker is not online: '+name)
    return web[0]['pm2_env']

def load_installed_connection():
    # This source is the already installed, root-owned and hash-verified
    # deployer. Compile only its connection and helper functions, never run
    # the root deployment entrypoint.
    import importlib.util
    spec=importlib.util.spec_from_file_location('trusted_installed_deployer',str(TARGET))
    module=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.connection

def download(commit):
    path='ops/continuous/production.py'
    url='https://raw.githubusercontent.com/'+REPOSITORY+'/'+commit+'/'+path
    request=urllib.request.Request(url,headers={'User-Agent':'Betvima-root-backup-session-fix'})
    with urllib.request.urlopen(request,timeout=40) as response:
        content=response.read(256001)
    if len(content)>256000 or blob_sha(content)!=REPLACEMENT_BLOB:
        stop('Pinned updated production.py source does not match GitHub SHA')
    compile(content,'reviewed_production.py','exec')
    return content

def derive_backup_env(source, values):
    tree=ast.parse(source,filename='reviewed_production.py')
    found=[fn for fn in tree.body
           if isinstance(fn,ast.FunctionDef) and fn.name=='backup_connection']
    if len(found)!=1:stop('Backup connection policy missing')
    namespace={'urllib':urllib,'connection':load_installed_connection()}
    exec(compile(ast.Module(body=found,type_ignores=[]),
                 '<reviewed-backup-connection-only>','exec'),namespace)
    return namespace['backup_connection'](values)

def test_safe_session(source, values):
    try:
        env=derive_backup_env(source,values)
    except Exception:
        stop('Session Pooler validation failed (credentials and URLs hidden)')
    if env.get('PGPORT')!='5432' or env.get('PGSSLMODE')!='verify-full':
        stop('Session Pooler port or TLS policy mismatch')
    cmd=['/usr/bin/psql','-X','--no-password','-qAt','-v','ON_ERROR_STOP=1',
         '-c',("BEGIN READ ONLY; SELECT current_setting('statement_timeout'),"
               " current_setting('default_transaction_read_only'); ROLLBACK;")]
    try:r=run(cmd,env=env,timeout=35)
    except Exception:stop('Session Pooler connection timed out')
    if r.returncode!=0 or r.stdout.strip()!='0|on':
        stop('Session Pooler test failed; no system files changed')
    print('SUPABASE_SESSION_POOLER_5432: CONNECTED',flush=True)
    print('SSL_VERIFY_FULL: ENABLED',flush=True)
    print('READ_ONLY_AND_NO_STATEMENT_TIMEOUT: VERIFIED',flush=True)

def atomic_replace(path, contents, mode):
    fd,tmp=tempfile.mkstemp(dir=path.parent,prefix='.production-backup-session-')
    try:
        with os.fdopen(fd,'wb') as writer:
            writer.write(contents);writer.flush();os.fsync(writer.fileno())
        os.chown(tmp,0,0);os.chmod(tmp,mode)
        os.replace(tmp,path)
    finally:
        if os.path.exists(tmp):os.unlink(tmp)

def main():
    if os.geteuid()!=0:stop('Administrator login required')
    if len(sys.argv)!=2 or not re.fullmatch('[0-9a-f]{40}',sys.argv[1]):
        stop('Exactly one approved GitHub commit SHA required')
    if not TARGET.is_file() or TARGET.is_symlink() or TARGET.stat().st_uid!=0:
        stop('Installed privileged deployer path is not root-owned regular file')
    print('=== BETVIMA VERIFIED BACKUP-ONLY PATCH ===',flush=True)
    lock=STATE/'release.lock'
    with lock.open('a') as shared:
        try:fcntl.flock(shared,fcntl.LOCK_EX|fcntl.LOCK_NB)
        except BlockingIOError:stop('Deployment running; do not patch while it is active')
        original=TARGET.read_bytes()
        digest=blob_sha(original)
        if digest not in (ORIGINAL_BLOB,REPLACEMENT_BLOB):
            stop('Unexpected installed root deployer revision; manual review required')
        new=download(sys.argv[1])
        env=app_env()
        test_safe_session(new,env)
        if digest==REPLACEMENT_BLOB:
            print('BACKUP_SESSION_PATCH_ALREADY_INSTALLED',flush=True)
            return
        backup=pathlib.Path('/root/betvima-backups')/(
            'production.py.before-session-fix-'+sys.argv[1][:12])
        if backup.exists():stop('Backup destination already exists')
        with backup.open('xb') as out:
            out.write(original);out.flush();os.fsync(out.fileno())
        backup.chmod(0o600)
        try:
            atomic_replace(TARGET,new,0o600)
            if blob_sha(TARGET.read_bytes())!=REPLACEMENT_BLOB:
                raise RuntimeError('Installed hash mismatch')
        except Exception:
            atomic_replace(TARGET,original,0o600)
            stop('Patch installation failed; original deployer restored')
        print('ROOT_DEPLOYER_BACKUP_POLICY: UPDATED',flush=True)
        print('WEB_FINANCIAL_WORKERS_DATABASE: UNCHANGED',flush=True)
        print('READY_FOR_VERIFIED_PRODUCTION_BACKUP_RETRY',flush=True)

if __name__=='__main__':main()
