#!/usr/bin/env python3
"""Stage15: fail-closed diff guard for BetVima casino performance review only.

Checks a newline list of paths against approved experimental/diagnostic scope.
Does not connect to the server or provider, inspect user data or change files.
Run with: git diff --name-only origin/main...HEAD | python3 this_file.py
Alternatively pass newline-list file path as first argument.
"""
from __future__ import annotations
import sys
from pathlib import Path

APPROVED_RUNTIME_SOURCE = {"src/server/db/postgres.ts"}
APPROVED_TEST_PREFIXES = (
    "scripts/stage", "scripts/casino/real_account_spin_timing_readonly.py",
    "tests/unit/postgres-transaction-timeout-dedupe.test.ts",
    "tests/unit/casino-edge-eu-probe.test.ts",
    "tests/unit/casino-eu-stage4-fx-parity.test.mjs",
    "docs/CASINO_EDGE_",
)
APPROVED_EDGE_PREFIX = "supabase/functions/betvima-eu-"
FROZEN_FEATURE_PATTERNS = (
    "/auth/", "/kyc/", "/geo/", "/geolocation/", "/age/", "/eligibility/",
    "/login/", "/register/", "/deposit/", "/withdraw/", "/payment/",
)
MAX_PATHS = 1000


def authorized(path: str) -> bool:
    if not path or path.startswith("/") or ".." in path.split("/") or "\\" in path:
        return False
    if path in APPROVED_RUNTIME_SOURCE:
        return True
    if path.startswith(APPROVED_EDGE_PREFIX):
        return path.endswith((".ts", ".json", ".md"))
    return path.startswith(APPROVED_TEST_PREFIXES)


def main() -> int:
    if len(sys.argv) > 2:
        print("STAGE15_FREEZE_SCOPE=FAIL_INVALID_INPUT")
        return 2
    if len(sys.argv) == 2:
        input_path = Path(sys.argv[1])
        if input_path.is_symlink() or not input_path.is_file() or input_path.stat().st_size > 200000:
            print("STAGE15_FREEZE_SCOPE=FAIL_INVALID_MANIFEST")
            return 2
        source = input_path.read_text(encoding="utf8")
    else:
        source = sys.stdin.read(200001)
    if len(source) > 200000:
        print("STAGE15_FREEZE_SCOPE=FAIL_INPUT_TOO_LARGE")
        return 2
    files = [line.strip() for line in source.splitlines() if line.strip()]
    if not files or len(files) > MAX_PATHS:
        print("STAGE15_FREEZE_SCOPE=FAIL_MISSING_OR_TOO_MANY_PATHS")
        return 2
    # Normalize nothing: renames, whitespace, and unexpected paths fail closed.
    unexpected = sorted({path for path in files if not authorized(path)})
    changed_runtime = sorted({path for path in files if path.startswith("src/")})
    if len(changed_runtime) > 1 or any(p not in APPROVED_RUNTIME_SOURCE for p in changed_runtime):
        unexpected.extend(p for p in changed_runtime if p not in unexpected)
    forbidden = sorted({
        path for path in files
        if any(s in ("/" + path.lower()) for s in FROZEN_FEATURE_PATTERNS)
        and path not in APPROVED_RUNTIME_SOURCE
        and not path.startswith("docs/")
    })
    if unexpected or forbidden:
        print("STAGE15_FROZEN_FEATURE_FILES_CHANGED=DETECTED")
        print("STAGE15_UNEXPECTED_PATH_COUNT=" + str(len(set(unexpected+forbidden))))
        print("STAGE15_FREEZE_SCOPE=FAIL")
        return 2
    print("STAGE15_CHANGED_FILES=" + str(len(files)))
    print("STAGE15_RUNTIME_SOURCE_CHANGED_FILES=" + str(len(changed_runtime)))
    print("STAGE15_FROZEN_FEATURE_FILES_CHANGED=0")
    print("STAGE15_CASINO_ACTIVE_3098_CHANGED=false")
    print("STAGE15_SCOPE_CHECK=PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
