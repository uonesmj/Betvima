#!/usr/bin/env bash
# RTT4: prepare, typecheck, unit-test, build, and health-check an ISOLATED release.
# Does not switch Nginx, deploy to the website, perform payouts, or touch DB schemas.
set -Eeuo pipefail

readonly OLD=/opt/nova-releases/casino-callback-rtt3-20261026
readonly NEW=/opt/nova-releases/casino-callback-rtt4-20261026
readonly PREP=/tmp/betvima-rtt4-prep.py
readonly BUILD_TEMPLATE=/tmp/betvima-callback-rtt3-build.cjs
readonly BUILD_SCRIPT=/tmp/betvima-callback-rtt4-build.cjs
readonly START_TEMPLATE=/tmp/betvima-rtt3-3101.py
readonly START_SCRIPT=/tmp/betvima-rtt4-3102.py
readonly UNIT=betvima-rtt4-port3102

if [[ $(id -u) -ne 0 ]]; then
  echo 'STOP: RUN_AS_ROOT'; exit 1
fi
for f in "$PREP" "$BUILD_TEMPLATE" "$START_TEMPLATE"; do
  [[ -f "$f" ]] || { echo "STOP: MISSING_PREVIOUS_SCRIPT: $f"; exit 1; }
done
if [[ -e "$NEW" || -e "$BUILD_SCRIPT" || -e "$START_SCRIPT" ]]; then
  echo 'STOP: RTT4_ALREADY_PREPARED'; exit 1
fi
if ss -H -lnt '( sport = :3102 )' | grep -q .; then
  echo 'STOP: PORT_3102_IN_USE'; exit 1
fi
if [[ $(systemctl show "$UNIT" -p LoadState --value 2>/dev/null || true) == loaded ]]; then
  echo 'STOP: RTT4_UNIT_ALREADY_EXISTS'; exit 1
fi

/usr/bin/python3 -m py_compile "$PREP"
/usr/bin/python3 - <<'PY'
from pathlib import Path
old = '/opt/nova-releases/casino-callback-rtt3-20261026'
new = '/opt/nova-releases/casino-callback-rtt4-20261026'
build_src = Path('/tmp/betvima-callback-rtt3-build.cjs').read_text()
if build_src.count(old) != 1 or 'RTT3_BUILD_STARTED' not in build_src or 'RTT3_BUILD_SUCCESS' not in build_src:
    raise SystemExit('STOP: BUILD_TEMPLATE_UNEXPECTED')
build_dst = (build_src.replace(old, new)
                  .replace('RTT3_BUILD_STARTED', 'RTT4_BUILD_STARTED')
                  .replace('RTT3_BUILD_SUCCESS', 'RTT4_BUILD_SUCCESS'))
Path('/tmp/betvima-callback-rtt4-build.cjs').write_text(build_dst)
start_src = Path('/tmp/betvima-rtt3-3101.py').read_text()
if start_src.count(old) != 1 or start_src.count('3101') < 2 or '3098' not in start_src:
    raise SystemExit('STOP: START_TEMPLATE_UNEXPECTED')
Path('/tmp/betvima-rtt4-3102.py').write_text(
    start_src.replace(old, new).replace('3101', '3102'))
PY
/usr/bin/python3 -m py_compile "$START_SCRIPT"

/usr/bin/python3 "$PREP"
cd "$NEW"
/usr/bin/node node_modules/typescript/bin/tsc --noEmit
echo RTT4_TYPECHECK_PASSED
/usr/bin/node node_modules/vitest/vitest.mjs run \
  tests/unit/softaggregator-wallet.test.ts \
  tests/unit/softaggregator-fiat-wallet.test.ts \
  tests/unit/softaggregator-pilot-limits.test.ts \
  tests/unit/softaggregator-webhook-route.test.ts
echo RTT4_FINANCIAL_TESTS_PASSED

# Same build strategy previously used for RTT3, now in the new release only.
/usr/sbin/runuser -u novaadmin -- /usr/bin/node "$BUILD_SCRIPT"
test -f "$NEW/.next/BUILD_ID" || { echo 'STOP: BUILD_ARTIFACT_MISSING'; exit 1; }
echo RTT4_BUILD_VERIFIED

# Before starting an isolated process, assert the ONLY source diffs are
# Postgres connection transport and the ordinary USD credit callback.
python3 - <<'PY'
from pathlib import Path
import hashlib,re
a = Path('/opt/nova-releases/casino-callback-rtt3-20261026')
b = Path('/opt/nova-releases/casino-callback-rtt4-20261026')
def sha(p):
    return hashlib.sha256(p.read_bytes()).digest()
a_files = {str(p.relative_to(a/'src')): p for p in (a/'src').rglob('*') if p.is_file()}
b_files = {str(p.relative_to(b/'src')): p for p in (b/'src').rglob('*') if p.is_file()}
changed = {n for n in a_files.keys() | b_files.keys()
           if n not in a_files or n not in b_files or sha(a_files[n]) != sha(b_files[n])}
want = {'server/db/postgres.ts','server/providers/softaggregator/wallet.ts'}
if changed != want:
    raise SystemExit('STOP: UNEXPECTED_SOURCE_DIFF: '+str(sorted(changed)))
for name in ('.env.production','.env.production.local'):
    x,y = a/name,b/name
    if x.is_file()!=y.is_file() or (x.is_file() and sha(x)!=sha(y)):
        raise SystemExit('STOP: PRODUCTION_ENV_DIFF: '+name)
conf=Path('/etc/nginx/sites-enabled/betvima.com').resolve().read_text()
blocks=re.findall(r'location\s+\^~\s+/api/webhooks/softaggregator\s*\{([^{}]*)\}',conf,re.S)
if len(blocks)!=1 or re.search(r'proxy_pass\s+http://127\.0\.0\.1:3098\s*;',blocks[0]) is None:
    raise SystemExit('STOP: LIVE_CALLBACK_CHANGED')
print('RTT4_SOURCE_AUDIT_PASSED', flush=True)
PY

if ss -H -lnt '( sport = :3102 )' | grep -q .; then
  echo 'STOP: PORT_3102_BECAME_OCCUPIED'; exit 1
fi
systemd-run --unit="$UNIT" -p User=novaadmin -p Group=novaadmin \
  /usr/bin/python3 "$START_SCRIPT"

ok=0
for attempt in {1..15}; do
  if [[ "$(curl -m 5 -sS -o /dev/null -w '%{http_code}' \
            http://127.0.0.1:3102/ 2>/dev/null || true)" == '200' ]]; then
    ok=1; break
  fi
  sleep 1
done
if [[ "$ok" != 1 ]]; then
  echo 'RTT4_START_FAILED_STOPPING_ONLY_CANDIDATE'
  systemctl stop "$UNIT" || true
  journalctl -u "$UNIT" -n 20 --no-pager
  exit 1
fi
old_code=$(curl -m 5 -sS -o /dev/null -w '%{http_code}' \
  http://127.0.0.1:3098/ 2>/dev/null || true)
if [[ "$old_code" != '200' ]]; then
  echo 'STOP: ORIGINAL_CALLBACK_UNHEALTHY'
  systemctl stop "$UNIT" || true
  exit 1
fi
echo 'RTT4_CANDIDATE_READY_PORT_3102'
echo 'LIVE_CALLBACK_UNCHANGED_PORT_3098'
echo 'NO_DATABASE_COUNTRY_WALLET_OR_NGINX_CHANGES'
