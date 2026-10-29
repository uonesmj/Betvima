#!/usr/bin/env bash
# Create a separate, non-running candidate using the EXACT 3098 release and
# the audited three-file RTT5 overlay. No migrations, financial callbacks,
# Nginx, PM2, systemd, external downloads or live file modifications.
set -Eeuo pipefail
umask 077

LIVE=/opt/nova-releases/casino-3098-eligible-fallback-HU6Rbl
OVERLAY=/root/betvima-rtt5-3098-overlay-20261030
CAND=/opt/nova-releases/casino-rtt5-3098-candidate-20261030

die() { echo "REFUSED: $*" >&2; exit 1; }
hash() { sha256sum "$1" | awk '{print $1}'; }
verify_hash() {
  [[ -f "$1" ]] || die "missing: $1"
  [[ "$(hash "$1")" == "$2" ]] || die "unexpected source: $1"
}
[[ "$(id -u)" == 0 ]] || die "run from root shell"
[[ -d "$LIVE" && -d "$OVERLAY" ]] || die "active release or overlay missing"
[[ ! -e "$CAND" && ! -L "$CAND" ]] || die "candidate path already exists"
[[ -f "$LIVE/package.json" && -f "$LIVE/tsconfig.json" ]] || die "active build configuration absent"
[[ -d "$LIVE/node_modules" ]] || die "active node_modules absent"
[[ -x "$LIVE/node_modules/.bin/tsc" ]] || die "local TypeScript binary missing"
[[ -f "$LIVE/.next/BUILD_ID" ]] || die "current active build missing"
verify_hash "$LIVE/src/server/db/postgres.ts" \
  3d66c5724ff67ebdbc160ca56fb05e1597ebf38f48a7d01b3482bccae01916a3
verify_hash "$LIVE/src/server/providers/softaggregator/wallet.ts" \
  9df555a7e3f04354019435e8e9318675587eb9b401422c0e70e7cc16727ff5af
verify_hash "$OVERLAY/src/server/db/postgres.ts" \
  9d1d664c519bbaf05a1af076865d385f800e3ea481f7e7783ab0019b6234c2db
verify_hash "$OVERLAY/src/app/api/webhooks/softaggregator/route.ts" \
  82137036c2e67f27d6c1292d369d271bbea03e23dd492c95582655234cbd53d2
verify_hash "$OVERLAY/src/server/providers/softaggregator/perf-trace.ts" \
  689814835db49e153bb7cf0d9020f4a1587f01b8ef1033d0a5b1ebc246db9f87

# Verify the live 3098 listener still maps to the pinned active directory.
PID=$(ss -ltnpH | sed -n '/:3098[[:space:]]/s/.*pid=\([0-9]\+\).*/\1/p' | head -n 1)
[[ "$PID" =~ ^[0-9]+$ ]] || die "cannot identify live 3098 PID"
[[ "$(readlink -f "/proc/$PID/cwd")" == "$LIVE" ]] || die "3098 release changed"

echo "SAFE_PRECHECK_PASSED"
mkdir -m 0700 "$CAND"
# Copy the active release except generated build and dependencies.
# Node modules are linked only for TypeScript reading; no install/build scripts
# are executed, and all production files remain unchanged.
tar -C "$LIVE" --exclude='./.next' --exclude='./node_modules' \
  --exclude='./.git' -cf - . | tar -C "$CAND" -xf -
ln -s "$LIVE/node_modules" "$CAND/node_modules"
for file in \
  src/server/db/postgres.ts \
  src/app/api/webhooks/softaggregator/route.ts \
  src/server/providers/softaggregator/perf-trace.ts
do
  cp "$OVERLAY/$file" "$CAND/$file"
done

# Exhaustively compare every src/ file to the active release.
# No changes except the two transport/route files and one added trace module.
python3 - "$LIVE" "$CAND" <<'PY'
from pathlib import Path
import sys
base, candidate = (Path(x) / 'src' for x in sys.argv[1:])
def snapshot(root):
    return {
        p.relative_to(root).as_posix(): p.read_bytes()
        for p in root.rglob('*') if p.is_file()
    }
a, b = snapshot(base), snapshot(candidate)
changed = {p for p in a.keys() | b.keys() if a.get(p) != b.get(p)}
expected = {
    'server/db/postgres.ts',
    'app/api/webhooks/softaggregator/route.ts',
    'server/providers/softaggregator/perf-trace.ts',
}
if changed != expected:
    raise SystemExit('REFUSED: unexpected modified src paths: ' + ', '.join(sorted(changed ^ expected)))
for untouched in ['server/providers/softaggregator/wallet.ts',
                  'server/providers/softaggregator/fiat-wallet.ts',
                  'server/providers/softaggregator/jurisdiction.ts']:
    if a.get(untouched) != b.get(untouched):
        raise SystemExit('REFUSED: financial or jurisdiction code changed: ' + untouched)
print('SOURCE_AUDIT_PASS: exactly 2 modified and 1 added files')
print('WALLET_FIAT_JURISDICTION_UNCHANGED')
PY

# Typechecking only: no next build, migrations, service launch or real bets.
echo "TYPECHECK_RUNNING"
if (cd "$CAND" && NEXT_TELEMETRY_DISABLED=1 \
   "$CAND/node_modules/.bin/tsc" --noEmit --incremental false); then
  echo "TYPECHECK_PASS"
  echo "ISOLATED_CANDIDATE_READY=$CAND"
  echo "PRODUCTION_UNCHANGED_3098"
else
  echo "TYPECHECK_FAILED: isolated candidate remains at $CAND; do not deploy"
  exit 2
fi
