#!/usr/bin/env python3
"""Reviewed, one-time upgrade of the installed production migration filename guard.

Only adds the historical, already-applied 0161a filename to the allowed-name
expression. The read-only migration registry SHA-256/baseline checks remain intact.
No migration, database mutation, web restart, or financial service action occurs.
"""
import fcntl
import hashlib
import os
import pathlib
import stat
import tempfile
import time

TARGET = pathlib.Path('/usr/local/lib/betvima-continuous/production.py')
LOCK = pathlib.Path('/var/lib/betvima-continuous/release.lock')
BACKUP_ROOT = pathlib.Path('/root/betvima-backups')
OLD = b"re.fullmatch(r'[0-9]{4}_[a-z0-9_]+\\.sql',name)"
NEW = b"re.fullmatch(r'(?:[0-9]{4}_[a-z0-9_]+|0161a_fresh_db_numeric_sequence)\\.sql',name)"

def prepare(contents):
    """Return exact compatibility patch, refusing any unexpected installed version."""
    if contents.count(NEW) == 1 and contents.count(OLD) == 0:
        return None
    if contents.count(OLD) != 1 or NEW in contents:
        raise RuntimeError('unexpected_installed_guard_version')
    required = (
        b'def verify_applied_migrations(', b'if verified!=added:',
        b'BEGIN READ ONLY;', b'verified_migration_registry_required',
        b'migration_change_requires_separate_approval',
    )
    if not all(part in contents for part in required):
        raise RuntimeError('missing_migration_safety_guards')
    updated = contents.replace(OLD, NEW)
    compile(updated, str(TARGET), 'exec')
    return updated

def install():
    if os.geteuid() != 0:
        raise RuntimeError('root_required')
    if TARGET.is_symlink() or not TARGET.is_file() or TARGET.lstat().st_uid != 0:
        raise RuntimeError('unsafe_controller_target')
    with LOCK.open('r+b') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError as exc:
            raise RuntimeError('release_in_progress_retry_later') from exc
        original = TARGET.read_bytes()
        updated = prepare(original)
        if updated is None:
            print('GUARD_ALREADY_INSTALLED')
            return
        BACKUP_ROOT.mkdir(mode=0o700, exist_ok=True)
        if BACKUP_ROOT.is_symlink() or BACKUP_ROOT.stat().st_uid != 0:
            raise RuntimeError('unsafe_backup_location')
        backup = BACKUP_ROOT / ('legacy-migration-guard-' + time.strftime('%Y%m%dT%H%M%SZ', time.gmtime()))
        backup.mkdir(mode=0o700)
        saved = backup / 'production.py'
        with saved.open('xb') as out:
            out.write(original)
            out.flush()
            os.fsync(out.fileno())
        saved.chmod(0o600)
        fd, name = tempfile.mkstemp(prefix='.legacy-guard-', dir=str(TARGET.parent))
        try:
            with os.fdopen(fd, 'wb') as out:
                out.write(updated)
                out.flush()
                os.fsync(out.fileno())
            os.chown(name, 0, 0)
            os.chmod(name, stat.S_IMODE(TARGET.stat().st_mode))
            os.replace(name, TARGET)
            if TARGET.read_bytes() != updated:
                raise RuntimeError('installed_guard_verification_failed')
        except Exception:
            if os.path.exists(name):
                os.unlink(name)
            if TARGET.read_bytes() != original:
                fd, restore = tempfile.mkstemp(prefix='.legacy-guard-restore-', dir=str(TARGET.parent))
                with os.fdopen(fd, 'wb') as out:
                    out.write(original)
                    out.flush()
                    os.fsync(out.fileno())
                os.chown(restore, 0, 0)
                os.chmod(restore, 0o600)
                os.replace(restore, TARGET)
            raise
        print('LEGACY_0161A_GUARD_INSTALLED')
        print('PREVIOUS_CONTROLLER_SHA256=' + hashlib.sha256(original).hexdigest())
        print('BACKUP=' + str(saved))
        print('DATABASE_AND_WEB_UNCHANGED')

if __name__ == '__main__':
    install()
