"""Administrator-installed controller. Never execute this file directly from a checkout.

Preview has no production credentials and runs in a private network namespace.
GitHub OIDC, not possession of an SSH key alone, authorizes CI publication.
"""
import base64, fcntl, hashlib, io, json, os, pathlib, re, shutil, subprocess, sys, tarfile, time, urllib.request

ROOT = pathlib.Path('/opt/betvima-preview')
STATE = pathlib.Path('/var/lib/betvima-continuous')
LIB = pathlib.Path('/usr/local/lib/betvima-continuous')
REPO = STATE / 'repository.git'
PREVIEW_ENV = {'NODE_ENV': 'production', 'APP_ENV': 'test', 'NEXT_PUBLIC_SITE_URL': 'https://preview.betvima.com',
               'NEXT_PUBLIC_SITE_NAME': 'BetVima Preview — no real transactions', 'PAYMENT_PROVIDER': 'disabled',
               'SPORTS_PROVIDER': 'disabled', 'NEXT_TELEMETRY_DISABLED': '1', 'CI': '1', 'HOME': '/nonexistent',
               'PATH': '/usr/local/bin:/usr/bin:/bin', 'PGHOST': '127.0.0.1', 'PGPORT': '9'}
HIDDEN = ['/var/www', '/opt/nova-git-seed', '/opt/nova-releases', '/etc/betvima', '/root', '/home', '/var/lib/betvima-continuous', '/run/postgresql']
MAX_ARCHIVE = 80 * 1024 * 1024

def run(args, timeout=60, **kwargs):
    r = subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=timeout, **kwargs)
    if r.returncode:
        if STATE.exists():atomic(STATE/'private-command-failure.log',r.stdout[-1024*1024:]+b'\n--- STDERR ---\n'+r.stderr[-1024*1024:])
        raise RuntimeError('command_failed_output_suppressed')
    return r.stdout

def atomic(path, content, mode=0o600):
    temp = path.with_name(path.name + '.new')
    if temp.is_symlink() or path.is_symlink(): raise ValueError('symlink_refused')
    with temp.open('wb') as f: f.write(content); f.flush(); os.fsync(f.fileno())
    temp.chmod(mode); os.replace(temp, path)

def accepted_path(name):
    p = pathlib.PurePosixPath(name)
    banned = {'.git', '.next', 'node_modules', '.aws', '.ssh', '.codex', '.agents', 'backups', 'logs'}
    if p.is_absolute() or '..' in p.parts or not p.parts or '\\' in name: return False
    if any(n in banned or n.startswith('.env') for n in p.parts): return False
    if name.lower().endswith(('.apk', '.pem', '.key', '.secret', '.pfx', '.p12')): return False
    return not any(w in p.name.lower() for w in ('private-key', 'credentials'))

def unpack(data, destination):
    if len(data) > MAX_ARCHIVE: raise ValueError('archive_too_large')
    with tarfile.open(fileobj=io.BytesIO(data), mode='r:*') as archive:
        members = archive.getmembers(); total = 0; seen = set()
        for member in members:
            if member.isdir(): continue
            if not member.isfile() or not accepted_path(member.name) or member.name in seen: raise ValueError('unsafe_archive_member')
            total += member.size; seen.add(member.name)
            if total > MAX_ARCHIVE: raise ValueError('expanded_archive_too_large')
        for member in members:
            if not member.isfile(): continue
            target = destination / member.name
            for parent in (target, *target.parents):
                if parent == destination.parent: break
                if parent.is_symlink(): raise ValueError('symlink_parent_refused')
            target.parent.mkdir(parents=True, exist_ok=True)
            for parent in target.parents:
                if parent == destination.parent: break
                parent.chmod(0o755)
            data = archive.extractfile(member).read()
            if re.search(rb'(?m)^-----BEGIN (?:OPENSSH |RSA |EC )?PRIVATE KEY-----\r?$', data):
                raise ValueError('private_key_in_snapshot')
            atomic(target, data, 0o644)
    return seen

