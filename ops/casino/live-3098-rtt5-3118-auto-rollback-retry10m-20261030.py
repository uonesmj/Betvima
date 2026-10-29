#!/usr/bin/env python3
"""Fail-closed, 10-minute LIVE CALLBACK-only 3098->3118 pilot.
Starts audited candidate on loopback, pre-checks unsigned requests, schedules
automatic rollback BEFORE the Nginx change. Never changes financial/geo/KYC
code, DB data, SSL settings, site routes or other ports.
Only start/revert actions; manual revert:
  sudo python3 /root/betvima-rtt5-retry10m-watchdog.py revert
"""
from __future__ import annotations
import hashlib, json, os, pwd, re, shutil, signal, socket, subprocess, sys, tempfile, time
from pathlib import Path
from urllib.request import urlopen

LIVE = Path('/opt/nova-releases/casino-3098-eligible-fallback-HU6Rbl')
CAND = Path('/opt/nova-releases/casino-rtt5-3098-candidate-20261030')
CONF = Path('/etc/nginx/sites-enabled/betvima.com').resolve()
ROOT = Path('/root/betvima-rtt5-retry10m-20261030')
BACKUP = ROOT / 'nginx-before.conf'
WATCHDOG = Path('/root/betvima-rtt5-retry10m-watchdog.py')
LOG = ROOT / 'candidate.log'
PIDFILE = ROOT / 'candidate.pid'
OLD_PORT, NEW_PORT = 3098, 3118
PATTERN = re.compile(
    r'(location\s+\^~\s+/api/webhooks/softaggregator\s*\{[^{}]*?\bproxy_pass\s+'
    r'http://127\.0\.0\.1:)(\d+)(\s*;)', re.S)
HASHES = {
    LIVE / 'src/server/db/postgres.ts':
        '3d66c5724ff67ebdbc160ca56fb05e1597ebf38f48a7d01b3482bccae01916a3',
    LIVE / 'src/server/providers/softaggregator/wallet.ts':
        '9df555a7e3f04354019435e8e9318675587eb9b401422c0e70e7cc16727ff5af',
    CAND / 'src/server/db/postgres.ts':
        '9d1d664c519bbaf05a1af076865d385f800e3ea481f7e7783ab0019b6234c2db',
    CAND / 'src/app/api/webhooks/softaggregator/route.ts':
        '82137036c2e67f27d6c1292d369d271bbea03e23dd492c95582655234cbd53d2',
    CAND / 'src/server/providers/softaggregator/perf-trace.ts':
        '689814835db49e153bb7cf0d9020f4a1587f01b8ef1033d0a5b1ebc246db9f87'
}

def refuse(reason):
    raise SystemExit('REFUSED: ' + reason)

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def current():
    if not CONF.is_file(): refuse('nginx site not found')
    s = CONF.read_text()
    all_matches = list(PATTERN.finditer(s))
    if len(all_matches) != 1: refuse('expected one exact callback location')
    return s, all_matches[0], int(all_matches[0].group(2))

def write_atomic(content):
    st = CONF.stat()
    fd, name = tempfile.mkstemp(dir=str(CONF.parent), prefix='.casino-rtt5-', text=True)
    try:
        with os.fdopen(fd, 'w') as f:
            f.write(content)
        os.chmod(name, st.st_mode)
        os.chown(name, st.st_uid, st.st_gid)
        os.replace(name, CONF)
    finally:
        if os.path.exists(name): os.unlink(name)

def run(args, timeout=15):
    return subprocess.run(args, capture_output=True, text=True, timeout=timeout)

def switch(expected, target):
    old, m, port = current()
    if port != expected: refuse('callback route changed: expected port ' + str(expected))
    new = old[:m.start(2)] + str(target) + old[m.end(2):]
    write_atomic(new)
    good = run(['nginx', '-t'])
    if good.returncode != 0:
        write_atomic(old)
        refuse('nginx syntax failure, original config restored')
    good = run(['systemctl', 'reload', 'nginx'])
    if good.returncode != 0:
        write_atomic(old)
        run(['nginx', '-t'])
        run(['systemctl', 'reload', 'nginx'])
        refuse('nginx reload failed, original config restored')

def stop_candidate():
    if not PIDFILE.is_file(): return
    try:
        pid = int(PIDFILE.read_text().strip())
        if pid < 2: return
        if Path(f'/proc/{pid}/cwd').resolve() != CAND: return
        os.killpg(pid, signal.SIGTERM)
    except (ValueError, ProcessLookupError, PermissionError, FileNotFoundError):
        pass

def revert():
    _, _, port = current()
    if port == NEW_PORT:
        switch(NEW_PORT, OLD_PORT)
        print('AUTO_ROLLBACK_COMPLETE: CALLBACK_3098', flush=True)
    elif port == OLD_PORT:
        print('CALLBACK_ALREADY_3098', flush=True)
    else:
        refuse('callback changed independently, refusing to overwrite it')
    stop_candidate()

def live_pid():
    s = run(['ss', '-ltnpH'])
    if s.returncode != 0: refuse('cannot identify production PID')
    pids = re.findall(r':3098\s+[^\n]*?pid=(\d+)', s.stdout)
    if len(pids) != 1: refuse('cannot identify exactly one 3098 listener')
    pid = int(pids[0])
    if Path(f'/proc/{pid}/cwd').resolve() != LIVE:
        refuse('3098 process not in pinned live release')
    return pid

