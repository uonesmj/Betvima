#!/usr/bin/env python3
"""Fail-closed, 3-minute V3 ordinary-Debit-optimized callback canary (3098->3127).
Starts audited candidate on loopback, pre-checks unsigned requests, schedules
automatic rollback BEFORE the Nginx change. Never changes financial/geo/KYC
code, wallet policies, SSL settings, other site routes or ports. User spins
are real financial transactions, and are NOT reverted by routing rollback.
Only start/revert/watch actions; manual revert:
  sudo python3 /root/betvima-debit-v3-canary-watchdog-20261030.py revert
"""
from __future__ import annotations
import hashlib, json, os, pwd, re, shutil, signal, socket, subprocess, sys, tempfile, time
from pathlib import Path
from urllib.request import urlopen

LIVE = Path('/opt/nova-releases/casino-3098-eligible-fallback-HU6Rbl')
CAND = Path('/opt/nova-releases/casino-debit-v3-3098-candidate-20261030')
CONF = Path('/etc/nginx/sites-enabled/betvima.com').resolve()
ROOT = Path('/root/betvima-debit-v3-canary-20261030')
BACKUP = ROOT / 'nginx-before.conf'
WATCHDOG = Path('/root/betvima-debit-v3-canary-watchdog-20261030.py')
LOG = ROOT / 'candidate.log'
PIDFILE = ROOT / 'candidate.pid'
OLD_PORT, NEW_PORT = 3098, 3127
PATTERN = re.compile(
    r'(location\s+\^~\s+/api/webhooks/softaggregator\s*\{[^{}]*?\bproxy_pass\s+'
    r'http://127\.0\.0\.1:)(\d+)(\s*;)', re.S)
