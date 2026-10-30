#!/usr/bin/env python3
"""PRIVATE source archive, exact live/V4 parity. No DB, secrets, deploy or cutover."""
from pathlib import Path
import os, re, hashlib, tarfile, json, io, subprocess

LIVE=Path('/opt/nova-releases/casino-3098-eligible-fallback-HU6Rbl')
V4=Path('/opt/nova-releases/casino-debit-v4-3098-candidate-20261030')
OUT=Path('/root/betvima-ireland-private-source-20261030')
W='src/server/providers/softaggregator/wallet.ts'
R='src/app/api/webhooks/softaggregator/route.ts'
EXPECTED={
  LIVE/W: '9df555a7e3f04354019435e8e9318675587eb9b401422c0e70e7cc16727ff5af',
  V4/W: '0e536e0c790666782b565dae8919b67f4afd02b585ba51229bb10dd78431bb02',
  LIVE/R: 'fca89762e8ff325b229084de1c334c6a39b6ed8a9157e209131afab36556676f',
  V4/R: '5d2fc8f006fe396913ded0297223833501ff9a9e6000f5946d910c160bb6ca59',
}
BUILD='22bm4qdwFjO8ccemAMDIn'
FILES=('package.json','package-lock.json','next.config.mjs','tsconfig.json','next-env.d.ts',
       'postcss.config.js','postcss.config.mjs','tailwind.config.js','tailwind.config.ts')
SKIP={'node_modules','.git','uploads','logs','backups','backup','coverage','tmp','.cache'}
EXT=('.pem','.key','.p12','.pfx','.log','.db','.sqlite')

def fail(why): raise SystemExit('REFUSED: '+why)
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def pid():
    o=subprocess.run(['ss','-ltnpH'],capture_output=True,text=True,timeout=8)
    p=re.findall(r':3098\s+[^\n]*?pid=(\d+)',o.stdout)
    if o.returncode or len(p)!=1 or Path('/proc/'+p[0]+'/cwd').resolve()!=LIVE:
        fail('live 3098 PID/release no longer pinned')
    return p[0]
def source_manifest(base):
    result={}
    root=base/'src'
    if not root.is_dir() or root.is_symlink(): fail('source root missing')
    for p in root.rglob('*'):
        if p.is_symlink(): fail('source symlink')
        if p.is_file(): result[p.relative_to(base).as_posix()]=sha(p)
    return result
def private(p):
    parts=p.relative_to(V4).parts
    return (any(x in SKIP or x.startswith('.env') for x in parts)
        or p.name.endswith(EXT)
        or p.name in ('id_rsa','id_ed25519')
        or re.match(r'^credentials[.\-]',p.name,re.I) is not None)

if __name__=='__main__':
    if os.geteuid()!=0: fail('root required')
    if OUT.exists(): fail('private output exists; never overwrite')
    if any(not d.is_dir() or d.is_symlink() for d in (LIVE,V4)):
        fail('pinned release directory missing or symlink')
    original_pid=pid()
    for path,expected in EXPECTED.items():
        if not path.is_file() or sha(path)!=expected: fail('source SHA mismatch: '+str(path))
    build_file=V4/'.next/BUILD_ID'
    if not build_file.is_file() or build_file.read_text().strip()!=BUILD:
        fail('isolated V4 Next.js build mismatch')
    old=source_manifest(LIVE)
    new=source_manifest(V4)
    if old.keys()!=new.keys(): fail('source files changed')
    diff={x for x in old if old[x]!=new[x]}
    if diff!={W,R}: fail('unapproved source change')
    if (V4/'node_modules').resolve()!=Path(
       '/opt/nova-releases/casino-rtt5-3098-candidate-20261030/node_modules'):
       fail('V4 isolated dependencies changed')
    if not (V4/'package-lock.json').is_file(): fail('lockfile missing')
    paths=[]
    for root_name in ('src','.next','public'):
        root=V4/root_name
        if not root.exists():
            if root_name=='public': continue
            fail('runtime dir missing '+root_name)
        if root.is_symlink(): fail('symlink runtime root')
        for p in root.rglob('*'):
            if p.is_symlink(): fail('symlink runtime path')
            if p.is_file() and not private(p): paths.append(p)
    for name in FILES:
        p=V4/name
        if p.is_file(): paths.append(p)
    if not paths: fail('nothing to package')
    OUT.mkdir(mode=0o700)
    archive=OUT/'betvima-callback-v4-source-only.tar.gz'
    manifest={}
    with tarfile.open(archive,mode='w:gz') as tar:
        for p in sorted(set(paths)):
            if p.is_symlink() or private(p): fail('unsafe path')
            rel=p.relative_to(V4).as_posix()
            if p.stat().st_size>250_000_000: fail('oversized file')
            data_sha=sha(p)
            info=tar.gettarinfo(str(p),arcname=rel)
            info.uid=info.gid=0
            info.uname=info.gname=''
            info.mode=0o644
            with p.open('rb') as f: tar.addfile(info,f)
            manifest[rel]=data_sha
        report={'mode':'STAGING_ONLY_NO_LIVE_ROUTE_CHANGE','build_id':BUILD,
                'allowed_changed_source':[R,W], 'file_sha256':manifest,
                'secret_filename_exclusions_applied':True, 'compiled_bundle_secret_audit':'REQUIRED_BEFORE_TRANSFER','financial_requests_sent':0}
        data=json.dumps(report,sort_keys=True).encode('utf-8')
        item=tarfile.TarInfo('IRELAND_SOURCE_MANIFEST.json')
        item.size=len(data);item.mode=0o600
        tar.addfile(item,io.BytesIO(data))
    archive.chmod(0o600)
    if pid()!=original_pid: fail('active live PID changed; archive must be discarded')
    print('IRELAND_SOURCE_STAGED=true')
    print('ORIGINAL_SITE_AND_DB_UNCHANGED=true')
    print('SOURCE_V4_PARITY_PASS=true')
    print('BUILD_ID='+BUILD)
    print('PRIVATE_ARCHIVE_PATH='+str(archive))
    print('PRIVATE_ARCHIVE_SHA256='+sha(archive))
    print('BUNDLED_FILES='+str(len(manifest)))
    print('ENV_KEY_CERT_AND_CREDENTIAL_FILENAMES_EXCLUDED=true')
    print('COMPILED_BUNDLE_MANUAL_SECRET_REVIEW_REQUIRED=true')
    print('DO_NOT_UPLOAD_ARCHIVE_TO_GITHUB_OR_PUBLIC_STORAGE')
