#!/usr/bin/env python3
"""One-time pin-verified upgrade of the installed Betvima deployment controller.

This script updates ONLY the 3 administrator-installed CI/deployment programs
and restarts ONLY betvima-ci-http.service. No website, DB, odds, wallet,
settlement worker, migrations or Nginx reload are part of this operation.
"""
import hashlib
import json
import os
import pathlib
import pwd
import re
import shutil
import stat
import subprocess
import sys
import tempfile
import time
import urllib.request

LIB = pathlib.Path('/usr/local/lib/betvima-continuous')
ARCHIVES = pathlib.Path('/root/betvima-backups')
SERVICE = 'betvima-ci-http.service'
REPO = 'uonesmj/Betvima'
FILES = {
    'controller.py': {
        'previous': '6ce6478f49d7ec2bcd7ad34cd1319a667915e00e',
        'replacement': '67d56505b1b9898fd29ac0b0f4a49f78989a8abf',
        'mode': 0o600,
    },
    'production.py': {
        'previous': '22d757899f632f2c89e2b3f682750be8f427b794',
        'replacement': 'f5eca460b7ecbf201e24222632cfdda82af9edb0',
        'mode': 0o600,
    },
    'ci-http.py': {
        'previous': 'e537b05956ff64efc2ad2b8d0c4ca758b3b5170a',
        'replacement': '26d2f0c5212ff09d2efdf139b71a6c16cb14a7a7',
        'mode': 0o644,
    },
}

def stop(message):
    raise SystemExit('STOP: '+message)

def blob_sha(data):
    return hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()

def call(*args, timeout=35):
    return subprocess.run(args, capture_output=True, text=True, timeout=timeout)

def read_owned(filename):
    path=LIB/filename
    if not path.is_file() or path.is_symlink() or path.stat().st_uid!=0:
        stop('Unsafe installed file: '+filename)
    return path.read_bytes()

def download(sha, name, expected):
    url=f'https://raw.githubusercontent.com/{REPO}/{sha}/ops/continuous/{name}'
    request=urllib.request.Request(url,headers={'User-Agent':'Betvima-reviewed-controller-upgrade'})
    with urllib.request.urlopen(request,timeout=40) as response:
        data=response.read(512_001)
    if len(data)>512_000 or blob_sha(data)!=expected:
        stop('Pinned source mismatch: '+name)
    compile(data,name,'exec')
    return data

def health_preflight():
    if os.geteuid()!=0:stop('Must run as root')
    if LIB.is_symlink() or not LIB.is_dir():stop('Unsafe controller library directory')
    if LIB.stat().st_uid!=0:stop('Controller library must be root-owned')
    unit=call('systemctl','is-active',SERVICE)
    if unit.returncode!=0 or unit.stdout.strip()!='active':
        stop('CI ingress service is not active')
    r=call('/usr/sbin/runuser','-u','novaadmin','--',
           '/usr/bin/env','-u','NODE_CHANNEL_FD','-u','NODE_UNIQUE_ID',
           'PM2_HOME=/home/novaadmin/.pm2','/usr/bin/pm2','jlist')
    if r.returncode:stop('PM2 unavailable')
    apps=json.loads(r.stdout)
    for name in ('betvima-settlement-worker','betvima-odds-worker'):
        if not any(a.get('name')==name and a.get('pm2_env',{}).get('status')=='online' for a in apps):
            stop('Protected worker unavailable: '+name)
    if not any(a.get('name','').startswith('nova-cd-')
               and a.get('pm2_env',{}).get('status')=='online' for a in apps):
        stop('Production website unavailable')

def replace_root_file(path, contents, mode):
    fd,temp=tempfile.mkstemp(prefix='.controller-reviewed-',dir=path.parent)
    try:
        with os.fdopen(fd,'wb') as stream:
            stream.write(contents);stream.flush();os.fsync(stream.fileno())
        os.chown(temp,0,0)
        os.chmod(temp,mode)
        os.replace(temp,path)
    finally:
        if os.path.exists(temp):os.unlink(temp)

def main():
    if len(sys.argv)!=2 or not re.fullmatch('[0-9a-f]{40}',sys.argv[1]):
        stop('Pass an immutable reviewed Git commit SHA')
    sha=sys.argv[1]
    health_preflight()
    print('=== VERIFIED CI CONTROLLER UPGRADE ===',flush=True)
    originals={}
    needs_update=False
    for name,policy in FILES.items():
        current=read_owned(name)
        found=blob_sha(current)
        if found not in (policy['previous'],policy['replacement']):
            stop('Unreviewed installed file detected: '+name+' (blob '+found+')')
        originals[name]=current
        needs_update |= found!=policy['replacement']
    if not needs_update:
        print('CONTROLLER_ALREADY_CURRENT',flush=True)
        return
    # Verify every new file *before* any privileged local mutation.
    replacements={name:download(sha,name,policy['replacement'])
                  for name,policy in FILES.items()}
    if b'PRODUCTION_STAGES' not in replacements['production.py']:
        stop('Production phase tracking missing')
    if b'allowed_stages' not in replacements['ci-http.py']:
        stop('Safe HTTP diagnostic allowlist missing')
    if b'claims[\'sha\']' not in replacements['controller.py']:
        stop('OIDC revision validation missing')
    print('PINNED_GITHUB_FILES_VERIFIED',flush=True)

    ARCHIVES.mkdir(mode=0o700,exist_ok=True)
    archive=ARCHIVES/('continuous-upgrade-'+time.strftime('%Y%m%dT%H%M%SZ',time.gmtime()))
    if archive.exists():stop('Controller backup destination already exists')
    archive.mkdir(mode=0o700)
    for name,data in originals.items():
        backup=archive/name
        with backup.open('xb') as output:
            output.write(data);output.flush();os.fsync(output.fileno())
        backup.chmod(0o600)
    print('CONTROLLER_BACKUP_SAVED',flush=True)

    try:
        for name,data in replacements.items():
            replace_root_file(LIB/name,data,FILES[name]['mode'])
        restarted=call('systemctl','restart',SERVICE,timeout=30)
        ready=call('systemctl','is-active',SERVICE,timeout=10)
        if restarted.returncode or ready.returncode or ready.stdout.strip()!='active':
            raise RuntimeError('ci_transport_restart_failed')
        for name,policy in FILES.items():
            if blob_sha(read_owned(name)) != policy['replacement']:
                raise RuntimeError('installed_controller_sha_mismatch')
    except Exception:
        # Explicit rollback of ALL privileged controller files on any error.
        for name,data in originals.items():
            replace_root_file(LIB/name,data,FILES[name]['mode'])
        call('systemctl','restart',SERVICE,timeout=30)
        stop('Controller upgrade failed and original files restored; inspect '+str(archive))
    print('CONTROLLER_VERSION:',sha,flush=True)
    print('DEPLOYMENT_STAGE_DIAGNOSTICS: ENABLED',flush=True)
    print('FAILED_RELEASE_RETRY_ARCHIVING: ENABLED',flush=True)
    print('MIGRATION_REGISTRY_COMPATIBILITY: ENABLED',flush=True)
    print('CI_INGRESS: ACTIVE',flush=True)
    print('WEB_AND_FINANCIAL_WORKERS: UNCHANGED',flush=True)
    print('CONTROLLER_UPGRADE_COMPLETE',flush=True)

if __name__=='__main__':main()