HASHES = {
    LIVE / 'src/server/providers/softaggregator/wallet.ts':
        '9df555a7e3f04354019435e8e9318675587eb9b401422c0e70e7cc16727ff5af',
    CAND / 'src/server/providers/softaggregator/wallet.ts':
        '0e536e0c790666782b565dae8919b67f4afd02b585ba51229bb10dd78431bb02',
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
    fd, name = tempfile.mkstemp(dir=str(CONF.parent), prefix='.casino-debit-v3-', text=True)
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

def watch():
    # Independent local health watcher: revert early if the test service exits.
    # The three-minute systemd timer remains the main automatic rollback.
    for _ in range(135):
        time.sleep(2)
        try:
            _, _, port = current()
            if port == OLD_PORT:
                return
            if port != NEW_PORT:
                return  # Other operator changed routing; do not interfere.
            pid = int(PIDFILE.read_text().strip())
            if not Path(f'/proc/{pid}/cwd').resolve() == CAND:
                revert()
                return
            with socket.create_connection(('127.0.0.1', NEW_PORT), timeout=2):
                pass
        except Exception:
            try:
                revert()
            except Exception:
                pass  # systemd auto-revert still scheduled and active
            return

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
        refuse('canary directory/watchdog already exists; do not overwrite previous test')
    if not LIVE.is_dir() or not CAND.is_dir() or CAND.is_symlink():
        refuse('candidate or live release invalid')
    for path, expected in HASHES.items():
        if not path.is_file() or sha(path) != expected:
            refuse('source hash mismatch: ' + str(path))
    # The production V3 source was built by COPYING running 3098 source,
    # replacing exactly one wallet.ts block. Every other src file must have
    # exactly the same hash. Prevents limits, geo, KYC, Credit, Rollback edits.
    def source_hashes(base):
        return {str(p.relative_to(base)): sha(p)
                for p in (base / 'src').rglob('*') if p.is_file()}
    original = source_hashes(LIVE)
    candidate = source_hashes(CAND)
    key = 'src/server/providers/softaggregator/wallet.ts'
    if set(original) != set(candidate):
        refuse('source tree changed, refusing live canary')
    if original[key] != HASHES[LIVE / key] or candidate[key] != HASHES[CAND / key]:
        refuse('Debit-only source hash changed')
    candidate[key] = original[key]
    if original != candidate:
        refuse('non-Debit source differs; refusing live canary')
    if CAND.joinpath('node_modules').is_symlink() is False:
        refuse('candidate dependency link missing')
    if CAND.joinpath('node_modules').resolve() != Path(
        '/opt/nova-releases/casino-rtt5-3098-candidate-20261030/node_modules'):
        refuse('isolated candidate dependencies changed')
    if not CAND.joinpath('node_modules/next/dist/bin/next').is_file():
        refuse('Next.js candidate dependency missing')
    if not (CAND / '.next/BUILD_ID').is_file():
        refuse('candidate production build missing')
    if (CAND / '.next/BUILD_ID').read_text().strip() != 'p84FuTIXV5wNwkhs0e3Ez':
        refuse('unexpected candidate build ID')
    # The link to audited isolated dependencies is intentionally required.
    initial, _, port = current()
    if port != OLD_PORT: refuse('live callback not on expected 3098')
    # Prevent collisions with any other nginx route and any listener.
    # This canary MUST NOT run concurrently with any other active autorevert.
    timers = run(['systemctl', 'list-timers', '--no-legend', '--no-pager'], timeout=12)
    if timers.returncode:
        refuse('unable to inspect systemd timers')
    for line in timers.stdout.splitlines():
        if ('betvima-' in line and 'autorevert' in line and
                'betvima-debit-v3-autorevert-20261030' not in line):
            refuse('another BetVima rollback timer is active')
    nginx = run(['nginx', '-T'], timeout=20)
    if nginx.returncode != 0 or re.search(r'\b3127\b', nginx.stdout):
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
        timer = 'betvima-debit-v3-autorevert-20261030'
        r = run(['systemd-run', '--quiet', '--unit=' + timer,
                 '--on-active=3m', '/usr/bin/python3', str(WATCHDOG), 'revert'])
        if r.returncode != 0: refuse('rollback timer registration failed')
        r = run(['systemctl', 'is-active', timer + '.timer'])
        if r.returncode != 0 or r.stdout.strip() != 'active':
            refuse('rollback timer not active')
        # Safety checks immediately before switching.
        if live_pid() != pid: refuse('production 3098 process changed')
        if current()[0] != initial: refuse('nginx configuration changed')
        switch(OLD_PORT, NEW_PORT)
        # This observer uses no credentials or database privileges.
        with (ROOT / 'watcher.log').open('wb') as monitor_output:
            os.chmod(ROOT / 'watcher.log', 0o600)
            subprocess.Popen(
                ['/usr/bin/python3', str(WATCHDOG), 'watch'],
                stdout=monitor_output, stderr=subprocess.STDOUT,
                start_new_session=True,
            )
    except BaseException:
        # Timer was registered before any route change. If switching itself
        # succeeded and a later step failed, restore 3098 first.
        try:
            _, _, now_port = current()
            if now_port == NEW_PORT:
                switch(NEW_PORT, OLD_PORT)
        finally:
            stop_candidate()
        raise
    print('V3_CANARY_ON_3127: signed casino callback only; all other site routes stay on 3098')
    print('AUTO_ROLLBACK_IN_3_MINUTES: to 3098')
    print('MANUAL_ROLLBACK: sudo python3 /root/betvima-debit-v3-canary-watchdog-20261030.py revert')
    print('TRACE_LOG: /root/betvima-debit-v3-canary-20261030/candidate.log')
    print('NO_LIMIT_GEO_KYC_PAYMENT_LEDGER_OR_RECEIPT_CHANGES', flush=True)

if __name__ == '__main__':
    if len(sys.argv) != 2 or sys.argv[1] not in ('start', 'revert', 'watch'):
        refuse('use: start | revert')
    if os.geteuid() != 0: refuse('root required')
    if sys.argv[1] == 'start': start()
    elif sys.argv[1] == 'watch': watch()
    else: revert()
