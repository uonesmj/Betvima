#!/usr/bin/env python3
"""One-time, narrow root-owned production preflight patch.

- Never executes candidate code as root.
- Preserves web routing, financial workers, database and Nginx.
- Refuses drift: exact historical preflight block must match.
- Backs up previous production.py, verifies syntax/policy, and atomically swaps.
"""
import ast
import os
import pathlib
import re
import stat
import tempfile
import time

TARGET = pathlib.Path('/usr/local/lib/betvima-continuous/production.py')
BACKUPS = pathlib.Path('/root/betvima-backups')
LEGACY = r"""    current=set(re.findall(r'proxy_pass http://127\.0\.0\.1:(\d+);',route))
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
"""
REPLACEMENT = """    apps=json.loads(pm2(['jlist']))
    old,oldport=resolve_active_web_upstream(route,apps)
"""
HELPER = r"""def resolve_active_web_upstream(route, apps):
    """ + '"""' + r"""Select only the PM2-managed web process actually routed by Nginx.

    Casino and other dedicated upstreams are allowed in the same vhost, but
    never used as the web rollback target. Fail closed on missing/ambiguous web.
    """ + '"""' + r"""
    routed_ports = {int(port) for port in re.findall(
        r'proxy_pass http://127\.0\.0\.1:(\d+);', route)}
    if not routed_ports:
        raise ValueError('ambiguous_current_upstream')
    websites = []
    for app in apps:
        meta = app.get('pm2_env', {})
        if not str(app.get('name', '')).startswith('nova-cd-') or meta.get('status') != 'online':
            continue
        try:
            port = int(meta.get('PORT', 0) or 0)
        except (ValueError, TypeError):
            continue
        if port in routed_ports:
            websites.append((app, port))
    if len(websites) != 1:
        raise ValueError('active_web_not_identified')
    return websites[0]


"""

def policy_check(contents):
    root = ast.parse(contents)
    matches = [n for n in root.body
               if isinstance(n, ast.FunctionDef) and n.name == 'resolve_active_web_upstream']
    if len(matches) != 1:
        raise RuntimeError('INVALID_ROUTED_WEB_SELECTION')
    safe = ast.Module(body=matches, type_ignores=[])
    namespace = {'re': re}
    exec(compile(safe, '<pure-preflight-validation>', 'exec'), namespace)
    resolver = namespace['resolve_active_web_upstream']
    website = {'name':'nova-cd-production','pm2_env':{'status':'online','PORT':3007}}
    casino = {'name':'betvima-casino','pm2_env':{'status':'online','PORT':3098}}
    conf = ('location / { proxy_pass http://127.0.0.1:3007; }\n'
            'location /api/casino/ { proxy_pass http://127.0.0.1:3098; }')
    chosen, oldport = resolver(conf, [casino, website])
    if chosen is not website or oldport != 3007:
        raise RuntimeError('WEB_SELECTED_INCORRECTLY')
    modified = conf.replace('proxy_pass http://127.0.0.1:3007;',
                            'proxy_pass http://127.0.0.1:3010;')
    if 'proxy_pass http://127.0.0.1:3098;' not in modified:
        raise RuntimeError('CASINO_ROUTE_WOULD_CHANGE')
    try:
        resolver(conf, [casino, website, {'name':'nova-cd-second',
                 'pm2_env':{'status':'online','PORT':3098}}])
    except ValueError as err:
        if str(err) != 'active_web_not_identified':
            raise
    else:
        raise RuntimeError('AMBIGUOUS_WEB_NOT_REJECTED')

def safe_write(target, contents, mode):
    fd, name = tempfile.mkstemp(prefix='.production-preflight-patch-',dir=target.parent)
    try:
        with os.fdopen(fd, 'wb') as file:
            file.write(contents)
            file.flush()
            os.fsync(file.fileno())
        os.chown(name, 0, 0)
        os.chmod(name, mode)
        os.replace(name, target)
    finally:
        if os.path.exists(name):
            os.unlink(name)

def main():
    if os.geteuid() != 0:
        raise SystemExit('ERROR: administrator required')
    if not TARGET.is_file() or TARGET.is_symlink():
        raise SystemExit('ERROR: unsafe controller target')
    info = TARGET.stat()
    if info.st_uid != 0 or not stat.S_ISREG(info.st_mode) or info.st_mode & 0o022:
        raise SystemExit('ERROR: controller ownership/mode unexpected')
    original = TARGET.read_bytes()
    text = original.decode('utf-8')
    if LEGACY not in text:
        if 'old,oldport=resolve_active_web_upstream(route,apps)' in text:
            policy_check(text)
            print('PREFLIGHT_ALREADY_PATCHED')
            return
        raise SystemExit('ERROR: unexpected controller revision; no changes made')
    if text.count(LEGACY) != 1 or text.count('def main(sha):') != 1 \
       or 'def resolve_active_web_upstream(' in text:
        raise SystemExit('ERROR: multiple/mismatched targets; no changes made')
    revised = text.replace(LEGACY, REPLACEMENT).replace('def main(sha):',HELPER+'def main(sha):')
    policy_check(revised)
    compile(revised, str(TARGET), 'exec')
    # Original production deployer code is backed up before the exact two-site
    # patch, under a private directory independent of release deployment.
    BACKUPS.mkdir(mode=0o700, parents=True, exist_ok=True)
    path = BACKUPS / ('production-preflight-'+time.strftime('%Y%m%dT%H%M%SZ',time.gmtime())+'.py')
    with path.open('xb') as stream:
        stream.write(original)
        stream.flush()
        os.fsync(stream.fileno())
    path.chmod(0o600)
    try:
        safe_write(TARGET, revised.encode('utf-8'), stat.S_IMODE(info.st_mode))
        policy_check(TARGET.read_text())
    except Exception:
        safe_write(TARGET, original, stat.S_IMODE(info.st_mode))
        raise
    print('PREVIOUS_CONTROLLER_BACKED_UP:',path)
    print('PREFLIGHT_WEB_SELECTION_PATCHED')
    print('NGINX_PM2_WALLET_CASINO_UNCHANGED')
    print('NOTE: Production release requires separate owner-approved workflow.')

if __name__=='__main__':
    main()