def sandbox(directory, args, values=None, timeout=1200):
    env = PREVIEW_ENV if values is None else values
    envfile = STATE / 'sandbox.env'
    if any('\n' in value or '\r' in value or '\x00' in value for value in env.values()): raise ValueError('unsupported_environment_value')
    atomic(envfile, ''.join(k+'="'+v.replace('\\','\\\\').replace('"','\\"')+'"\n' for k,v in env.items()).encode())
    user = 'betvima_preview' if values is None else 'betvima_build'
    command = ['/usr/bin/systemd-run', '--quiet', '--wait', '--pipe', '--collect', '--uid='+user, '--gid='+user,
               '--working-directory='+str(directory), '-p', 'EnvironmentFile='+str(envfile),
               '-p', 'ProtectSystem=strict', '-p', 'ProtectHome=yes', '-p', 'PrivateTmp=yes', '-p', 'PrivateNetwork=yes',
               '-p', 'NoNewPrivileges=yes', '-p', 'PrivateDevices=yes', '-p', 'ProtectProc=invisible', '-p', 'CapabilityBoundingSet=',
               '-p', 'ProtectKernelTunables=yes', '-p', 'ProtectKernelModules=yes', '-p', 'ProtectControlGroups=yes',
               '-p', 'InaccessiblePaths='+' '.join('-'+p for p in HIDDEN), '-p', 'ReadWritePaths='+str(directory),
               '-p', 'MemoryMax=2500M', '-p', 'CPUQuota=50%', '-p', 'Nice=15', '-p', 'IOWeight=10',
               '-p', 'TasksMax=256', '-p', 'RuntimeMaxSec=1800', '--'] + args
    try: return run(command, timeout=timeout)
    finally: envfile.unlink(missing_ok=True)

def validate_dependency_lock(lock, package):
    if lock.get('lockfileVersion') not in (2,3) or not isinstance(lock.get('packages'),dict):raise ValueError('unsupported_dependency_lock')
    declared=lock['packages'].get('',{})
    for key in ('dependencies','devDependencies','optionalDependencies'):
        if declared.get(key,{})!=package.get(key,{}):raise ValueError('package_lock_mismatch')
    import urllib.parse
    for name,item in lock['packages'].items():
        if not name:continue
        if item.get('link'):raise ValueError('linked_dependency_requires_review')
        url=urllib.parse.urlsplit(item.get('resolved',''))
        if url.scheme!='https' or url.hostname!='registry.npmjs.org' or url.username or url.password or not item.get('integrity'):
            raise ValueError('non_registry_dependency_requires_review')

def ensure_dependencies(directory):
    import pwd
    lock=json.loads((directory/'package-lock.json').read_text());package=json.loads((directory/'package.json').read_text())
    if lock==json.loads((ROOT/'dependencies/package-lock.json').read_text()):return ROOT/'dependencies/node_modules'
    validate_dependency_lock(lock,package)
    identity=hashlib.sha256(json.dumps(lock,sort_keys=True,separators=(',',':')).encode()).hexdigest()
    sets=ROOT/'dependency-sets';sets.mkdir(exist_ok=True);sets.chmod(0o755)
    destination=sets/identity
    if (destination/'verified.json').exists():return destination/'node_modules'
    import tempfile
    work=pathlib.Path(tempfile.mkdtemp(prefix='install-',dir=sets));work.chmod(0o755)
    (work/'package.json').write_text(json.dumps(package));(work/'package-lock.json').write_text(json.dumps(lock))
    account=pwd.getpwnam('betvima_build');os.chown(work,account.pw_uid,account.pw_gid)
    for file in work.iterdir():file.chmod(0o644);os.chown(file,account.pw_uid,account.pw_gid)
    # Only the OS-provided npm runs with networking. Lifecycle scripts are disabled,
    # the lockfile permits HTTPS npm registry URLs only, and no app/financial key exists.
    args=['/usr/bin/systemd-run','--quiet','--wait','--pipe','--collect','--uid=betvima_build','--gid=betvima_build',
          '--working-directory='+str(work),'-p','ProtectSystem=strict','-p','ProtectHome=yes','-p','PrivateTmp=yes',
          '-p','NoNewPrivileges=yes','-p','PrivateDevices=yes','-p','CapabilityBoundingSet=',
          '-p','InaccessiblePaths='+' '.join('-'+p for p in HIDDEN),'-p','ReadWritePaths='+str(work),
          '-p','IPAddressDeny=localhost','-p','IPAddressDeny=159.198.76.199/32',
          '-p','BindReadOnlyPaths=/run/systemd/resolve/resolv.conf:/etc/resolv.conf',
          '-p','MemoryMax=1800M','-p','CPUQuota=50%','-p','Nice=15','-p','IOWeight=10','-p','RuntimeMaxSec=1200',
          '--setenv=PATH=/usr/bin:/bin','--setenv=HOME=/nonexistent','--setenv=NODE_ENV=test','--',
          '/usr/bin/npm','ci','--ignore-scripts','--audit=false','--fund=false','--registry=https://registry.npmjs.org',
          '--userconfig=/dev/null','--globalconfig=/dev/null','--cache='+str(work/'.npm-cache')]
    # Use the host's upstream resolver file rather than its loopback stub; localhost
    # and the production host remain denied. Preview runtimes never gain networking.
    run(args,timeout=1250)
    for folder,dirs,files in os.walk(work,followlinks=False):
        path=pathlib.Path(folder);path.chmod(0o755);os.chown(path,0,0)
        for name in dirs+files:
            p=path/name
            if p.is_symlink():
                if os.path.isabs(os.readlink(p)) or not p.resolve().is_relative_to(work):raise ValueError('dependency_symlink_escape')
                os.chown(p,0,0,follow_symlinks=False)
            else:os.chown(p,0,0);p.chmod(0o755 if p.is_dir() or p.stat().st_mode&0o111 else 0o644)
    atomic(work/'verified.json',json.dumps({'lock_sha256':identity,'lifecycle_scripts':False}).encode(),0o644)
    work.rename(destination)
    return destination/'node_modules'

