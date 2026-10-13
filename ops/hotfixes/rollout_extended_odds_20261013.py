#!/usr/bin/env python3
"""Apply reviewed advanced-market coverage to bulk odds worker only, with rollback."""
import fcntl
import hashlib
import json
import os
import pathlib
import stat
import subprocess
import sys
import tempfile
import time
import urllib.request

P = pathlib.Path
RELEASE = P("/opt/nova-releases/24dab3702c58a5baa4b5f18ccc1eee15b2c6fdac")
PROVIDER = RELEASE / "src/providers/the-odds-api.ts"
HELPER = RELEASE / "src/providers/extended-event-markets.ts"
REV = "479a8e28572a26a0c6a00db90924187345411875"
BASE_REV = "4ccda40e49db37179599604c16ff95182f21a1b2"
OLD_PROVIDER_SHA = "34949e480b7313c1be47505a5f6ac7560714d1d8"
NEW_PROVIDER_SHA = "4ebc0293d886811894384f9cdd9f13f773db702c"
HELPER_SHA = "143dc9533dbf1bdd445b53a9daa0a20b16025061"
PM2_ENV = "PM2_HOME=/home/novaadmin/.pm2"

def stop(message):
    raise RuntimeError("SAFETY_STOP: " + message)

def blob(data):
    return hashlib.sha1(b"blob " + str(len(data)).encode() + b"\0" + data).hexdigest()

def github_file(rev, path, expected_sha):
    url = "https://raw.githubusercontent.com/uonesmj/Betvima/" + rev + "/" + path
    with urllib.request.urlopen(url, timeout=45) as response:
        data = response.read(200001)
    if len(data) > 200000 or blob(data) != expected_sha:
        stop("Git source integrity failure: " + path)
    return data

def command(*args, cwd=None, timeout=100):
    return subprocess.run(args, capture_output=True, text=True, cwd=cwd, timeout=timeout)

def pm(*args):
    result = command("/usr/sbin/runuser", "-u", "novaadmin", "--", "/usr/bin/env",
                     PM2_ENV, "/usr/bin/pm2", *args)
    if result.returncode:
        stop("PM2 operation failed: " + " ".join(args) +
             " status " + str(result.returncode) +
             " " + result.stderr[-300:])
    return result.stdout

def services():
    return json.loads(pm("jlist"))

def process(items, name):
    matches = [item for item in items if item.get("name") == name]
    if len(matches) != 1 or matches[0].get("pm2_env", {}).get("status") != "online":
        stop("Process missing or not online: " + name)
    return matches[0]

def replace_atomic(path, data, template):
    if path.is_symlink():
        stop("Refusing to replace a symbolic link: " + str(path))
    fd, temp = tempfile.mkstemp(prefix=".advanced-odds-", dir=str(path.parent))
    try:
        with os.fdopen(fd, "wb") as out:
            out.write(data)
            out.flush()
            os.fsync(out.fileno())
        os.chown(temp, template.st_uid, template.st_gid)
        os.chmod(temp, stat.S_IMODE(template.st_mode))
        os.replace(temp, path)
    finally:
        if os.path.exists(temp):
            os.unlink(temp)

