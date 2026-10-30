#!/usr/bin/env python3
"""Smoke-test RTT6 separately on localhost:3119 and ALWAYS stop it.

No changes to Nginx, PM2, systemd, DB schema, financial records or production.
Read-only HTTP casino catalogue/health and deliberate unsigned rejection only.
"""
from __future__ import annotations
import hashlib, json, os, pwd, re, signal, socket, subprocess, sys, time
from pathlib import Path
from urllib.request import urlopen

LIVE = Path('/opt/nova-releases/casino-3098-eligible-fallback-HU6Rbl')
BASE = Path('/opt/nova-releases/casino-rtt5-3098-candidate-20261030')
TEST = Path('/opt/nova-releases/casino-rtt6-3098-candidate-20261030')
LOG = Path('/root/betvima-rtt6-smoke-3119-20261030.log')
PORT = 3119
EXPECTED = {
    LIVE / 'src/server/providers/softaggregator/wallet.ts':
        '9df555a7e3f04354019435e8e9318675587eb9b401422c0e70e7cc16727ff5af',
    TEST / 'src/server/providers/softaggregator/wallet.ts':
        'cb2bb59200babf0f6429c0ab565bdbb12972d396c2c288e2f36bdf55eac33bf5',
    TEST / 'src/server/db/postgres.ts':
        '9d1d664c519bbaf05a1af076865d385f800e3ea481f7e7783ab0019b6234c2db',
    TEST / 'src/app/api/webhooks/softaggregator/route.ts':
        '82137036c2e67f27d6c1292d369d271bbea03e23dd492c95582655234cbd53d2',
}
def fail(message):
    raise RuntimeError(message)
def run(*args):
    return subprocess.run(args, text=True, capture_output=True, timeout=20)
def read_url(path, timeout=12):
    with urlopen(f'http://127.0.0.1:{PORT}{path}', timeout=timeout) as response:
        return response.status, response.read(4096)

if os.geteuid() != 0: raise SystemExit('REFUSED: root required')
if any(not x.is_dir() or x.is_symlink() for x in (LIVE, BASE, TEST)):
    raise SystemExit('REFUSED: source releases unavailable or symlinked')
if (TEST / '.next/BUILD_ID').read_text().strip() != 'HmqLbfjKCGjZZBH4LLxiX':
    raise SystemExit('REFUSED: RTT6 candidate build ID changed')
for path, expected in EXPECTED.items():
    if not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest() != expected:
        raise SystemExit('REFUSED: changed source: ' + str(path.name))
for name in ('fiat-wallet.ts',):
    p = Path('src/server/providers/softaggregator') / name
    if (LIVE/p).read_bytes() != (TEST/p).read_bytes():
        raise SystemExit('REFUSED: fiat financial source differs')
nginx = run('nginx', '-T')
if nginx.returncode or re.search(r'\b3119\b', nginx.stdout):
    raise SystemExit('REFUSED: 3119 is referenced by nginx or nginx config is invalid')
with socket.socket() as s:
    try: s.bind(('127.0.0.1', PORT))
    except OSError: raise SystemExit('REFUSED: 3119 already bound')
listeners = run('ss','-ltnpH')
pids = re.findall(r':3098\s+[^\n]*?pid=(\d+)', listeners.stdout)
if listeners.returncode or len(pids) != 1 or Path('/proc/'+pids[0]+'/cwd').resolve() != LIVE:
    raise SystemExit('REFUSED: live listener no longer matches pinned release')
env = {}
for item in Path('/proc/'+pids[0]+'/environ').read_bytes().split(b'\0'):
    if b'=' in item:
        a, b = item.split(b'=', 1)
        env[os.fsdecode(a)] = os.fsdecode(b)
for key in ('NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_ANON_KEY',
            'SUPABASE_SERVICE_ROLE_KEY','NEXT_PUBLIC_SITE_URL','NODE_EXTRA_CA_CERTS'):
    if not env.get(key): raise SystemExit('REFUSED: live environment incomplete')
if env.get('NODE_TLS_REJECT_UNAUTHORIZED') == '0':
    raise SystemExit('REFUSED: TLS verification disabled')
env.update({
    'NODE_ENV': 'production',
    'NEXT_TELEMETRY_DISABLED': '1',
    'NODE_OPTIONS': '--max-old-space-size=1536',
    'PORT': str(PORT),
    'HOSTNAME': '127.0.0.1',
})
user = pwd.getpwnam('novaadmin')
p = None
try:
    with LOG.open('wb') as output:
        LOG.chmod(0o600)
        p = subprocess.Popen(
            ['/usr/bin/node', str(BASE/'node_modules/next/dist/bin/next'),
             'start', '-H', '127.0.0.1', '-p', str(PORT)],
            cwd=TEST, env=env, stdout=output, stderr=subprocess.STDOUT,
            user=user.pw_uid, group=user.pw_gid, start_new_session=True,
        )
    print('RTT6_CANDIDATE_STARTED_LOCAL_ONLY', flush=True)
    ready = False
    for _ in range(40):
        if p.poll() is not None: fail('RTT6 process terminated unexpectedly')
        try:
            status, _ = read_url('/api/v1/casino/games?page=1&limit=1', timeout=4)
            if status == 200:
                ready = True
                break
        except Exception:
            time.sleep(1)
    if not ready: fail('RTT6 games endpoint timeout')
    print('CASINO_GAMES_HTTP_200', flush=True)
    began = time.monotonic()
    status, _ = read_url('/api/health',timeout=15)
    if status != 200: fail('RTT6 health endpoint was not 200')
    print('HEALTH_HTTP_200_MS=' + str(round((time.monotonic()-began)*1000,1)), flush=True)
    status, body = read_url('/api/webhooks/softaggregator',timeout=12)
    if status != 200 or json.loads(body) != {'error': 2, 'balance': 0}:
        fail('RTT6 unsigned callbacks were not rejected')
    print('UNSIGNED_CALLBACK_DENIED', flush=True)
    print('RTT6_ISOLATED_SMOKE_TEST_PASS', flush=True)
except Exception as error:
    print('RTT6_ISOLATED_SMOKE_FAILED: ' + type(error).__name__ + ': ' + str(error), flush=True)
    sys.exit(2)
finally:
    if p is not None:
        try:
            os.killpg(p.pid, signal.SIGTERM)
            p.wait(timeout=8)
        except ProcessLookupError:
            pass
        except subprocess.TimeoutExpired:
            os.killpg(p.pid, signal.SIGKILL)
            p.wait()
    print('RTT6_CANDIDATE_STOPPED', flush=True)
    print('PRODUCTION_3098_UNCHANGED', flush=True)
