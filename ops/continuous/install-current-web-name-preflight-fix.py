#!/usr/bin/env python3
"""Pin-verified, one-time patch for the *installed* root-owned deployment controller.

Makes a single exact replacement inside production.py, with private rollback,
pure resolver self-tests and no Nginx/PM2/service/database operations.
"""
import ast
import hashlib
import os
import pathlib
import re
import stat
import tempfile
import time

TARGET = pathlib.Path('/usr/local/lib/betvima-continuous/production.py')
BACKUP_DIR = pathlib.Path('/root/betvima-backups')
OLD_BLOB = 'a427301dffa4931fed8d09acd0174b9f7210b1e9'
NEW_BLOB = '063aa086e81fa9a6dc7bcc7f2efd38e29d13dadf'
OLD = """        if not str(app.get('name', '')).startswith('nova-cd-') or meta.get('status') != 'online':
            continue"""
NEW = """        # The current web release predates the nova-cd naming convention.
        # This is its verified legacy web prefix, not a generic nova-casino
        # wildcard: the separate casino API on 3098 must never be selected.
        name = str(app.get('name', ''))
        trusted_web_name = (
            name.startswith('nova-cd-') or
            re.fullmatch(r'nova-casino-weekly-kyc-prod-[A-Za-z0-9]{8}', name) is not None
        )
        if not trusted_web_name or meta.get('status') != 'online':
            continue"""

def git_blob(data):
    return hashlib.sha1(b'blob '+str(len(data)).encode()+b'\x00'+data).hexdigest()

def verify_resolver(source):
    tree = ast.parse(source)
    pure = [n for n in tree.body if isinstance(n,ast.FunctionDef)
            and n.name=='resolve_active_web_upstream']
    if len(pure)!=1:
        raise RuntimeError('RESOLVER_MISSING_OR_AMBIGUOUS')
    scope={'re': re}
    exec(compile(ast.Module(body=pure,type_ignores=[]),'pure-routing-test.py','exec'),scope)
    func=scope['resolve_active_web_upstream']
    web={'name':'nova-casino-weekly-kyc-prod-TKiHSG0g',
         'pm2_env':{'status':'online','PORT':'3007'}}
    casino={'name':'nova-casino-latency-prod-fBZdwWTK',
            'pm2_env':{'status':'online','PORT':'3098'}}
    other={'name':'nova-cd-219456d7a10e',
           'pm2_env':{'status':'online','PORT':'3008'}}
    route=('location / { proxy_pass http://127.0.0.1:3007; }\n'
           'location /api/casino/ { proxy_pass http://127.0.0.1:3098; }')
    selected,port=func(route,[casino,other,web])
    if selected is not web or port!=3007:
        raise RuntimeError('WEB_SELECTED_INCORRECTLY')
    changed=route.replace('proxy_pass http://127.0.0.1:3007;',
                          'proxy_pass http://127.0.0.1:3010;')
    if 'proxy_pass http://127.0.0.1:3098;' not in changed:
        raise RuntimeError('CASINO_ROUTE_WOULD_CHANGE')
    for items in ([casino],[web,{'name':'nova-cd-mistaken',
                                       'pm2_env':{'status':'online','PORT':'3098'}}]):
        try:
            func(route,items)
        except ValueError as error:
            if str(error)!='active_web_not_identified':
                raise
        else:
            raise RuntimeError('MISSING_OR_AMBIGUOUS_WEB_WAS_ACCEPTED')

def atomic_replace(target,content,mode):
    fd,tmp=tempfile.mkstemp(prefix='.preflight-web-name-',dir=target.parent)
    try:
        with os.fdopen(fd,'wb') as out:
            out.write(content);out.flush();os.fsync(out.fileno())
        os.chown(tmp,0,0)
        os.chmod(tmp,mode)
        os.replace(tmp,target)
    finally:
        if os.path.exists(tmp):os.unlink(tmp)

def main():
    if os.geteuid()!=0:
        raise SystemExit('STOP: administrator required')
    if not TARGET.is_file() or TARGET.is_symlink():
        raise SystemExit('STOP: unsafe installed controller')
    info=TARGET.stat()
    if info.st_uid!=0 or not stat.S_ISREG(info.st_mode) or info.st_mode & 0o022:
        raise SystemExit('STOP: controller ownership/mode failed verification')
    original=TARGET.read_bytes()
    old_sha=git_blob(original)
    if old_sha==NEW_BLOB:
        verify_resolver(original.decode('utf-8'))
        print('WEB_NAME_PREFLIGHT_ALREADY_PATCHED')
        return
    if old_sha!=OLD_BLOB:
        raise SystemExit('STOP: installed controller revision does not match reviewed baseline')
    old_text=original.decode('utf-8')
    if old_text.count(OLD)!=1:
        raise SystemExit('STOP: unexpected preflight resolver structure')
    candidate=old_text.replace(OLD,NEW).encode('utf-8')
    if git_blob(candidate)!=NEW_BLOB:
        raise SystemExit('STOP: reviewed candidate hash mismatch')
    verify_resolver(candidate.decode('utf-8'))
    BACKUP_DIR.mkdir(mode=0o700,parents=True,exist_ok=True)
    backup=BACKUP_DIR/('production-web-name-'+time.strftime('%Y%m%dT%H%M%SZ',time.gmtime())+'.py')
    with backup.open('xb') as out:
        out.write(original);out.flush();os.fsync(out.fileno())
    backup.chmod(0o600)
    try:
        atomic_replace(TARGET,candidate,stat.S_IMODE(info.st_mode))
        if git_blob(TARGET.read_bytes())!=NEW_BLOB:
            raise RuntimeError('POST_REPLACEMENT_HASH_MISMATCH')
    except Exception:
        atomic_replace(TARGET,original,stat.S_IMODE(info.st_mode))
        raise
    print('PREVIOUS_CONTROLLER_BACKED_UP:',backup)
    print('WEB_NAME_PREFLIGHT_PATCHED')
    print('WEB_3007_IDENTIFIED_CASINO_3098_EXCLUDED')
    print('NO_NGINX_PM2_CASINO_WALLET_RESTARTS')

if __name__=='__main__':
    main()
