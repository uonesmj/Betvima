#!/usr/bin/env python3
"""Five-minute, fail-closed SoftAggregator callback canary.

Swaps only the existing /api/webhooks/softaggregator proxy_pass from 3098
to 3101; schedules a systemd rollback timer BEFORE switching. No DB writes,
wallet operations, policy changes, user secrets, or public port exposure.

Run: sudo python3 /tmp/betvima-rtt3-canary.py start
Manual rollback: sudo python3 /root/betvima-nginx-backups/rtt3-rollback.py revert
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import urlopen

CONF = Path('/etc/nginx/sites-enabled/betvima.com').resolve()
OLD = Path('/opt/nova-releases/casino-debit-fast-20261026')
NEW = Path('/opt/nova-releases/casino-callback-rtt3-20261026')
BACKUP_DIR = Path('/root/betvima-nginx-backups')
BACKUP = BACKUP_DIR / 'callback-before-rtt3-canary-20261026.conf'
WATCHDOG_SCRIPT = BACKUP_DIR / 'rtt3-rollback.py'
SOURCE_WHITELIST = {
    'server/db/postgres.ts',
    'server/providers/softaggregator/wallet.ts',
    'server/providers/softaggregator/fiat-wallet.ts',
}
ROUTE_PATTERN = re.compile(
    r'(location\\s+\\^~\\s+/api/webhooks/softaggregator\\s*\\{[^{}]*?'
    r'\\bproxy_pass\\s+http://127\\.0\\.0\\.1:)(\\d+)(\\s*;)',
    re.S,
)


def stop(message: str) -> None:
    raise SystemExit('STOP: ' + message)


def locate_route(text: str) -> tuple[re.Match[str], int]:
    matches = list(ROUTE_PATTERN.finditer(text))
    if len(matches) != 1:
        stop('EXPECTED_EXACTLY_ONE_CALLBACK_LOCATION')
    return matches[0], int(matches[0].group(2))


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def verify_candidate() -> None:
    if not NEW.joinpath('.next/BUILD_ID').is_file():
        stop('CANDIDATE_BUILD_MISSING')
    if not OLD.joinpath('.next/BUILD_ID').is_file():
        stop('CURRENT_BUILD_MISSING')

    for name in ('.env.production.local', '.env.production'):
        a, b = OLD / name, NEW / name
        if a.is_file() != b.is_file() or (a.is_file() and sha256(a) != sha256(b)):
            stop('CANDIDATE_ENV_DIFFERS')

    old_files = {
        str(p.relative_to(OLD / 'src')): sha256(p)
        for p in (OLD / 'src').rglob('*') if p.is_file()
    }
    new_files = {
        str(p.relative_to(NEW / 'src')): sha256(p)
        for p in (NEW / 'src').rglob('*') if p.is_file()
    }
    changed = {
        name for name in old_files.keys() | new_files.keys()
        if old_files.get(name) != new_files.get(name)
    }
    if changed != SOURCE_WHITELIST:
        stop('UNEXPECTED_SOURCE_DIFF: ' + str(sorted(changed)))

    for port in (3098, 3101):
        try:
            with urlopen('http://127.0.0.1:%d/api/webhooks/softaggregator' % port, timeout=8) as response:
                payload = json.load(response)
                if response.status != 200 or payload != {'error': 2, 'balance': 0}:
                    stop('UNSIGNED_CALLBACK_NOT_REJECTED_' + str(port))
        except Exception as exc:
            stop('CALLBACK_HEALTH_FAILED_%s: %s' % (port, type(exc).__name__))

    unit = subprocess.run(
        ['systemctl', 'show', 'betvima-rtt3-port3101',
         '-p', 'ActiveState', '-p', 'MainPID'],
        capture_output=True, text=True, check=True,
    ).stdout
    if 'ActiveState=active' not in unit:
        stop('CANDIDATE_SERVICE_INACTIVE')
    pid = re.search(r'(?m)^MainPID=(\\d+)$', unit)
    if not pid or pid.group(1) == '0':
        stop('CANDIDATE_SERVICE_PID_MISSING')
    if Path('/proc/' + pid.group(1) + '/cwd').resolve() != NEW:
        stop('CANDIDATE_PROCESS_DIR_UNEXPECTED')


def atomic_write(target: Path, content: str) -> None:
    state = target.stat()
    fd, pathname = tempfile.mkstemp(prefix='.betvima-rtt3-', dir=str(target.parent), text=True)
    try:
        with os.fdopen(fd, 'w', encoding='utf-8') as out:
            out.write(content)
        os.chmod(pathname, state.st_mode)
        os.chown(pathname, state.st_uid, state.st_gid)
        os.replace(pathname, target)
    finally:
        if os.path.exists(pathname):
            os.unlink(pathname)


def set_route(expected_port: int, target_port: int) -> None:
    before = CONF.read_text()
    match, port = locate_route(before)
    if port != expected_port:
        stop('CALLBACK_ROUTE_CHANGED_EXPECTED_%s_ACTUAL_%s' % (expected_port, port))
    after = before[:match.start(2)] + str(target_port) + before[match.end(2):]
    if after == before:
        stop('ROUTE_NO_CHANGE')

    atomic_write(CONF, after)
    test = subprocess.run(['nginx', '-t'], capture_output=True, text=True)
    if test.returncode != 0:
        atomic_write(CONF, before)
        stop('NGINX_TEST_FAILED_OLD_CONFIG_RESTORED')

    reload = subprocess.run(['systemctl', 'reload', 'nginx'], capture_output=True, text=True)
    if reload.returncode != 0:
        atomic_write(CONF, before)
        subprocess.run(['nginx', '-t'], capture_output=True, text=True)
        subprocess.run(['systemctl', 'reload', 'nginx'], capture_output=True, text=True)
        stop('NGINX_RELOAD_FAILED_OLD_CONFIG_RESTORED')


def revert() -> None:
    if not CONF.is_file():
        stop('NGINX_CONFIG_MISSING')
    _, current = locate_route(CONF.read_text())
    if current == 3098:
        print('RTT3_ALREADY_ON_3098', flush=True)
        return
    if current != 3101:
        stop('ROUTE_IS_NOT_RTT3_REFUSING_TO_TOUCH')
    set_route(3101, 3098)
    print('RTT3_AUTO_ROLLBACK_SUCCESS_CALLBACK_3098', flush=True)


def start() -> None:
    if not CONF.is_file() or not OLD.is_dir() or not NEW.is_dir():
        stop('RELEASE_OR_NGINX_CONFIG_MISSING')
    if BACKUP.exists():
        stop('CANARY_BACKUP_ALREADY_EXISTS')
    _, port = locate_route(CONF.read_text())
    if port != 3098:
        stop('LIVE_CALLBACK_NOT_ON_3098')
    verify_candidate()
    BACKUP_DIR.mkdir(mode=0o700, parents=True, exist_ok=True)
    shutil.copy2(CONF, BACKUP)
    shutil.copy2(Path(__file__), WATCHDOG_SCRIPT)
    os.chmod(WATCHDOG_SCRIPT, 0o700)

    now = datetime.now(timezone.utc).strftime('%H%M%S')
    timer_name = 'betvima-rtt3-autorevert-20261026-' + now
    schedule = subprocess.run([
        'systemd-run', '--quiet', '--unit=' + timer_name,
        '--on-active=5m', '/usr/bin/python3', str(WATCHDOG_SCRIPT), 'revert'
    ], capture_output=True, text=True)
    if schedule.returncode != 0:
        stop('ROLLBACK_TIMER_CREATION_FAILED')
    status = subprocess.run(
        ['systemctl', 'is-active', timer_name + '.timer'],
        capture_output=True, text=True)
    if status.returncode != 0 or status.stdout.strip() != 'active':
        stop('ROLLBACK_TIMER_NOT_ACTIVE')

    set_route(3098, 3101)
    print('RTT3_CANARY_SWITCHED_TO_3101', flush=True)
    print('AUTO_REVERT_TIMER=' + timer_name + '.timer', flush=True)
    print('AUTO_REVERT_IN=5_MINUTES', flush=True)
    print('MANUAL_REVERT=sudo python3 ' + str(WATCHDOG_SCRIPT) + ' revert', flush=True)
    print('ONLY_NGINX_CALLBACK_UPSTREAM_CHANGED', flush=True)


if __name__ == '__main__':
    if len(sys.argv) != 2 or sys.argv[1] not in ('start', 'revert'):
        stop('USAGE_START_OR_REVERT')
    if os.geteuid() != 0:
        stop('ROOT_REQUIRED')
    if sys.argv[1] == 'start':
        start()
    else:
        revert()
