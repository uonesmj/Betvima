#!/usr/bin/env python3
"""Stage exactly the CI-tested GitHub wallet source into a NEW private directory.

The only permitted differences from isolated RTT8 are in the read-only callback
preflight and the ordinary credit profile-existence check. All remaining SQL,
wallet posting, receipt, rollback, limits and locks must be byte-for-byte equal.
Never modifies production release or DB; refuses any source mismatch.
"""
from __future__ import annotations
import difflib
import hashlib
import os
from pathlib import Path
import re
import subprocess
from urllib.request import urlopen

LIVE = Path('/opt/nova-releases/casino-3098-eligible-fallback-HU6Rbl')
BASE = Path('/opt/nova-releases/casino-rtt8-3098-candidate-20261030')
STAGE = Path('/root/betvima-rtt8-canonical-stage-20261030')
REL = Path('src/server/providers/softaggregator/wallet.ts')
LIVE_SHA = '9df555a7e3f04354019435e8e9318675587eb9b401422c0e70e7cc16727ff5af'
BASE_SHA = '1c98491d2af6231e86b902bffcad520309592d56adaadec80469b624ee748d8e'
BASE_BUILD = 'ISgbMW3GwdrfM7TbI0z9P'
COMMIT = '9140fbd129272589cec156bed7a7e56ea0055b33'
BLOB = '55abc91fdc2238def50d7883a47659948e84a53c'

def refuse(msg): raise SystemExit('REFUSED: ' + msg)
def sha(data): return hashlib.sha256(data).hexdigest()
def blob_hash(data):
    return hashlib.sha1(('blob ' + str(len(data)) + '\0').encode() + data).hexdigest()

if os.geteuid() != 0: refuse('root required')
if STAGE.exists() or STAGE.is_symlink(): refuse('stage target already exists')
if any(not x.is_dir() or x.is_symlink() for x in (LIVE, BASE)):
    refuse('pinned source release missing')
if sha((LIVE / REL).read_bytes()) != LIVE_SHA:
    refuse('live financial source changed')
base_bytes = (BASE / REL).read_bytes()
if sha(base_bytes) != BASE_SHA or (BASE/'.next/BUILD_ID').read_text().strip() != BASE_BUILD:
    refuse('isolated RTT8 build differs')
ss = subprocess.run(['ss','-ltnpH'], capture_output=True, text=True, timeout=8)
pids = re.findall(r':3098\s+[^\n]*?pid=(\d+)', ss.stdout)
if ss.returncode or len(pids)!=1 or Path('/proc/'+pids[0]+'/cwd').resolve()!=LIVE:
    refuse('active 3098 release differs')
url = 'https://raw.githubusercontent.com/uonesmj/Betvima/' + COMMIT + '/' + str(REL)
with urlopen(url, timeout=25) as response:
    canonical_bytes = response.read(100000)
if len(canonical_bytes)>=100000 or blob_hash(canonical_bytes)!=BLOB:
    refuse('canonical source verification failed')
original = base_bytes.decode()
canonical = canonical_bytes.decode()

def section(text, start, end):
    if text.count(start)!=1 or text.count(end)!=1:
        refuse('unexpected source marker: ' + start[:55])
    a=text.index(start)
    b=text.index(end,a+len(start))
    if b<a: refuse('invalid source section')
    return text[a:b]

# These two sections, and ONLY these sections, can differ from the already
# smoke-tested isolated RTT8 candidate. They are pinned to the exact tested blob.
pre_start = '  const db = getDb();\n'
pre_end = '  if (!schemaReady || !currency) return { error: 2, balance: 0 };\n'
credit_start = '    // Follow the same advisory-lock ordering as post_wallet_entry before locking wallet row.\n'
credit_end = '    // Existing wallets dominate signed casino rounds. Avoid an unnecessary\n'

o_pre=section(original,pre_start,pre_end)
n_pre=section(canonical,pre_start,pre_end)
o_credit=section(original,credit_start,credit_end)
n_credit=section(canonical,credit_start,credit_end)
wallet_lock = "await tx.query('select pg_advisory_xact_lock(hashtext($1))', ['wallet:' + userId + ':USD']);"
if o_credit.count(wallet_lock)!=1 or n_credit.count(wallet_lock)!=1:
    refuse('wallet advisory lock does not match')
if 'const p = await getProfile(tx, userId);' not in o_credit:
    refuse('original eligibility step differs')
if "'select 1 as found from nova.profiles where id = $1'" not in n_credit:
    refuse('canonical ordinary-credit check differs')
patched=original.replace(o_pre,n_pre,1).replace(o_credit,n_credit,1)
if patched!=canonical:
    print('CANONICAL_PARITY_REJECTED_OUTSIDE_TWO_AUDITED_REGIONS')
    for line in list(difflib.unified_diff(patched.splitlines(),canonical.splitlines(),
            fromfile='candidate_two_regions',tofile='canonical',lineterm=''))[:70]:
        print(line)
    refuse('unexpected differences in financial logic outside two audited regions')
STAGE.mkdir(mode=0o700)
out=STAGE/REL
out.parent.mkdir(parents=True,mode=0o700)
out.write_bytes(canonical_bytes)
out.chmod(0o600)
print('RTT8_CANONICAL_SOURCE_PARITY_STAGED')
print('RTT8_CANONICAL_SHA256=' + sha(canonical_bytes))
print('RTT8_CI_TESTED_GIT_BLOB=' + BLOB)
print('ONLY_PREFLIGHT_AND_ORDINARY_CREDIT_SOURCE_RECONCILED')
print('ROLLBACK_LEDGER_LIMITS_WALLET_LOCKS_UNCHANGED')
print('PRODUCTION_3098_UNCHANGED')