def prepare_snapshot(data, label):
    import pwd
    if not re.fullmatch(r'(?:[0-9a-f]{40}|local-[0-9a-f]{20})', label): raise ValueError('invalid_revision')
    directory = ROOT / 'releases' / label
    if directory.exists(): raise ValueError('snapshot_exists')
    directory.mkdir(mode=0o755); directory.chmod(0o755); unpack(data, directory)
    dependencies=ensure_dependencies(directory)
    (directory/'node_modules').symlink_to(dependencies, target_is_directory=True)
    account = pwd.getpwnam('betvima_preview')
    for folder, dirs, files in os.walk(directory, followlinks=False):
        os.chown(folder, account.pw_uid, account.pw_gid)
        for name in files: os.chown(pathlib.Path(folder)/name, account.pw_uid, account.pw_gid, follow_symlinks=False)
    return directory

def set_link(name, destination):
    link = ROOT/name; temporary = ROOT/(name+'.new')
    temporary.unlink(missing_ok=True); temporary.symlink_to(destination, target_is_directory=True); os.replace(temporary, link)

def verify_web(port, build=None):
    for attempt in range(45):
        try:
            req=urllib.request.Request('http://127.0.0.1:'+str(port)+'/',headers={'Host':'preview.betvima.com'})
            with urllib.request.urlopen(req, timeout=8) as response:
                if response.status==200 and (build is None or build.encode() in response.read(5*1024*1024)): return
        except Exception: pass
        time.sleep(1)
    raise ValueError('preview_health_failed')

def publish_preview(directory, run_tests=True):
    if run_tests:
        for stage,args in (('unit',['/usr/bin/node','node_modules/vitest/vitest.mjs','run','tests/unit','--no-cache']),
                     ('typecheck',['/usr/bin/node','node_modules/typescript/bin/tsc','--noEmit']),
                     ('lint',['/usr/bin/node','node_modules/next/dist/bin/next','lint'])):
            atomic(STATE/'preview-progress.json',json.dumps({'revision':directory.name,'stage':stage}).encode());sandbox(directory,args)
    atomic(STATE/'preview-progress.json',json.dumps({'revision':directory.name,'stage':'build'}).encode())
    sandbox(directory, ['/usr/bin/node','node_modules/next/dist/bin/next','build'])
    build=(directory/'.next/BUILD_ID').read_text().strip()
    old=(ROOT/'current').resolve() if (ROOT/'current').exists() else None
    set_link('current',directory)
    atomic(STATE/'preview-progress.json',json.dumps({'revision':directory.name,'stage':'start_and_verify'}).encode())
    try:
        run(['systemctl','restart','betvima-preview.service']); run(['systemctl','restart','betvima-preview-proxy.service'])
        verify_web(3200,build)
    except Exception:
        if old:
            set_link('current',old); run(['systemctl','restart','betvima-preview.service']); run(['systemctl','restart','betvima-preview-proxy.service'])
        raise
    atomic(STATE/'preview-status.json',json.dumps({'revision':directory.name,'build':build,'state':'healthy','financial_services':'disabled','updated_at':int(time.time())}).encode(),0o644)

