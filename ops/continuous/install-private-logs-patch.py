#!/usr/bin/env python3
"""Install a SHA-pinned, root-private logging fix for nested production backup failures.

This patch changes only the trusted release controller, never the application,
provider, production database, backup archives, or running services.
It must be invoked manually on the VPS by an administrator after review.
"""
import fcntl
import hashlib
import os
import pathlib
import re
import tempfile
import time
import urllib.request

ROOT = pathlib.Path('/usr/local/lib/betvima-continuous')
STATE = pathlib.Path('/var/lib/betvima-continuous')
BACKUPS = pathlib.Path('/root/betvima-backups')
TARGET = ROOT/'controller.py'
PREVIOUS_BLOB = '67d56505b1b9898fd29ac0b0f4a49f78989a8abf'
REPLACEMENT_BLOB = '7b6b01ec451ce732d673b20cb814ffcec9ba5593'
REPO = 'uonesmj/Betvima'


def blob_sha(data):
    return hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()


def stop(reason):
    raise SystemExit('STOP: ' + reason)


def install(commit):
    if os.geteuid() != 0:
        stop('root required')
    if not re.fullmatch('[a-f0-9]{40}', commit):
        stop('exact pinned Git commit required')
    if ROOT.is_symlink() or not ROOT.is_dir() or ROOT.stat().st_uid != 0:
        stop('untrusted controller directory')
    if not TARGET.is_file() or TARGET.is_symlink() or TARGET.stat().st_uid != 0:
        stop('untrusted controller file')
    if not STATE.is_dir() or STATE.is_symlink() or STATE.stat().st_uid != 0:
        stop('untrusted controller state')

    with (STATE/'release.lock').open('a') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            stop('release in progress; do not install now')
        original = TARGET.read_bytes()
        current = blob_sha(original)
        if current not in (PREVIOUS_BLOB, REPLACEMENT_BLOB):
            stop('installed controller differs from reviewed version')
        url = ('https://raw.githubusercontent.com/' + REPO + '/' + commit
               + '/ops/continuous/controller.py')
        req = urllib.request.Request(url, headers={'User-Agent':'BetVima-audited-log-patch'})
        with urllib.request.urlopen(req, timeout=35) as response:
            updated = response.read(250001)
        if len(updated) > 250000 or blob_sha(updated) != REPLACEMENT_BLOB:
            stop('download does not match pinned controller blob')
        compile(updated, 'verified-controller.py', 'exec')
        if current == REPLACEMENT_BLOB:
            print('PRIVATE_LOG_FIX_ALREADY_INSTALLED')
            return

        BACKUPS.mkdir(mode=0o700, exist_ok=True)
        if BACKUPS.is_symlink() or BACKUPS.stat().st_uid != 0:
            stop('unsafe backup directory')
        archive = BACKUPS/('controller.before-private-log-fix-' + time.strftime('%Y%m%dT%H%M%SZ', time.gmtime()))
        with archive.open('xb') as stream:
            stream.write(original)
            stream.flush()
            os.fsync(stream.fileno())
        archive.chmod(0o600)

        fd, tmp = tempfile.mkstemp(dir=ROOT, prefix='.controller-private-log-')
        try:
            with os.fdopen(fd, 'wb') as writer:
                writer.write(updated)
                writer.flush()
                os.fsync(writer.fileno())
            os.chown(tmp, 0, 0)
            os.chmod(tmp, 0o600)
            os.replace(tmp, TARGET)
            if blob_sha(TARGET.read_bytes()) != REPLACEMENT_BLOB:
                raise RuntimeError('installed controller checksum mismatch')
        except Exception:
            # Preserve the website; restore original controller if install failed.
            with tempfile.NamedTemporaryFile(dir=ROOT, prefix='.controller-restore-',
                                             delete=False) as stream:
                restore = stream.name
                stream.write(original)
                stream.flush()
                os.fsync(stream.fileno())
            try:
                os.chown(restore, 0, 0)
                os.chmod(restore, 0o600)
                os.replace(restore, TARGET)
            finally:
                pathlib.Path(restore).unlink(missing_ok=True)
            stop('controller patch failed; original restored')
        finally:
            pathlib.Path(tmp).unlink(missing_ok=True)

        print('PRIVATE_BACKUP_ERROR_LOG_FIX: INSTALLED')
        print('SITE_DATABASE_FINANCIAL_WORKERS: UNCHANGED')
        print('EXISTING_INCOMPLETE_BACKUPS: UNCHANGED')
        print('NEW_OWNER_APPROVAL_REQUIRED_FOR_NEXT_PRODUCTION_RUN')


if __name__ == '__main__':
    import sys
    if len(sys.argv) != 2:
        stop('usage: install-private-logs-patch.py PINNED_COMMIT_SHA')
    install(sys.argv[1])
