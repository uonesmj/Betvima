"""Windows login task: debounce local source edits, send only safe files to preview.

The dedicated SSH key can update isolated preview source only, never production.
"""
import hashlib, io, json, os, pathlib, re, subprocess, tarfile, time

REPO=pathlib.Path(__file__).resolve().parents[2]
STATE=pathlib.Path(os.environ['LOCALAPPDATA'])/'BetvimaPreview'
KEY=pathlib.Path.home()/'.ssh/betvima_codex_preview_ed25519'
SKIP={'.git','.next','node_modules','.aws','.ssh','.codex','.agents','backups','logs','coverage','playwright-report','test-results','__pycache__'}

def permitted(path):
    relative=path.relative_to(REPO)
    if any(p in SKIP or p.startswith('.env') for p in relative.parts):return False
    if path.suffix.lower() in ('.apk','.pem','.key','.secret','.pfx','.p12','.log','.zip','.tgz','.gz','.bak','.tsbuildinfo','.png','.jpg','.jpeg','.webp','.mp4'):
        # Public image assets are needed, private/screenshots at repository root are not.
        if relative.parts[0]!='public' or path.suffix.lower() not in ('.png','.jpg','.jpeg','.webp'):return False
    if any(w in path.name.lower() for w in ('private-key','credentials','.before','.pre-','.bak-')):return False
    return not path.is_symlink()

def files():
    for root,dirs,names in os.walk(REPO):
        dirs[:]=[d for d in dirs if d not in SKIP and not d.startswith('.env')]
        for name in names:
            path=pathlib.Path(root)/name
            if permitted(path):yield path

def signature():
    h=hashlib.sha256()
    for path in sorted(files()):
        stat=path.stat();h.update(str(path.relative_to(REPO)).encode());h.update(str((stat.st_size,stat.st_mtime_ns)).encode())
    return h.hexdigest()

def snapshot(remote=None):
    stream=io.BytesIO()
    current={}
    with tarfile.open(fileobj=stream,mode='w:gz') as archive:
        for path in sorted(files()):
            data=path.read_bytes()
            if re.search(rb'(?m)^-----BEGIN (?:OPENSSH |RSA |EC )?PRIVATE KEY-----\r?$',data):raise ValueError('private_key_found_snapshot_refused')
            name=path.relative_to(REPO).as_posix();current[name]=hashlib.sha256(data).hexdigest()
            if remote is not None and remote.get(name)==current[name]:continue
            member=tarfile.TarInfo(name);member.size=len(data);member.mode=0o644
            archive.addfile(member,io.BytesIO(data))
        if remote is not None:
            data=json.dumps(sorted(current)).encode();member=tarfile.TarInfo('.preview-manifest.json');member.size=len(data);member.mode=0o644;archive.addfile(member,io.BytesIO(data))
    return (stream.getvalue(),current) if remote is not None else stream.getvalue()

def send(data):
    args=['ssh','-i',str(KEY),'-o','IdentitiesOnly=yes','-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-o','ServerAliveInterval=20','-o','ConnectTimeout=10','-T','betvima_preview_sync@159.198.76.199']
    result=subprocess.run(args,input=data,capture_output=True,timeout=600,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
    if result.returncode:raise ValueError('preview_sync_failed')
    payload=json.loads(result.stdout)
    if payload.get('sync') not in ('accepted','manifest'):raise ValueError('preview_sync_rejected')
    return payload

def main():
    import ctypes
    STATE.mkdir(parents=True,exist_ok=True)
    create=ctypes.windll.kernel32.CreateMutexW;create.restype=ctypes.c_void_p
    mutex=create(None,True,'Local\\BetvimaPreviewWatch')
    if not mutex:raise RuntimeError('watcher_mutex_failed')
    if ctypes.windll.kernel32.GetLastError()==183:return
    (STATE/'status.json').write_text(json.dumps({'watcher':'running','pid':os.getpid(),'at':int(time.time())}))
    sent=None;last=None;changed=0;remote=None
    while True:
        try:
            current=signature()
            if current!=last:last=current;changed=time.monotonic()
            if current!=sent and time.monotonic()-changed>=3:
                if remote is None:remote=send(b'{"action":"manifest"}')['files']
                data,new_remote=snapshot(remote)
                if signature()!=current:continue
                report=send(data);sent=current;remote=new_remote
                (STATE/'status.json').write_text(json.dumps({**report,'pid':os.getpid(),'last_synced':int(time.time())}))
            time.sleep(2)
        except Exception:
            remote=None;(STATE/'status.json').write_text(json.dumps({'sync':'retrying','pid':os.getpid(),'details':'suppressed','at':int(time.time())}));time.sleep(20)

if __name__=='__main__':main()