def sync():
    data=sys.stdin.buffer.read(MAX_ARCHIVE+1)
    with (STATE/'sync.lock').open('w') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX)
        previous=json.loads((STATE/'live-files.json').read_text()) if (STATE/'live-files.json').exists() else []
        if data==b'{"action":"manifest"}':
            hashes={name:hashlib.sha256((ROOT/'live'/name).read_bytes()).hexdigest() for name in previous if accepted_path(name) and (ROOT/'live'/name).is_file() and not (ROOT/'live'/name).is_symlink()}
            print(json.dumps({'sync':'manifest','files':hashes}));return
        with tarfile.open(fileobj=io.BytesIO(data),mode='r:*') as packet:
            try:
                manifest=packet.getmember('.preview-manifest.json')
                if not manifest.isfile() or manifest.size>2*1024*1024:raise ValueError('invalid_manifest')
                seen=json.load(packet.extractfile(manifest))
                if not isinstance(seen,list) or len(seen)>20000 or not all(isinstance(n,str) and accepted_path(n) and n!='.preview-manifest.json' for n in seen):raise ValueError('invalid_manifest')
                if any(m.isfile() and m.name not in seen and m.name!='.preview-manifest.json' for m in packet.getmembers()):raise ValueError('unexpected_delta_file')
            except KeyError:seen=None
        extracted=unpack(data,ROOT/'live')
        if seen is None:seen=extracted
        (ROOT/'live/.preview-manifest.json').unlink(missing_ok=True)
        seen=set(seen)
        for name in set(previous)-seen:
            if accepted_path(name):
                path=ROOT/'live'/name
                if path.is_file() and not path.is_symlink():path.unlink()
        atomic(STATE/'live-files.json',json.dumps(sorted(seen)).encode())
        full=io.BytesIO()
        with tarfile.open(fileobj=full,mode='w:') as archive:
            for name in sorted(seen):
                file=ROOT/'live'/name
                if not file.is_file() or file.is_symlink():raise ValueError('incomplete_source_snapshot')
                content=file.read_bytes();member=tarfile.TarInfo(name);member.size=len(content);member.mode=0o644;archive.addfile(member,io.BytesIO(content))
        snapshot=full.getvalue();label='local-'+hashlib.sha256(snapshot).hexdigest()[:20]
        atomic(STATE/'pending.tar',snapshot)
        atomic(STATE/'pending.json',json.dumps({'revision':label}).encode())
    print(json.dumps({'sync':'accepted','revision':label,'secrets_uploaded':False}))

def queue():
    with (STATE/'release.lock').open('w') as lock:
        try: fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        except BlockingIOError:return
        pending=STATE/'pending.json'
        if not pending.exists():return
        with (STATE/'sync.lock').open('w') as source_lock:
            fcntl.flock(source_lock,fcntl.LOCK_EX)
            label=json.loads(pending.read_text())['revision']; data=(STATE/'pending.tar').read_bytes()
        done=json.loads((STATE/'queue-status.json').read_text()) if (STATE/'queue-status.json').exists() else {}
        if done.get('revision')==label:return
        try:
            directory=prepare_snapshot(data,label); publish_preview(directory)
            outcome={'revision':label,'state':'healthy'}
        except Exception as error:
            outcome={'revision':label,'state':'failed','reason':str(error) if str(error) in ('dependency_lock_change_requires_preparation','preview_health_failed') else 'details_suppressed'}
        atomic(STATE/'queue-status.json',json.dumps(outcome).encode(),0o644)

def decode(part):return base64.urlsafe_b64decode(part+'='*((-len(part))%4))

