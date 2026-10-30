#!/usr/bin/env python3
"""Read-only, fail-closed source parity audit for built RTT8 vs tested GitHub branch.

Does not change releases, databases, service configs, running processes, routes
or balances. Only downloads one immutable public source file; validates its
Git blob identifier, and reports source diffs (never credentials or user data).
"""
from __future__ import annotations
import difflib
import hashlib
import os
from pathlib import Path
import re
import subprocess
from urllib.request import urlopen

REPO_COMMIT = "9140fbd129272589cec156bed7a7e56ea0055b33"
GIT_BLOB = "55abc91fdc2238def50d7883a47659948e84a53c"
RELPATH = "src/server/providers/softaggregator/wallet.ts"
CAND = Path("/opt/nova-releases/casino-rtt8-3098-candidate-20261030")
LIVE = Path("/opt/nova-releases/casino-3098-eligible-fallback-HU6Rbl")
EXPECTED_LIVE = "9df555a7e3f04354019435e8e9318675587eb9b401422c0e70e7cc16727ff5af"
EXPECTED_CAND = "1c98491d2af6231e86b902bffcad520309592d56adaadec80469b624ee748d8e"
EXPECTED_BUILD = "ISgbMW3GwdrfM7TbI0z9P"

def refuse(why: str):
    raise SystemExit("REFUSED: " + why)

def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()

if os.geteuid() != 0:
    refuse("root needed for source verification")
if any(not d.is_dir() or d.is_symlink() for d in (LIVE, CAND)):
    refuse("pinned release directories missing")
if sha((LIVE / RELPATH).read_bytes()) != EXPECTED_LIVE:
    refuse("live financial source differs")
candidate = (CAND / RELPATH).read_bytes()
if sha(candidate) != EXPECTED_CAND:
    refuse("isolated candidate differs from tested RTT8 build")
if (CAND / ".next/BUILD_ID").read_text().strip() != EXPECTED_BUILD:
    refuse("candidate build differs")
listener = subprocess.run(["ss", "-ltnpH"], capture_output=True, text=True, timeout=8)
pids = re.findall(r":3098\s+[^\n]*?pid=(\d+)", listener.stdout)
if listener.returncode or len(pids) != 1 or Path("/proc/" + pids[0] + "/cwd").resolve() != LIVE:
    refuse("active 3098 release differs")

url = ("https://raw.githubusercontent.com/uonesmj/Betvima/"
       + REPO_COMMIT + "/" + RELPATH)
with urlopen(url, timeout=20) as response:
    canonical = response.read(100_000)
if not canonical or len(canonical) >= 100_000:
    refuse("canonical source exceeds expected bounds")
header = ("blob " + str(len(canonical)) + "\0").encode()
if hashlib.sha1(header + canonical).hexdigest() != GIT_BLOB:
    refuse("canonical Git blob changed")
print("LIVE_3098_SOURCE_PIN_VERIFIED")
print("RTT8_ISOLATED_BUILD_PIN_VERIFIED")
print("GITHUB_TESTED_WALLET_BLOB_VERIFIED")
print("GITHUB_TESTED_WALLET_SHA256=" + sha(canonical))
if canonical == candidate:
    print("RTT8_SOURCE_PARITY_PASS")
else:
    print("RTT8_SOURCE_PARITY_MISMATCH")
    old = candidate.decode("utf-8").splitlines()
    new = canonical.decode("utf-8").splitlines()
    hunks = list(difflib.unified_diff(
        old, new, fromfile="isolated_RTT8_built",
        tofile="GitHub_RTT8_tested", lineterm=""))
    print("SOURCE_DIFF_LINES=" + str(len(hunks)))
    for line in hunks[:160]:
        print(line)
    if len(hunks) > 160:
        print("SOURCE_DIFF_TRUNCATED")
print("READ_ONLY_AUDIT=TRUE")
print("PRODUCTION_CONFIG_AND_DATABASE_UNCHANGED")