def main():
    if os.geteuid() != 0:
        stop("Root required")
    with open("/run/lock/betvima-bulk-odds-patch.lock", "a+b") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        before = services()
        bulk = process(before, "betvima-odds-worker")
        live = process(before, "betvima-live-odds-worker")
        settlement = process(before, "betvima-settlement-worker")

        if bulk["pm2_env"].get("pm_cwd") != str(RELEASE):
            stop("Bulk worker release changed since previous inspection")
        if settlement["pm2_env"].get("pm_cwd") != str(RELEASE):
            stop("Settlement release changed since previous inspection")
        if live["pm2_env"].get("pm_cwd") == str(RELEASE):
            stop("Live worker unexpectedly shares bulk source")
        if bulk["pm2_env"].get("pm_exec_path") != str(RELEASE / "src/workers/entrypoints/odds.worker.ts"):
            stop("Bulk odds entrypoint changed")
        if not PROVIDER.is_file():
            stop("Bulk provider source file does not exist")

        old_provider = PROVIDER.read_bytes()
        old_helper = HELPER.read_bytes() if HELPER.exists() else None
        if HELPER.is_symlink():
            stop("Unexpected source helper symlink")
        if old_helper is not None and blob(old_helper) != HELPER_SHA:
            stop("Existing extended helper differs from reviewed revision")

        reviewed_provider = github_file(REV, "src/providers/the-odds-api.ts", NEW_PROVIDER_SHA)
        reviewed_helper = github_file(REV, "src/providers/extended-event-markets.ts", HELPER_SHA)

        if blob(old_provider) == NEW_PROVIDER_SHA and old_helper == reviewed_helper:
            print("ALREADY_DEPLOYED: advanced event market coverage", flush=True)
            return

        if blob(old_provider) == OLD_PROVIDER_SHA:
            new_provider = reviewed_provider
            print("PROVIDER_SOURCE_MATCHED_BASE", flush=True)
        else:
            # Prior verified deployments allow conflict-free server-specific provider edits.
            # A three-way merge preserves those customizations. Conflicts stop before changes.
            baseline = github_file(BASE_REV, "src/providers/the-odds-api.ts", OLD_PROVIDER_SHA)
            with tempfile.TemporaryDirectory(prefix="betvima-market-merge-") as tmp:
                local, base, reviewed = [P(tmp) / name for name in ("local", "base", "reviewed")]
                local.write_bytes(old_provider)
                base.write_bytes(baseline)
                reviewed.write_bytes(reviewed_provider)
                merge = command("/usr/bin/git", "merge-file", "-p",
                                str(local), str(base), str(reviewed), timeout=60)
                if merge.returncode != 0:
                    stop("Provider customization conflict; no files changed")
                new_provider = merge.stdout.encode("utf-8")
            print("SERVER_CUSTOMIZATIONS_MERGED", flush=True)

        expected_markers = (
            b"import { selectExtendedEventMarkets }",
            b"selectExtendedEventMarkets(",
            b"ODDS_EVENT_EXTENDED_NO_MARKETS",
            b'"extended"',
        )
        if any(marker not in new_provider for marker in expected_markers):
            stop("Required extended market guards missing")
        if b"<<<<<<<" in new_provider or b">>>>>>>" in new_provider:
            stop("Unresolved merge conflict markers detected")
        if old_helper is not None and old_provider == new_provider:
            print("ALREADY_DEPLOYED: provider unchanged", flush=True)
            return

        compiler = RELEASE / "node_modules/typescript/bin/tsc"
        compiler_test = command("/usr/sbin/runuser", "-u", "novaadmin", "--",
                                "/usr/bin/node", str(compiler), "--version",
                                cwd=str(RELEASE))
        if compiler_test.returncode != 0 or not compiler_test.stdout.strip().startswith("Version "):
            stop("No working TypeScript compiler in this release")

        provider_stat = PROVIDER.stat()
        helper_stat = HELPER.stat() if HELPER.exists() else provider_stat
        backup_dir = P("/home/novaadmin") / ("odds-extended-backup-" + str(int(time.time())))
        backup_dir.mkdir(mode=0o700)
        (backup_dir / "the-odds-api.ts").write_bytes(old_provider)
        if old_helper is not None:
            (backup_dir / "extended-event-markets.ts").write_bytes(old_helper)
        print("BACKUP_CREATED:", backup_dir, flush=True)

        modified = False
        restarted = False
        try:
            modified = True
            replace_atomic(PROVIDER, new_provider, provider_stat)
            replace_atomic(HELPER, reviewed_helper, helper_stat)
            tsc = command("/usr/sbin/runuser", "-u", "novaadmin", "--",
                          "/usr/bin/node", str(compiler),
                          "--noEmit", "--pretty", "false", "--incremental", "false",
                          cwd=str(RELEASE), timeout=240)
            if tsc.returncode != 0:
                print("TYPECHECK_ERRORS:",
                      "\n".join((tsc.stdout + tsc.stderr).splitlines()[:16])[:1900], flush=True)
                stop("TypeScript check failed; rolling back")
            print("TYPECHECK_PASS", flush=True)

            # Re-read PIDs before restart to avoid restarting after a concurrent change.
            just_before = services()
            if process(just_before, "betvima-odds-worker").get("pid") != bulk.get("pid"):
                stop("Bulk PID changed during typecheck")
            if process(just_before, "betvima-live-odds-worker").get("pid") != live.get("pid"):
                stop("Live PID changed during typecheck")
            if process(just_before, "betvima-settlement-worker").get("pid") != settlement.get("pid"):
                stop("Settlement PID changed during typecheck")

            restarted = True
            pm("restart", "betvima-odds-worker")
            time.sleep(15)
            after = services()
            new_bulk = process(after, "betvima-odds-worker")
            new_live = process(after, "betvima-live-odds-worker")
            new_settlement = process(after, "betvima-settlement-worker")
            if new_bulk.get("pid") == bulk.get("pid") or not new_bulk.get("pid"):
                stop("Bulk worker did not obtain a new running process")
            if new_live.get("pid") != live.get("pid") or new_settlement.get("pid") != settlement.get("pid"):
                stop("Live or settlement process changed unexpectedly")
            print("ODDS_EXTENDED_MARKETS_DEPLOYED " + REV, flush=True)
            print("ODDS_WORKER_ONLINE pid=" + str(new_bulk.get("pid")), flush=True)
            print("LIVE_AND_SETTLEMENT_UNCHANGED", flush=True)
        except Exception:
            if modified:
                replace_atomic(PROVIDER, old_provider, provider_stat)
                if old_helper is None:
                    HELPER.unlink(missing_ok=True)
                else:
                    replace_atomic(HELPER, old_helper, helper_stat)
                print("SOURCE_ROLLBACK_COMPLETE", flush=True)
            if restarted:
                try:
                    pm("restart", "betvima-odds-worker")
                    print("OLD_ODDS_WORKER_RESTARTED", flush=True)
                except Exception:
                    print("URGENT: check odds worker PM2 status", flush=True)
            raise

if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(str(error), flush=True)
        sys.exit(1)