def verify_oidc(token, mode, now=None):
    from cryptography.hazmat.primitives.asymmetric import rsa,padding
    from cryptography.hazmat.primitives import hashes
    if len(token)>20000:raise ValueError('token_too_large')
    parts=token.split('.')
    if len(parts)!=3:raise ValueError('invalid_token')
    header=json.loads(decode(parts[0])); claims=json.loads(decode(parts[1])); now=time.time() if now is None else now
    if header.get('alg')!='RS256':raise ValueError('invalid_algorithm')
    if claims.get('iss')!='https://token.actions.githubusercontent.com' or claims.get('aud')!='betvima-'+mode:raise ValueError('invalid_issuer_or_audience')
    if claims.get('repository')!='uonesmj/Betvima' or claims.get('repository_owner')!='uonesmj' or str(claims.get('repository_id'))!='1413860117' or str(claims.get('repository_owner_id'))!='340808306':raise ValueError('invalid_repository')
    if not (claims.get('nbf',now+1)<=now<claims.get('exp',0)) or claims.get('iat',0)<now-600:raise ValueError('expired_token')
    if not re.fullmatch('[0-9a-f]{40}',claims.get('sha','')):raise ValueError('invalid_revision')
    ref=claims.get('ref','')
    if mode=='production':
        if claims.get('event_name')!='workflow_dispatch' or claims.get('actor')!='uonesmj' or ref!='refs/heads/main':raise ValueError('explicit_owner_approval_required')
    elif mode=='preview':
        if claims.get('event_name') not in ('push','workflow_dispatch') or not (ref=='refs/heads/main' or ref.startswith('refs/heads/codex/')):raise ValueError('invalid_preview_event')
    else:raise ValueError('invalid_mode')
    if claims.get('workflow_ref')!='uonesmj/Betvima/.github/workflows/continuous.yml@'+ref:raise ValueError('invalid_workflow')
    with urllib.request.urlopen('https://token.actions.githubusercontent.com/.well-known/jwks',timeout=20) as response:keys=json.load(response)['keys']
    key=next(k for k in keys if k.get('kid')==header.get('kid'))
    public=rsa.RSAPublicNumbers(int.from_bytes(decode(key['e']),'big'),int.from_bytes(decode(key['n']),'big')).public_key()
    public.verify(decode(parts[2]),(parts[0]+'.'+parts[1]).encode(),padding.PKCS1v15(),hashes.SHA256())
    return claims

def archive_commit(claims):
    env={'PATH':'/usr/bin:/bin','HOME':'/root','GIT_TERMINAL_PROMPT':'0','GIT_SSH_COMMAND':'ssh -i /root/.ssh/betvima_github -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes'}
    run(['git','--git-dir='+str(REPO),'-c','core.hooksPath=/dev/null','fetch','origin',claims['ref']],env=env)
    head=run(['git','--git-dir='+str(REPO),'rev-parse','FETCH_HEAD'],env=env).decode().strip()
    if head!=claims['sha']:raise ValueError('branch_changed_since_approval')
    data=run(['git','--git-dir='+str(REPO),'archive',head],env=env)
    # Git archive includes the preserved APK; omit it and other prohibited files before extraction.
    output=io.BytesIO()
    with tarfile.open(fileobj=io.BytesIO(data),mode='r:') as source,tarfile.open(fileobj=output,mode='w:') as target:
        for member in source:
            if member.isfile() and accepted_path(member.name):target.addfile(member,source.extractfile(member))
    return output.getvalue()

def ci():
    envelope=json.loads(sys.stdin.buffer.read(25000));mode=envelope['mode'];claims=verify_oidc(envelope['token'],mode)
    with (STATE/'release.lock').open('w') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX)
        nonce=hashlib.sha256(claims['jti'].encode()).hexdigest()
        used=STATE/'tokens'/nonce
        with used.open('x') as record:record.write(str(int(time.time())))
        data=archive_commit(claims)
        directory=ROOT/'releases'/claims['sha']
        if not directory.exists():directory=prepare_snapshot(data,claims['sha'])
        if mode=='preview':publish_preview(directory)
        else:
            # Administrator-installed production controller, never an executable from the candidate tree.
            atomic(STATE/'production-source.tar',data)
            run(['/usr/bin/python3',str(LIB/'production.py'),claims['sha']],timeout=3600)
        print(json.dumps({'deploy':mode,'revision':claims['sha'],'status':'verified'}),flush=True)

if __name__=='__main__':
    os.umask(0o077)
    try:
        if os.geteuid()!=0 or len(sys.argv)!=2:raise ValueError('fixed_administrator_entrypoint_required')
        {'sync':sync,'queue':queue,'ci':ci}[sys.argv[1]]()
    except Exception as error:
        print(json.dumps({'status':'blocked_or_failed','reason':str(error) if str(error) in ('dependency_lock_change_requires_preparation','explicit_owner_approval_required','branch_changed_since_approval') else 'details_suppressed'}),flush=True);sys.exit(1)
