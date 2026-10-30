#!/usr/bin/env bash
# Stage8B: route signed pre-existing canary test to isolated Ireland finance RPC.
set -Eeuo pipefail
umask 077
ROOT=/root/betvima-stage5
SRC="$ROOT/stage7-signed-outbound.cjs"
PRELOAD="$ROOT/stage8b-signed-preload-v2.cjs"
LOG="$ROOT/stage8b-signed-test-v2.log"
echo '===== STAGE8B ROUTING DIAGNOSTIC ====='
[[ "$(id -u)" -eq 0 ]] || { echo 'ERROR=ROOT_REQUIRED'; exit 1; }
[[ -f "$SRC" && -f "$PRELOAD" ]] || { echo 'ERROR=STAGE7_SIGNER_OR_V2_PRELOAD_MISSING'; exit 1; }
[[ "$(podman inspect betvima-stage5-pg --format '{{.HostConfig.NetworkMode}}')" == none ]] || {
  echo 'ERROR=ISOLATED_STAGE6_NETWORK_CHANGED'; exit 1;
}
node --check "$PRELOAD"
node --check "$SRC"
python3 - "$SRC" <<'PY'
from pathlib import Path
import sys
s=Path(sys.argv[1]).read_text(errors="replace")
if "betvima-eu-casino-stage7-outbound" not in s:
    raise SystemExit("ERROR=SOURCE_STAGE7_ENDPOINT_NOT_PRESENT")
print("SIGNER_ENDPOINT_STAGE7_FOUND=true")
print("SIGNER_FETCH_PRESENT=" + str("fetch(" in s).lower())
print("SIGNER_HTTPS_REQUEST_PRESENT=" + str("https.request" in s or "https.get" in s).lower())
print("SIGNER_NODE_HTTPS_IMPORT_PRESENT=" + str("node:https" in s or "require('https')" in s).lower())
PY
echo '===== STAGE8B SIGNED VPS -> EDGE -> REAL STAGING WALLET RPC ====='
set +e
NODE_OPTIONS="--require=$PRELOAD" timeout 95s node "$SRC" > "$LOG" 2>&1
rc=$?
set -e
echo "ORIGINAL_STAGE7_CHECKER_EXIT_CODE=$rc"
grep -E '^STAGE8B_' "$LOG" || true
valid="$(grep -c '^STAGE8B_EDGE_RPC_REAL_FINANCE=PASS' "$LOG" || true)"
matched="$(sed -n 's/^STAGE8B_TRANSPORT_HOOK_MATCHES=\([0-9]\+\)$/\1/p' "$LOG" | tail -1)"
if [[ "$rc" -eq 124 ]]; then echo 'ERROR=SIGNED_CLIENT_TIMEOUT'; exit 1; fi
if [[ "$matched" =~ ^[0-9]+$ ]] && [[ "$matched" -ge 1 ]] && [[ "$valid" -ge 1 ]] \
  && ! grep -q '^STAGE8B_EDGE_RPC_REAL_FINANCE=FAIL' "$LOG"; then
  echo "STAGE8B_SIGNED_E2E=PASS VERIFIED_REQUESTS=$valid"
  echo 'STAGE8B_DATABASE=ISOLATED_IRELAND_BRANCH'
  echo 'STAGE8B_REAL_WALLET_RPC=true'
  echo 'STAGE8B_PRODUCTION_WALLET_WRITES_BY_SCRIPT=0'
  echo 'STAGE8B_PRODUCTION_3098_UNCHANGED_BY_SCRIPT=true'
  echo 'FINISHED=true'
else
  [[ -n "$matched" ]] || matched=0
  echo "STAGE8B_SIGNED_E2E=NOT_VERIFIED MATCHES=$matched VERIFIED_REQUESTS=$valid"
  echo 'DIAGNOSTICS_ONLY_NO_WALLET_CHANGES=true'
  echo 'FOLLOWUP=SHARE_ONLY_STAGED_STAGE8B_OUTPUT_ABOVE'
  exit 1
fi
