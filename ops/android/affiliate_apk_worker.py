#!/usr/bin/env python3
"""One affiliate APK per timer tick. Root orchestrates, a separate UID builds.

The production web app only creates zero-length <CODE>.request files. It never
receives the signing key or password. Logs contain no signing credentials.
"""
import fcntl
import os
from pathlib import Path
import pwd
import re
import shutil
import stat
import subprocess
import sys
import tempfile

BASE = Path("/var/lib/betvima-affiliate-build")
QUEUE = BASE / "queue"
RUNNING = BASE / "running"
FAILED = BASE / "failed"
SOURCE = Path("/var/www/betvima-android")
WORK = BASE / "workspace"
DOWNLOADS = Path("/var/www/nova/public/downloads/affiliate-app")
KEYSTORE = Path("/etc/betvima/android-signing/betvima-release.jks")
PASSFILE = Path("/etc/betvima/android-signing/release.pass")
GRADLE = Path("/opt/gradle/bin/gradle")
APKSIGNER = Path("/opt/android-sdk/build-tools/35.0.0/apksigner")
CERT_SHA256 = "b87c0c775b630fbfb4773c2f508fc54fce2e09387443430cd041c95af9a66f90"
CODE = re.compile(r"^[A-Z0-9_-]{3,64}$")
VERSION = re.compile(r'(?m)^\s*versionName\s*=\s*"(0\.\d+\.\d+)"\s*$')
VERSION_CODE = re.compile(r"(?m)^\s*versionCode\s*=\s*(\d+)\s*$")


def fail(message: str) -> None:
    raise RuntimeError(message)


def cert_valid(apk: Path) -> bool:
    if not apk.is_file() or not apk.stat().st_size:
        return False
    p = subprocess.run([str(APKSIGNER), "verify", "--print-certs", str(apk)],
                       stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                       text=True, timeout=35, check=False)
    if p.returncode:
        return False
    result = re.search(r"(?m)^Signer #1 certificate SHA-256 digest: ([a-fA-F0-9]+)\s*$", p.stdout)
    return bool(result and result.group(1).lower() == CERT_SHA256)


def source_version() -> str:
    src = (SOURCE / "app/build.gradle.kts").read_text()
    work = (WORK / "app/build.gradle.kts").read_text()
    version, code = VERSION.search(src), VERSION_CODE.search(src)
    if not version or not code or int(code.group(1)) < 133:
        fail("source_version_incorrect")
    if src != work:
        fail("builder_source_not_synchronized")
    if (SOURCE / ".betvima-native-commit").read_text().strip() != (
        WORK / ".betvima-native-commit").read_text().strip():
        fail("builder_source_revision_mismatch")
    return version.group(1)


