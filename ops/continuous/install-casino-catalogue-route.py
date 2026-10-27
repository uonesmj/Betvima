#!/usr/bin/env python3
"""One-time, fail-closed Nginx route repair for the casino game catalogue.

The deployed web release on :3010 has no /api/v1/casino/games route;
the dedicated casino backend on :3098 does. This installer adds ONLY a
read-only exact-path GET proxy, validates real upstream JSON and the HTTPS
local-origin response, and rolls back the original Nginx config on failure. It waits for the
asynchronous Nginx worker reload, requiring consecutive correct responses.

No game launch, financial permission, identity decision, wallet or casino
backend changes. Requires a separately authorized operator on the VPS.
"""
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import tempfile
import time

SITE = Path('/etc/nginx/sites-enabled/betvima.com')
BACKUPS = Path('/root/betvima-backups')
ANCHOR = '    location = /api/v1/casino/eligibility {'
ROUTE = """    # BetVima casino catalogue is served by the isolated :3098 backend.
    # GET/HEAD only; never proxy unrelated API paths or enable gameplay.
    location = /api/v1/casino/games {
        limit_except GET { deny all; }
        proxy_pass http://127.0.0.1:3098;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 5s;
        proxy_read_timeout 30s;
    }

"""
UPSTREAM_URL = 'http://127.0.0.1:3098/api/v1/casino/games?limit=1'
LOCAL_URL = 'https://betvima.com/api/v1/casino/games?limit=1'

def cmd(args, timeout=25):
    return subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                          timeout=timeout, check=True).stdout

def get_catalogue(url, local_tls=False):
    args=['/usr/bin/curl','--silent','--show-error','--fail',
          '--noproxy','*','--connect-timeout','5','--max-time','20',
          '--user-agent','curl/8.5.0','--header','Accept: application/json']
    if local_tls:
        args.extend(['--resolve','betvima.com:443:127.0.0.1'])
    args.append(url)
    payload=cmd(args,timeout=25)
    # Validate the UI's actual data contract, not merely HTTP 200.
    if len(payload)>2*1024*1024:
        raise RuntimeError('CATALOGUE_RESPONSE_TOO_LARGE')
    try:
        obj=json.loads(payload)
    except (ValueError,UnicodeError):
        raise RuntimeError('CATALOGUE_INVALID_JSON') from None
    if (not isinstance(obj,dict) or obj.get('ok') is not True
        or not isinstance(obj.get('data'),dict)
        or not isinstance(obj['data'].get('items'),list)
        or not isinstance(obj['data'].get('total'),int)):
        raise RuntimeError('CATALOGUE_UNEXPECTED_RESPONSE_CONTRACT')
    return len(obj['data']['items'])

def wait_for_catalogue(url, local_tls=False, attempts=35, delay_seconds=1):
    """Permit asynchronous Nginx worker reload, never weaken the JSON checks.

    One successful response is insufficient: require two consecutive correct
    HTTPS responses, so a transient healthy worker cannot mask failed rollout.
    """
    if attempts < 2:
        raise ValueError('AT_LEAST_TWO_PROBES_REQUIRED')
    successes=0
    last_error='no_response'
    for index in range(attempts):
        try:
            count=get_catalogue(url,local_tls=local_tls)
            successes+=1
            if successes>=2:
                return count
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired,
                RuntimeError, OSError) as error:
            successes=0
            last_error=type(error).__name__
        if index+1<attempts:
            time.sleep(delay_seconds)
    raise RuntimeError('CATALOGUE_HTTPS_NOT_READY_AFTER_RELOAD_'+last_error)

def verify_baseline(source):
    if source.count(ANCHOR)!=1:
        raise RuntimeError('CASINO_ELIGIBILITY_ROUTE_NOT_UNIQUE')
    if not re.search(r'location\s*=\s*/api/v1/casino/eligibility\s*\{[^{}]*proxy_pass\s+http://127\.0\.0\.1:3098;',source,re.S):
        raise RuntimeError('CASINO_ELIGIBILITY_UPSTREAM_MISMATCH')
    if not re.search(r'location\s*=\s*/api/v1/casino/launch\s*\{[^{}]*proxy_pass\s+http://127\.0\.0\.1:3098;',source,re.S):
        raise RuntimeError('CASINO_LAUNCH_UPSTREAM_MISMATCH')
    if not re.search(r'location\s+/\s*\{[^{}]*proxy_pass\s+http://127\.0\.0\.1:3010;',source,re.S):
        raise RuntimeError('CURRENT_WEB_UPSTREAM_CHANGED')
    if source.count('location = /api/v1/casino/games')!=0:
        raise RuntimeError('CATALOGUE_ROUTE_ALREADY_EXISTS_REVIEW_REQUIRED')
    if source.count('proxy_pass http://127.0.0.1:3098;')<3:
        raise RuntimeError('EXPECTED_CASINO_UPSTREAM_MISSING')