def active_env(pid):
    env = {}
    for item in Path(f'/proc/{pid}/environ').read_bytes().split(b'\0'):
        if b'=' in item:
            a, b = item.split(b'=', 1)
            env[os.fsdecode(a)] = os.fsdecode(b)
    needed = ('NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
              'SUPABASE_SERVICE_ROLE_KEY', 'NEXT_PUBLIC_SITE_URL',
              'NODE_EXTRA_CA_CERTS')
    if any(not env.get(k) for k in needed): refuse('active service env incomplete')
    if env.get('NODE_TLS_REJECT_UNAUTHORIZED') == '0':
        refuse('unsafe TLS setting')
    env.update({
        'PORT': str(NEW_PORT), 'HOSTNAME': '127.0.0.1',
        'NODE_ENV': 'production', 'NEXT_TELEMETRY_DISABLED': '1',
        'NODE_OPTIONS': '--max-old-space-size=1536',
        'SOFTAGGREGATOR_CALLBACK_PERF_TRACE': 'true'
    })
    return env

def unsigned_rejected(port):
    url = f'http://127.0.0.1:{port}/api/webhooks/softaggregator'
    with urlopen(url, timeout=10) as response:
        if response.status != 200 or json.load(response) != {'error': 2, 'balance': 0}:
            refuse(f'unsigned callback not rejected on {port}')

def start():
    if ROOT.exists() or WATCHDOG.exists():
        refuse('retry10m directory/watchdog already exists; preserve prior records')
    older = run(['systemctl', 'is-active', 'betvima-rtt5-autorevert-20261030.timer'])
    if older.stdout.strip() == 'active':
        refuse('previous five-minute auto-revert timer still active')

    if not LIVE.is_dir() or not CAND.is_dir() or CAND.is_symlink():
        refuse('candidate or live release invalid')
    for path, expected in HASHES.items():
        if not path.is_file() or sha(path) != expected:
            refuse('source hash mismatch: ' + str(path))
    for name in ('wallet.ts', 'fiat-wallet.ts'):
        rel = Path('src/server/providers/softaggregator') / name
        if (LIVE / rel).read_bytes() != (CAND / rel).read_bytes():
            refuse('financial source differs: ' + name)
    if not (CAND / '.next/BUILD_ID').is_file():
        refuse('candidate production build missing')
    if (CAND / '.next/BUILD_ID').read_text().strip() != 'Rc2tySmBIrO3fV7EI7W8u':
        refuse('unexpected candidate build ID')
    if (CAND / 'node_modules').is_symlink():
        refuse('candidate dependencies are not isolated')
    initial, _, port = current()
    if port != OLD_PORT: refuse('live callback not on expected 3098')
    # Prevent collisions with any other nginx route and any listener.
    nginx = run(['nginx', '-T'], timeout=20)
    if nginx.returncode != 0 or re.search(r'\b3118\b', nginx.stdout):
        refuse('candidate port already referenced by nginx or nginx -T failed')
    with socket.socket() as sock:
        try: sock.bind(('127.0.0.1', NEW_PORT))
        except OSError: refuse('candidate loopback port is already taken')
    pid = live_pid()
    env = active_env(pid)
    unsigned_rejected(OLD_PORT)

    ROOT.mkdir(mode=0o700)
    shutil.copy2(CONF, BACKUP)
    shutil.copy2(Path(__file__), WATCHDOG)
    os.chmod(WATCHDOG, 0o700)
    user = pwd.getpwnam('novaadmin')
    with LOG.open('wb') as stream:
        os.chmod(LOG, 0o600)
        p = subprocess.Popen(
            ['/usr/bin/node', 'node_modules/next/dist/bin/next', 'start',
             '-H', '127.0.0.1', '-p', str(NEW_PORT)],
            cwd=CAND, env=env, user=user.pw_uid, group=user.pw_gid,
            stdout=stream, stderr=subprocess.STDOUT, start_new_session=True
        )
    PIDFILE.write_text(str(p.pid))
    os.chmod(PIDFILE, 0o600)
    try:
        limit = time.monotonic() + 35
        while time.monotonic() < limit:
            if p.poll() is not None: refuse('candidate server crashed')
            try:
                with urlopen(f'http://127.0.0.1:{NEW_PORT}/api/v1/casino/games?page=1&limit=1',
                             timeout=4) as r:
                    if r.status == 200: break
            except Exception:
                time.sleep(1)
        else: refuse('candidate startup timeout')
        unsigned_rejected(NEW_PORT)
        # Never route a signed callback until auto-revert is confirmed active.
        timer = 'betvima-rtt5-retry10m-autorevert-20261030'
        r = run(['systemd-run', '--quiet', '--unit=' + timer,
                 '--on-active=10m', '/usr/bin/python3', str(WATCHDOG), 'revert'])
        if r.returncode != 0: refuse('rollback timer registration failed')
        r = run(['systemctl', 'is-active', timer + '.timer'])
        if r.returncode != 0 or r.stdout.strip() != 'active':
            refuse('rollback timer not active')
        # Safety checks immediately before switching.
        if live_pid() != pid: refuse('production 3098 process changed')
        if current()[0] != initial: refuse('nginx configuration changed')
        switch(OLD_PORT, NEW_PORT)
    except BaseException:
        stop_candidate()
        raise
    print('CANARY_ON_3118: only signed casino callback location switched')
    print('AUTO_ROLLBACK_IN_10_MINUTES: to 3098')
    print('MANUAL_ROLLBACK: sudo python3 /root/betvima-rtt5-retry10m-watchdog.py revert')
    print('TRACE_LOG: /root/betvima-rtt5-retry10m-20261030/candidate.log')
    print('NO_FINANCIAL_SOURCE_OR_POLICY_CHANGES', flush=True)

if __name__ == '__main__':
    if len(sys.argv) != 2 or sys.argv[1] not in ('start', 'revert'):
        refuse('use: start | revert')
    if os.geteuid() != 0: refuse('root required')
    if sys.argv[1] == 'start': start()
    else: revert()