def build(code: str, version: str) -> None:
    if not CODE.fullmatch(code):
        fail("invalid_code")
    for p in (KEYSTORE, PASSFILE, GRADLE, APKSIGNER):
        if not p.is_file():
            fail("missing_private_signing_or_tools")
    if shutil.disk_usage(DOWNLOADS).free < 8 * 1024**3:
        fail("insufficient_disk_space")
    builder = pwd.getpwnam("betvimaapk")
    output = DOWNLOADS / f"{code}-v{version}.apk"
    if output.exists():
        if cert_valid(output):
            return
        fail("existing_apk_not_signed_by_betvima")

    secret = PASSFILE.read_text().strip()
    if not secret:
        fail("empty_signing_password")

    with tempfile.TemporaryDirectory(prefix="betvima-signing-", dir="/dev/shm") as tmp:
        temp_dir = Path(tmp)
        os.chown(temp_dir, builder.pw_uid, builder.pw_gid)
        temp_key = temp_dir / "release.jks"
        shutil.copyfile(KEYSTORE, temp_key)
        os.chown(temp_key, builder.pw_uid, builder.pw_gid)
        os.chmod(temp_key, 0o600)
        env = {
            "PATH": "/usr/bin:/bin",
            "HOME": str(BASE / "home"),
            "GRADLE_USER_HOME": str(BASE / "home/.gradle"),
            "ANDROID_HOME": "/opt/android-sdk",
            "JAVA_HOME": "/usr/lib/jvm/java-17-openjdk-amd64",
            "BETVIMA_ANDROID_KEYSTORE_PATH": str(temp_key),
            "BETVIMA_ANDROID_KEYSTORE_PASSWORD": secret,
            "BETVIMA_ANDROID_KEY_ALIAS": "betvima-release",
            "BETVIMA_ANDROID_KEY_PASSWORD": secret,
        }

        # Python's preexec_fn can fail under systemd's execution sandbox,
        # giving only "SubprocessError: Exception occurred in preexec_fn".
        # setpriv drops supplementary groups and uid/gid in a small,
        # auditable external process. Gradle never runs as root.
        if not Path("/usr/bin/setpriv").is_file():
            fail("setpriv_not_installed")

        args = [
            str(GRADLE), "--no-daemon", "--no-configuration-cache", "--stacktrace",
            "--max-workers=1",
            "-Dorg.gradle.jvmargs=-Xmx1800m -XX:MaxMetaspaceSize=512m -Dfile.encoding=UTF-8",
            "-Pkotlin.compiler.execution.strategy=in-process",
            ":app:assembleRelease", f"-PaffiliateRef={code}",
        ]
        # Private log can be inspected locally by root; not exported to web/Actions.
        log_path = BASE / "last-build.log"
        with log_path.open("wb") as log:
            os.chmod(log_path, 0o600)
            command = [
                "/usr/bin/setpriv",
                f"--reuid={builder.pw_uid}",
                f"--regid={builder.pw_gid}",
                "--clear-groups",
                "--no-new-privs", "--",
                *args,
            ]
            proc = subprocess.run(command, cwd=WORK, env=env,
                                  stdout=log, stderr=subprocess.STDOUT, timeout=840,
                                  check=False)
        if proc.returncode != 0:
            fail("gradle_build_failed")

    config = WORK / "app/build/generated/source/buildConfig/release/com/betvima/app/BuildConfig.java"
    if f'AFFILIATE_REFERRAL_CODE = "{code}"' not in config.read_text():
        fail("affiliate_buildconfig_mismatch")
    apk = WORK / "app/build/outputs/apk/release/app-release.apk"
    if not cert_valid(apk):
        fail("release_certificate_invalid")

    fd, temp_path = tempfile.mkstemp(prefix=".affiliate-", suffix=".apk.tmp", dir=DOWNLOADS)
    try:
        with os.fdopen(fd, "wb") as f, apk.open("rb") as source:
            shutil.copyfileobj(source, f)
            f.flush()
            os.fsync(f.fileno())
        if not cert_valid(Path(temp_path)):
            fail("copied_apk_invalid")
        os.chown(temp_path, 0, 0)
        os.chmod(temp_path, 0o644)
        if output.exists():
            fail("destination_appeared_during_build")
        os.replace(temp_path, output)
    finally:
        if os.path.exists(temp_path):
            os.unlink(temp_path)


def main() -> None:
    if os.geteuid() != 0:
        fail("root_service_required")
    if not QUEUE.is_dir() or not RUNNING.is_dir() or not FAILED.is_dir():
        fail("not_installed")
    lockfile = DOWNLOADS / ".native-build.lock"
    fd = os.open(lockfile, os.O_WRONLY | os.O_APPEND | os.O_NOFOLLOW)
    try:
        fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        print("affiliate_apk_worker: another_build_running")
        return
    try:
        # A prior cgroup OOM/timeout may have killed the entire service before
        # it could record failure. Never rebuild those jobs in an endless loop.
        for interrupted in RUNNING.iterdir():
            if interrupted.is_file() and CODE.fullmatch(interrupted.name):
                os.replace(interrupted, FAILED / interrupted.name)
        # No shell, executable, JSON or path supplied by any player is evaluated.
        jobs = sorted(QUEUE.iterdir(), key=lambda p: p.stat().st_mtime)
        for job in jobs:
            if job.is_symlink() or not stat.S_ISREG(job.lstat().st_mode):
                continue
            if not job.name.endswith(".request"):
                continue
            code = job.name[:-8]
            if not CODE.fullmatch(code):
                continue
            working = RUNNING / code
            os.replace(job, working)
            try:
                build(code, source_version())
                working.unlink(missing_ok=True)
                (FAILED / code).unlink(missing_ok=True)
                print(f"affiliate_apk_ready={code}")
            except Exception as error:
                # Never retry a failed build endlessly on the production VPS.
                os.replace(working, FAILED / code)
                print(f"affiliate_apk_failed={code} reason={type(error).__name__}", file=sys.stderr)
            return
        print("affiliate_apk_queue_empty")
    finally:
        os.close(fd)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"affiliate_apk_worker_setup_failed={type(error).__name__}", file=sys.stderr)
        sys.exit(1)
