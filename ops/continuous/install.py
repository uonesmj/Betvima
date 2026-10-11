"""Run as administrator from a reviewed, private installer directory."""
import base64, hashlib, json, os, pathlib, pwd, shutil, subprocess, sys

BASE=pathlib.Path('/opt/betvima-preview'); STATE=pathlib.Path('/var/lib/betvima-continuous'); LIB=pathlib.Path('/usr/local/lib/betvima-continuous')

def run(args):
    result=subprocess.run(args,capture_output=True,timeout=180,preexec_fn=(lambda:os.umask(0o022)) if args[0]=='certbot' else None)
    if result.returncode:raise RuntimeError('installation_command_failed_output_suppressed')
    return result.stdout

def write(path,text,mode=0o644):
    if path.is_symlink():raise ValueError('symlink_refused')
    path.write_text(text);path.chmod(mode)

def service(name, cwd, args, port, dev=False):
    env='\n'.join('Environment="'+k+'='+v+'"' for k,v in {
        'NODE_ENV':'development' if dev else 'production','APP_ENV':'test','NEXT_TELEMETRY_DISABLED':'1',
        'NEXT_PUBLIC_SITE_URL':'https://preview.betvima.com','NEXT_PUBLIC_SITE_NAME':'BetVima Preview',
        'PAYMENT_PROVIDER':'disabled','SPORTS_PROVIDER':'disabled','PGHOST':'127.0.0.1','PGPORT':'9',
        'BETVIMA_PREVIEW_DEV':'1' if dev else '0','HOME':'/nonexistent','PATH':'/usr/bin:/bin'}.items())
    write(pathlib.Path('/etc/systemd/system/'+name+'.service'),f'''[Unit]
Description=Isolated Betvima {'hot reload' if dev else 'compiled preview'} web only
After=network.target
[Service]
Type=simple
User=betvima_preview
Group=betvima_preview
WorkingDirectory={cwd}
ExecStart=/usr/bin/node node_modules/next/dist/bin/next {args} --hostname 127.0.0.1 -p {port}
{env}
Restart=on-failure
RestartSec=5
PrivateNetwork=yes
PrivateTmp=yes
PrivateDevices=yes
ProtectProc=invisible
ProtectSystem=strict
ProtectHome=yes
NoNewPrivileges=yes
CapabilityBoundingSet=
ProtectKernelTunables=yes
ProtectKernelModules=yes
ProtectControlGroups=yes
RestrictSUIDSGID=yes
InaccessiblePaths=-/var/www -/opt/nova-git-seed -/opt/nova-releases -/etc/betvima -/root -/home -/var/lib/betvima-continuous -/run/postgresql
ReadWritePaths={cwd}/.next
MemoryMax=1800M
CPUQuota=50%
Nice=15
IOWeight=10
TasksMax=256
UMask=0077
[Install]
WantedBy=multi-user.target
''')

def proxy(name, target, host_port, private_port):
    write(pathlib.Path('/etc/systemd/system/'+name+'.socket'),f'''[Unit]
Description=Loopback-only Betvima preview ingress
[Socket]
ListenStream=127.0.0.1:{host_port}
NoDelay=true
[Install]
WantedBy=sockets.target
''')
    write(pathlib.Path('/etc/systemd/system/'+name+'.service'),f'''[Unit]
Requires={target}.service
BindsTo={target}.service
PartOf={target}.service
After={target}.service
JoinsNamespaceOf={target}.service
[Service]
User=betvima_preview
Group=betvima_preview
PrivateNetwork=yes
PrivateTmp=yes
ProtectSystem=strict
ProtectHome=yes
NoNewPrivileges=yes
CapabilityBoundingSet=
ExecStart=/usr/lib/systemd/systemd-socket-proxyd 127.0.0.1:{private_port}
''')

