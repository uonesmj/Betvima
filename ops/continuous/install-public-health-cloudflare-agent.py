#!/usr/bin/env python3
"""Pinned, one-time production health-check User-Agent patch.

Fixes Cloudflare 403 for Python-urllib probes ONLY; preserves all response,
build-ID, readiness and unauthenticated wallet/bet assertions.

Updates ONLY the root-owned deployment controller Python file. Makes a private
rollback copy first. Does not reload Nginx, restart services, run migrations,
modify PM2, or touch any casino, wallet or settlement process.
"""
import ast
import hashlib
import os
import pathlib
import stat
import tempfile
import time

TARGET = pathlib.Path('/usr/local/lib/betvima-continuous/production.py')
BACKUPS = pathlib.Path('/root/betvima-backups')
OLD_BLOB = '063aa086e81fa9a6dc7bcc7f2efd38e29d13dadf'
NEW_BLOB = '83b91ce1bb2ce1a88f0de714329c030cf4f4000a'
PATCHES = (
    (
        "def health(base,build):\n    for path in",
        """def health(base,build):
    # Cloudflare returns 403 to Python-urllib's default UA on the public site,
    # but responds 200 to the verified curl/8.5.0 probe. Preserve all status,
    # build-identity, ready, and unauthenticated financial guard assertions.
    public_agent={'User-Agent':'curl/8.5.0'} if base=='https://betvima.com' else {}
    for path in""",
    ),
    (
        "req=urllib.request.Request(base+path,headers={'Host':'betvima.com','Cache-Control':'no-cache','Connection':'close'})",
        "req=urllib.request.Request(base+path,headers={'Host':'betvima.com','Cache-Control':'no-cache','Connection':'close',**public_agent})",
    ),
    (
        "try:urllib.request.urlopen(urllib.request.Request(base+path,headers={'Host':'betvima.com'}),timeout=15)",
        "try:urllib.request.urlopen(urllib.request.Request(base+path,headers={'Host':'betvima.com',**public_agent}),timeout=15)",
    ),
)

def git_blob(data):
    return hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()

def verify_policy(source):
    tree=ast.parse(source)
    health=[n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='health']
    if len(health)!=1:
        raise RuntimeError('HEALTH_FUNCTION_NOT_UNIQUE')
    code=ast.get_source_segment(source,health[0])
    if not code or code.count('**public_agent')!=2:
        raise RuntimeError('HEALTH_REQUESTS_INCONSISTENT')
    required=(
        "public_agent={'User-Agent':'curl/8.5.0'} if base=='https://betvima.com' else {}",
        "if response.status!=200:raise ValueError('health_failed')",
        "if path=='/' and build.encode() not in body:raise ValueError('identity_failed')",
        "if path=='/api/health/ready' and json.loads(body).get('ready') is not True:raise ValueError('not_ready')",
        "if error.code==401:continue",
        "raise ValueError('financial_auth_guard_failed')",
    )
    if not all(term in code for term in required):
        raise RuntimeError('HEALTH_SECURITY_POLICY_CHANGED')

def replace_atomic(path, data, mode):
    fd, tmp=tempfile.mkstemp(prefix='.betvima-public-health-',dir=path.parent)
    try:
        with os.fdopen(fd,'wb') as f:
            f.write(data);f.flush();os.fsync(f.fileno())
        os.chown(tmp,0,0);os.chmod(tmp,mode);os.replace(tmp,path)
    finally:
        if os.path.exists(tmp):os.unlink(tmp)

def main():
    if os.geteuid()!=0:raise SystemExit('STOP: administrator required')
    if not TARGET.is_file() or TARGET.is_symlink():
        raise SystemExit('STOP: untrusted installed controller')
    info=TARGET.stat()
    if info.st_uid!=0 or not stat.S_ISREG(info.st_mode) or info.st_mode & 0o022:
        raise SystemExit('STOP: controller owner/mode mismatch')
    original=TARGET.read_bytes()
    found=git_blob(original)
    if found==NEW_BLOB:
        verify_policy(original.decode('utf-8'))
        print('PUBLIC_HEALTH_AGENT_ALREADY_PATCHED')
        return
    if found!=OLD_BLOB:
        raise SystemExit('STOP: installed controller blob differs from reviewed version')
    before=original.decode('utf-8')
    after=before
    for previous,replacement in PATCHES:
        if after.count(previous)!=1:
            raise SystemExit('STOP: unexpected controller structure; no changes made')
        after=after.replace(previous,replacement,1)
    revised=after.encode('utf-8')
    if git_blob(revised)!=NEW_BLOB:
        raise SystemExit('STOP: resulting controller differs from approved blob')
    verify_policy(after)
    compile(after,str(TARGET),'exec')
    BACKUPS.mkdir(parents=True,exist_ok=True,mode=0o700)
    backup=BACKUPS/('production-public-health-'+time.strftime('%Y%m%dT%H%M%SZ',time.gmtime())+'.py')
    with backup.open('xb') as f:
        f.write(original);f.flush();os.fsync(f.fileno())
    backup.chmod(0o600)
    try:
        replace_atomic(TARGET,revised,stat.S_IMODE(info.st_mode))
        if git_blob(TARGET.read_bytes())!=NEW_BLOB:
            raise RuntimeError('CONTROLLER_POST_PATCH_HASH_MISMATCH')
    except Exception:
        replace_atomic(TARGET,original,stat.S_IMODE(info.st_mode))
        raise
    print('PREVIOUS_CONTROLLER_BACKED_UP:',backup)
    print('CLOUDFLARE_PUBLIC_HEALTH_AGENT_PATCHED')
    print('ALL_HEALTH_AND_FINANCIAL_GUARDS_PRESERVED')
    print('NO_NGINX_PM2_CASINO_WALLET_RESTARTS')
    print('Production deployment still needs a separately owner-approved workflow')

if __name__=='__main__':main()
