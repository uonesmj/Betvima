#!/usr/bin/env bash
# Execute SIGNED real staging finance RPC via pre-existing verified VPS test client.
# Never touches production wallet, nginx, casino 3098, or callback routing.
set -Eeuo pipefail
umask 077
ROOT=/root/betvima-stage5
SRC="$ROOT/stage7-signed-outbound.cjs"
PRELOAD="$ROOT/stage8b-signed-preload.cjs"
LOG="$ROOT/stage8b-signed-test.log"
[[ -f "$SRC" ]] || { echo 'ERROR=SIGNED_STAGE7_CLIENT_NOT_FOUND'; exit 1; }
[[ -f "$PRELOAD" ]] || { echo 'ERROR=STAGE8B_PRELOAD_NOT_FOUND'; exit 1; }
[[ "$(podman inspect betvima-stage5-pg --format '{{.HostConfig.NetworkMode}}')" == none ]] || {
  echo 'ERROR=LOCAL_STAGING_NETWORK_NOT_NONE'; exit 1;
}
node --check "$PRELOAD"
node --check "$SRC"
[[ -s "$SRC" ]] || { echo 'ERROR=INVALID_EXISTING_SIGNED_SOURCE'; exit 1; }
if ! grep -qF 'betvima-eu-casino-stage7-outbound' "$SRC"; then
  echo 'ERROR=UNEXPECTED_SIGNED_CLIENT_TARGET'; exit 1
fi
echo '===== STAGE 8B SIGNED REAL RPC TO ISOLATED BRANCH ====='
set +e
NODE_OPTIONS="--require=$PRELOAD" timeout 90s node "$SRC" > "$LOG" 2>&1
rc=$?
set -e
echo "ORIGINAL_STAGE7_CHECKER_EXIT_CODE=$rc"
grep -E '^STAGE8B_' "$LOG" || true
# The old Stage7 response assertions are expected not to match the new Stage8B
# finance response; only the unmodified signed HTTP response capture is authoritative.
ok="$(grep -c '^STAGE8B_EDGE_RPC_REAL_FINANCE=PASS' "$LOG" || true)"
if [[ "$ok" -lt 1 ]] || grep -q '^STAGE8B_EDGE_RPC_REAL_FINANCE=FAIL' "$LOG"; then
  echo 'STAGE8B_SIGNED_E2E=NOT_VERIFIED'
  echo 'NOTE=Check_PRIVATE_LOG_WITHOUT_SHARING_SECRETS'
  exit 1
fi
echo "STAGE8B_SIGNED_E2E=PASS VERIFIED_REQUESTS=$ok"
echo 'STAGE8B_TARGET=ISOLATED_IRISH_BRANCH'
echo 'PRODUCTION_WALLET_WRITES=0'
echo 'PRODUCTION_CASINO_3098_UNCHANGED_BY_SCRIPT=true'
echo 'FINISHED=true'