def atomic_write(target, raw, mode):
    fd,tmp=tempfile.mkstemp(prefix='.betvima-casino-catalogue-',dir=target.parent)
    try:
        with os.fdopen(fd,'wb') as f:
            f.write(raw);f.flush();os.fsync(f.fileno())
        os.chown(tmp,0,0)
        os.chmod(tmp,mode)
        os.replace(tmp,target)
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)

def main():
    if os.geteuid()!=0:
        raise SystemExit('STOP: root required')
    if not SITE.is_file():
        raise SystemExit('STOP: Nginx configuration missing')
    target=SITE.resolve(strict=True)
    if target.parent not in (Path('/etc/nginx/sites-available'),Path('/etc/nginx/sites-enabled')):
        raise SystemExit('STOP: Nginx configuration points outside approved directory')
    info=target.stat()
    if not stat.S_ISREG(info.st_mode) or info.st_uid!=0 or info.st_mode & 0o022:
        raise SystemExit('STOP: Nginx config is not root-owned and protected')
    original=target.read_bytes()
    if len(original)>1024*1024:
        raise SystemExit('STOP: unexpectedly large Nginx config')
    source=original.decode('utf-8')
    if 'location = /api/v1/casino/games {' in source:
        if source.count(ROUTE)!=1:
            raise SystemExit('STOP: preexisting catalogue route differs from reviewed configuration')
        cmd(['/usr/sbin/nginx','-t'])
        wait_for_catalogue(LOCAL_URL,local_tls=True)
        print('CASINO_CATALOGUE_NGINX_ROUTE_ALREADY_INSTALLED')
        return
    verify_baseline(source)
    # Confirm that :3098 actually implements the UI catalogue contract
    # before allowing any routing change.
    count=get_catalogue(UPSTREAM_URL)
    updated=source.replace(ANCHOR,ROUTE+ANCHOR,1)
    if (updated.count(ROUTE)!=1 or
        updated.replace(ROUTE,'',1)!=source or
        updated.count('proxy_pass http://127.0.0.1:3010;')!=source.count('proxy_pass http://127.0.0.1:3010;')):
        raise SystemExit('STOP: Nginx rewrite invariant failed')
    BACKUPS.mkdir(parents=True,exist_ok=True,mode=0o700)
    backup=BACKUPS/('nginx-casino-catalogue-'+time.strftime('%Y%m%dT%H%M%SZ',time.gmtime())+'.conf')
    with backup.open('xb') as f:
        f.write(original);f.flush();os.fsync(f.fileno())
    backup.chmod(0o600)
    installed=False
    try:
        atomic_write(target,updated.encode('utf-8'),stat.S_IMODE(info.st_mode))
        installed=True
        cmd(['/usr/sbin/nginx','-t'])
        cmd(['/usr/bin/systemctl','reload','nginx'])
        wait_for_catalogue(LOCAL_URL,local_tls=True)
    except Exception:
        if installed:
            atomic_write(target,original,stat.S_IMODE(info.st_mode))
            cmd(['/usr/sbin/nginx','-t'])
            cmd(['/usr/bin/systemctl','reload','nginx'])
        raise
    print('PREVIOUS_NGINX_CONFIG_BACKED_UP:',backup)
    print('CASINO_CATALOGUE_UPSTREAM_CONTRACT_VERIFIED')
    print('CASINO_GAMES_ROUTE_CONNECTED_TO_3098')
    print('LOCAL_HTTPS_CATALOGUE_VERIFIED')
    print('NGINX_TESTED_AND_RELOADED_NO_PM2_RESTARTS')
    print('CATALOGUE_SAMPLE_ITEM_COUNT:',count)
    print('KYC_CASINO_LAUNCH_WALLET_AND_WEB_UPSTREAM_UNCHANGED')

if __name__=='__main__':
    main()