def main():
    os.umask(0o077)
    if os.geteuid()!=0:raise ValueError('administrator_required')
    source=pathlib.Path(__file__).resolve().parent
    config=json.loads((source/'installation-private.json').read_text())
    for name in ('betvima_preview','betvima_build','betvima_ci','betvima_preview_sync'):
        try:pwd.getpwnam(name)
        except KeyError:run(['useradd','--system','--create-home','--shell','/bin/sh' if name=='betvima_preview_sync' else '/usr/sbin/nologin',name])
    for path in (BASE,BASE/'releases',BASE/'live',STATE,STATE/'tokens',STATE/'acme',LIB):path.mkdir(parents=True,exist_ok=True,mode=0o755 if path in (BASE,BASE/'live',BASE/'releases',STATE/'acme') else 0o700)
    for path in (BASE,BASE/'releases',BASE/'live'):path.chmod(0o755)
    STATE.chmod(0o700);LIB.chmod(0o755)
    for name in ('controller.py','production.py'):
        if not (source/name).is_file():raise ValueError('reviewed_controller_missing')
        shutil.copyfile(source/name,LIB/name);(LIB/name).chmod(0o600)
    shutil.copyfile(source/'ci-http.py',LIB/'ci-http.py');(LIB/'ci-http.py').chmod(0o644)
    for script,action in (('betvima-ci','ci'),('betvima-sync','sync')):
        write(pathlib.Path('/usr/local/sbin')/script,'#!/bin/sh\n[ "$#" -eq 0 ] || exit 64\nexec /usr/bin/python3 -I /usr/local/lib/betvima-continuous/controller.py '+action+'\n',0o755)
    for user,entry,pub in (('betvima_ci','betvima-ci',None),('betvima_preview_sync','betvima-sync',config['sync_public_key'])):
        rule=pathlib.Path('/etc/sudoers.d')/('betvima-'+user)
        write(rule,user+' ALL=(root) NOPASSWD: /usr/local/sbin/'+entry+' ""\n',0o440)
        run(['/usr/sbin/visudo','-cf',str(rule)])
        if pub is None:continue
        if not pub.startswith('ssh-ed25519 ') or '\n' in pub.strip():raise ValueError('invalid_public_key')
        account=pwd.getpwnam(user);ssh=pathlib.Path(account.pw_dir)/'.ssh';ssh.mkdir(exist_ok=True,mode=0o700)
        key=ssh/'authorized_keys';write(key,'restrict,command="sudo -n /usr/local/sbin/'+entry+'" '+pub.strip()+'\n',0o600)
        os.chown(ssh,account.pw_uid,account.pw_gid);os.chown(key,account.pw_uid,account.pw_gid)
    dependencies=BASE/'dependencies'
    if not dependencies.exists():
        dependencies.mkdir(mode=0o755)
        shutil.copytree('/opt/nova-git-seed/node_modules',dependencies/'node_modules',symlinks=True)
        shutil.copyfile('/opt/nova-git-seed/package-lock.json',dependencies/'package-lock.json')
        for folder,dirs,files in os.walk(dependencies,followlinks=False):
            os.chmod(folder,0o755)
            for filename in files:
                p=pathlib.Path(folder)/filename
                if not p.is_symlink():p.chmod(0o755 if p.stat().st_mode&0o111 else 0o644)
    link=BASE/'live/node_modules'
    if not link.exists():link.symlink_to(dependencies/'node_modules',target_is_directory=True)
    cache=BASE/'live/.next';cache.mkdir(exist_ok=True,mode=0o700);a=pwd.getpwnam('betvima_preview');os.chown(cache,a.pw_uid,a.pw_gid)
    if not (STATE/'repository.git').exists():
        env={**os.environ,'GIT_SSH_COMMAND':'ssh -i /root/.ssh/betvima_github -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes'}
        r=subprocess.run(['git','clone','--bare','git@github.com:uonesmj/Betvima.git',str(STATE/'repository.git')],env=env,capture_output=True,timeout=120)
        if r.returncode:raise ValueError('repository_clone_failed')
    service('betvima-preview',BASE/'current','start',3201)
    service('betvima-preview-dev',BASE/'live','dev',3101,True)
    proxy('betvima-preview-proxy','betvima-preview',3200,3201)
    proxy('betvima-preview-dev-proxy','betvima-preview-dev',3100,3101)
    write(pathlib.Path('/etc/systemd/system/betvima-ci-http.service'),'''[Unit]
Description=OIDC-only Betvima CI transport
After=network.target
[Service]
User=betvima_ci
Group=betvima_ci
ExecStart=/usr/bin/python3 -I /usr/local/lib/betvima-continuous/ci-http.py
Restart=on-failure
RestartSec=5
UMask=0077
MemoryMax=1500M
CPUQuota=50%
Nice=15
StandardOutput=null
StandardError=null
[Install]
WantedBy=multi-user.target
''')
    write(pathlib.Path('/etc/systemd/system/betvima-preview-queue.service'),'''[Unit]
Description=Build queued Betvima preview snapshot
[Service]
Type=oneshot
ExecStart=/usr/bin/python3 -I /usr/local/lib/betvima-continuous/controller.py queue
TimeoutStartSec=3600
UMask=0077
StandardOutput=null
StandardError=null
''')
    write(pathlib.Path('/etc/systemd/system/betvima-preview-queue.timer'),'''[Unit]
Description=Automatically build changed local preview code
[Timer]
OnBootSec=30
OnUnitInactiveSec=15
Unit=betvima-preview-queue.service
[Install]
WantedBy=timers.target
''')
    auth=pathlib.Path('/etc/nginx/betvima-preview.htpasswd')
    result=subprocess.run(['openssl','passwd','-6','-stdin'],input=config['preview_password']+'\n',text=True,capture_output=True,timeout=10)
    if result.returncode:raise ValueError('password_hash_failed')
    write(auth,'betvima:'+result.stdout.strip()+'\n',0o640);os.chown(auth,0,pwd.getpwnam('www-data').pw_gid)
    site=pathlib.Path('/etc/nginx/sites-enabled/betvima-preview.conf')
    http='''limit_req_zone $binary_remote_addr zone=betvima_ci:10m rate=2r/m;
server {
    listen 80;
    server_name preview.betvima.com;
    location ^~ /.well-known/acme-challenge/ { root /var/lib/betvima-continuous-acme; }
    location / { return 308 https://preview.betvima.com$request_uri; }
}
'''
    if site.exists() and site.read_text()!=http:raise ValueError('preview_vhost_exists_review_before_reinstall')
    acme=pathlib.Path('/var/lib/betvima-continuous-acme');acme.mkdir(exist_ok=True,mode=0o755);acme.chmod(0o755)
    for folder in (acme/'.well-known',acme/'.well-known/acme-challenge'):
        if folder.exists():folder.chmod(0o755)
    write(site,http);run(['/usr/sbin/nginx','-t']);run(['systemctl','reload','nginx'])
    run(['certbot','certonly','--webroot','-w',str(acme),'-d','preview.betvima.com','--cert-name','betvima-preview','--register-unsafely-without-email','--agree-tos','--non-interactive'])
    https='''server {
    listen 443 ssl;
    server_name preview.betvima.com;
    ssl_certificate /etc/letsencrypt/live/betvima-preview/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/betvima-preview/privkey.pem;
    auth_basic "Betvima isolated preview";
    auth_basic_user_file /etc/nginx/betvima-preview.htpasswd;
    add_header X-Robots-Tag "noindex, nofollow, noarchive" always;
    add_header X-Betvima-Preview "isolated-no-real-transactions" always;
    add_header Content-Security-Policy "connect-src 'self' wss://preview.betvima.com; form-action 'self'; frame-ancestors 'none'" always;
    location = /__ci {
        auth_basic off;
        limit_req zone=betvima_ci burst=3 nodelay;
        client_max_body_size 25k;
        if ($request_method != POST) { return 405; }
        proxy_pass http://127.0.0.1:3299;
        proxy_set_header Host $host;
        proxy_read_timeout 5600s;
        proxy_send_timeout 60s;
    }
    location ~ ^/(?:dev/)?api/(?:v1/)?(?:bets|wallet|payments|withdrawals|deposits|settlements|admin|workers|cron|auth)(?:/|$) {
        auth_basic "Betvima isolated preview";
        return 403;
    }
    location /dev {
        if ($request_method !~ ^(GET|HEAD|OPTIONS)$) { return 405; }
        proxy_pass http://127.0.0.1:3100;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto https;
        proxy_read_timeout 120s;
    }
    location / {
        if ($request_method !~ ^(GET|HEAD|OPTIONS)$) { return 405; }
        proxy_pass http://127.0.0.1:3200;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto https;
        proxy_read_timeout 60s;
    }
}
'''
    write(site,http+https);run(['/usr/sbin/nginx','-t']);run(['systemctl','reload','nginx'])
    run(['systemctl','daemon-reload'])
    run(['systemctl','enable','--now','betvima-preview-proxy.socket','betvima-preview-dev-proxy.socket','betvima-preview-queue.timer','betvima-ci-http.service'])
    hook=pathlib.Path('/etc/letsencrypt/renewal-hooks/deploy/betvima-preview-nginx')
    write(hook,'#!/bin/sh\n/usr/sbin/nginx -t >/dev/null 2>&1 && /usr/bin/systemctl reload nginx\n',0o755)
    (source/'installation-private.json').unlink()
    print(json.dumps({'installation':'preview_isolated_and_ssl_configured','production_route_changed':False,'financial_services_started':False}))

if __name__=='__main__':
    try:main()
    except Exception:print('preview_installation_failed_details_suppressed');sys.exit(1)
