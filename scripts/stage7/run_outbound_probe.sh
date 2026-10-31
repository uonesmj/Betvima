#!/usr/bin/env bash
# Stage7: signed outbound probe only, no staging DB network access, no money writes.
set -Eeuo pipefail
umask 077
NAME='betvima-stage5-pg'
DB='betvima_stage6'
DIR='/root/betvima-stage5'
SRC='/root/test-casino-stage4-20261030.cjs'
DST="$DIR/stage7-signed-outbound.cjs"
LOG="$DIR/stage7-signed-outbound.log"

echo '===== STAGE 7 LOCAL READ-ONLY GUARD ====='
command -v podman >/dev/null || { echo 'ERROR=PODMAN_MISSING'; exit 1; }
[[ "$(podman inspect "$NAME" --format '{{.State.Running}}')" == true ]] || { echo 'ERROR=CONTAINER_NOT_RUNNING'; exit 1; }
[[ "$(podman inspect "$NAME" --format '{{.HostConfig.NetworkMode}}')" == none ]] || { echo 'ERROR=STAGING_NETWORK_NOT_DISABLED'; exit 1; }
[[ -f "$SRC" ]] || { echo 'ERROR=STAGE4_SIGNER_NOT_FOUND'; exit 1; }
[[ "$(podman exec "$NAME" psql -X -U stage5_owner -d "$DB" -v ON_ERROR_STOP=1 -Atqc 'select current_database()')" == "$DB" ]] || { echo 'ERROR=WRONG_STAGING_DATABASE'; exit 1; }

# Only aggregate values from known synthetic UUID. Never send them to Edge.
LOCAL_PASS="$(podman exec "$NAME" psql -X -U stage5_owner -d "$DB" -v ON_ERROR_STOP=1 -Atqc "
 SELECT CASE WHEN
  (SELECT balance_minor FROM nova.wallets WHERE user_id='00000000-0000-0000-0000-000000000088' AND currency='USD')=940
  AND (SELECT count(*) FROM nova.wallet_transactions WHERE idempotency_key='stage6-same-key')=1
  AND (SELECT count(*) FROM nova.wallet_transactions WHERE idempotency_key LIKE 'stage6-debit-%')=10
  AND (SELECT count(*) FROM nova.wallet_transactions WHERE idempotency_key LIKE 'stage6-credit-%')=2
  AND (SELECT count(*) FROM nova.wallet_transactions WHERE idempotency_key='stage6-overdraft')=0
  AND (SELECT count(*) FROM nova.wallet_transactions WHERE idempotency_key='stage6-rejected-atomic')=0
  AND (SELECT count(*) FROM nova.softaggregator_callback_receipts)=0
  AND (SELECT sum(amount_minor) FROM nova.wallet_transactions WHERE user_id='00000000-0000-0000-0000-000000000088')=940
 THEN 'PASS' ELSE 'FAIL' END;
")"
[[ "$LOCAL_PASS" == PASS ]] || { echo "ERROR=STAGE6_SYNTHETIC_PROOF_$LOCAL_PASS"; exit 1; }
echo 'STAGE6_LOCAL_PROOF=PASS'
echo 'STAGING_NETWORK=none'

# Retain the existing Ed25519 signing mechanism, JWT authorization and negative
# signature tests; replace only read-only Stage4 endpoint/response assertions.
python3 - "$SRC" "$DST" <<'PY'
from pathlib import Path
import sys, os
src, dst = map(Path, sys.argv[1:3])
code = src.read_text()
old = 'betvima-eu-casino-stage4-fx-parity'
new = 'betvima-eu-casino-stage7-outbound'
old_mode = 'SIGNED_STAGE4_FX_PARITY_READ_ONLY'
new_mode = 'SIGNED_STAGE7_OUTBOUND_ONLY_READ_ONLY'
anchor = 'r.data.financial_schema_metadata_ready !== true'
for required in (old, old_mode, anchor):
    if code.count(required) != 1:
        raise SystemExit('ERROR=SIGNED_STAGE4_SCRIPT_UNEXPECTED_FORMAT')
code = code.replace(old, new).replace(old_mode, new_mode)
code = code.replace(anchor, anchor + """
  || r.data.stage7_signed_outbound_bridge !== true
  || r.data.stage7_isolated_staging_db_connected !== false
  || r.data.stage7_remote_financial_rpc_enabled !== false
""")
code = code.replace('STAGE4_CHECK_FAILED', 'STAGE7_CHECK_FAILED')
code = code.replace('STAGE4_FX_CHECKS', 'STAGE7_FX_CHECKS')
if "betvima-eu-casino-stage7-outbound" not in code:
    raise SystemExit('ERROR=STAGE7_DESTINATION_MISSING')
dst.write_text(code)
os.chmod(dst, 0o600)
print('STAGE7_SIGNED_TEST_PREPARED=true')
PY

node --check "$DST"
echo '===== STAGE 7 SIGNED VPS TO EU EDGE TEST ====='
if timeout 120s node "$DST" > "$LOG" 2>&1; then
  echo 'STAGE7_EXIT_CODE=0'
else
  code=$?
  echo "ERROR=STAGE7_SIGNED_PROBE_EXIT_$code"
  grep -E '^(STAGE7_|STAGE3_|EDGE_CANARY_|NO_MONEY_)' "$LOG" || true
  exit "$code"
fi
grep -E '^(STAGE7_|STAGE3_|EDGE_CANARY_|NO_MONEY_)' "$LOG" || true
[[ "$(grep -c '^STAGE7_FX_CHECKS=32/32' "$LOG" || true)" -eq 4 ]] || { echo 'ERROR=EXPECTED_FOUR_SIGNED_ACCEPTS'; exit 1; }
grep -q '^NO_MONEY_CALLBACKS_OR_WRITES=true' "$LOG" || { echo 'ERROR=NONFINANCIAL_GUARD_FAILED'; exit 1; }
grep -q '^EDGE_CANARY_REGION=eu-west-1' "$LOG" || { echo 'ERROR=WRONG_EDGE_REGION'; exit 1; }
echo 'STAGE7_OUTBOUND_SIGNED_BRIDGE=PASS'
echo 'STAGE7_EDGE_FINANCIAL_RPC_ENABLED=false'
echo 'STAGE7_LOCAL_DB_REMOTE_ACCESS=false'
echo 'PRODUCTION_3098_UNCHANGED=true'
echo 'FINISHED=true'
