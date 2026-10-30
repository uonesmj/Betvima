#!/usr/bin/env python3
"""Build an isolated shadow adapter from precisely identified live 3098 source.
NO production writes, database connection, web requests, or process reload.
"""
import hashlib
import os
import tempfile
from pathlib import Path

ROOT = Path("/opt/nova-releases/casino-3098-eligible-fallback-HU6Rbl")
SOURCE = ROOT / "src/server/db/postgres.ts"
OUTDIR = Path("/root/betvima-stage5/stage10-timeout-candidate/live-shadow")
OUT = OUTDIR / "postgres.ts"
EXPECTED = "3d66c5724ff6"

CL = "class TransactionDb implements Db {"
FIRST = "  private async run<"
NEXT = "\n  query<"
FIELD = (
    "  // SET LOCAL remains in force through COMMIT/ROLLBACK; reset by constructor.\n"
    "  private appliedStatementTimeoutMs: number | null = null;\n"
)
OLD = (
    "    await this.client.query(`set local statement_timeout = "
    "${Math.max(1000, Math.trunc(timeout))}`);\n"
    "    const result = await this.client.query(sql, values as unknown[]);\n"
    "    return result.rows as T[];"
)
NEW = (
    "    const nextStatementTimeoutMs = Math.max(1000, Math.trunc(timeout));\n"
    "    if (this.appliedStatementTimeoutMs !== nextStatementTimeoutMs) {\n"
    "      await this.client.query(`set local statement_timeout = "
    "${nextStatementTimeoutMs}`);\n"
    "      this.appliedStatementTimeoutMs = nextStatementTimeoutMs;\n"
    "    }\n"
    "    const result = await this.client.query(sql, values as unknown[]);\n"
    "    // Invalidate on caller-controlled timeout/session/savepoint changes.\n"
    "    if (/\\b(?:set|reset)\\s+(?:local\\s+|session\\s+)?statement_timeout\\b"
    "|\\bset_config\\s*\\(|\\brollback\\s+to\\b|\\bsavepoint\\b/i.test(sql)) {\n"
    "      this.appliedStatementTimeoutMs = null;\n"
    "    }\n"
    "    return result.rows as T[];"
)

def sha12(data):
    return hashlib.sha256(data).hexdigest()[:12]

def main():
    print("STAGE10_SHADOW_BUILDER=READ_ONLY_PRODUCTION")
    if not SOURCE.is_file() or SOURCE.is_symlink():
        print("STAGE10_ABORT=SOURCE_NOT_REGULAR_FILE")
        return 2
    if not SOURCE.resolve().is_relative_to(ROOT.resolve()):
        print("STAGE10_ABORT=SOURCE_PATH_CHANGED")
        return 2
    raw = SOURCE.read_bytes()
    if len(raw) > 100000 or sha12(raw) != EXPECTED:
        print("STAGE10_ABORT=LIVE_SOURCE_HASH_MISMATCH")
        return 2
    code = raw.decode("utf-8","strict")
    if code.count(CL)!=1 or code.count("private async run<")!=1:
        print("STAGE10_ABORT=TRANSACTION_CLASS_MISMATCH")
        return 2
    before, tail = code.split(CL,1)
    if FIRST not in tail or NEXT not in tail:
        print("STAGE10_ABORT=RUN_METHOD_MISMATCH")
        return 2
    ctor, remaining = tail.split(FIRST,1)
    run, after_run = remaining.split(NEXT,1)
    if run.count(OLD)!=1 or "appliedStatementTimeoutMs" in code:
        print("STAGE10_ABORT=EXPECTED_RUN_BODY_MISMATCH")
        return 2
    patched = (before + CL + "\n" + FIELD +
               ctor.lstrip("\n") + FIRST + run.replace(OLD,NEW) + NEXT + after_run)
    # Prove exact, exhaustive, two-location inverse of every source modification.
    if patched.replace("\n"+FIELD,"\n",1).replace(NEW,OLD,1)!=code:
        print("STAGE10_ABORT=UNEXPECTED_ADDITIONAL_DIFF")
        return 2
    if OUTDIR.is_symlink() or (OUT.exists() and (OUT.is_symlink() or not OUT.is_file())):
        print("STAGE10_ABORT=OUTPUT_PATH_UNSAFE")
        return 2
    OUTDIR.mkdir(mode=0o700,parents=True,exist_ok=True)
    os.chmod(OUTDIR,0o700)
    fd,tmp=tempfile.mkstemp(prefix=".shadow-",suffix=".ts",dir=OUTDIR)
    try:
        os.fchmod(fd,0o600)
        with os.fdopen(fd,"w",encoding="utf8") as f:
            f.write(patched)
        os.replace(tmp,OUT)
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)
    print("STAGE10_ACTIVE_SOURCE_SHA12="+sha12(raw))
    print("STAGE10_SHADOW_SOURCE_SHA12="+sha12(patched.encode()))
    print("STAGE10_SHADOW_FILE_ONLY=true")
    print("STAGE10_PRODUCTION_FILE_WRITES=0")
    print("STAGE10_FINANCIAL_OPERATIONS=0")
    print("STAGE10_PORT_3098_UNCHANGED=true")
    print("STAGE10_SHADOW_BUILD=PASS")
    return 0

if __name__=="__main__":
    raise SystemExit(main())
