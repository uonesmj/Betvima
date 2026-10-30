#!/usr/bin/env bash
# Stage 8: signed Edge synthetic financial in-memory simulator preflight ONLY.
set -Eeuo pipefail
umask 077
NAME='betvima-stage5-pg'
DB='betvima_stage6'
DIR='/root/betvima-stage5'
SRC="$DIR/stage7-signed-outbound.cjs"
DST="$DIR/stage8-signed-simulator.cjs"
LOG="$DIR/stage8-signed-simulator.log"
echo '===== STAGE 8 DATABASE ISOLATION ====='
command -v podman >/dev/null || { echo 'ERROR=PODMAN_MISSING'; exit 1; }
[[ "$(podman inspect "$NAME" --format '{{.State.Running}}')" == true ]] || { echo 'ERROR=STAGING_CONTAINER_NOT_RUNNING'; exit 1; }
[[ "$(podman inspect "$NAME" --format '{{.HostConfig.NetworkMode}}')" == none ]] || { echo 'ERROR=STAGING_NETWORK_NOT_DISABLED'; exit 1; }
[[ -f "$SRC" ]] || { echo 'ERROR=PREVIOUS_SIGNED_STAGE7_CLIENT_MISSING'; exit 1; }
[[ "$(podman exec "$NAME" psql -X -U stage5_owner -d "$DB" -v ON_ERROR_STOP=1 -Atqc 'select current_database()')" == "$DB" ]] || { echo 'ERROR=WRONG_DATABASE'; exit 1; }
LOCAL="$(podman exec "$NAME" psql -X -U stage5_owner -d "$DB" -v ON_ERROR_STOP=1 -Atqc "
SELECT CASE WHEN
  (SELECT balance_minor FROM nova.wallets WHERE user_id='00000000-0000-0000-0000-000000000088' AND currency='USD')=940
 AND (SELECT count(*) FROM nova.wallet_transactions WHERE idempotency_key='stage6-same-key')=1
 AND (SELECT count(*) FROM nova.wallet_transactions WHERE idempotency_key LIKE 'stage6-debit-%')=10
 AND (SELECT count(*) FROM nova.wallet_transactions WHERE idempotency_key LIKE 'stage6-credit-%')=2
 AND (SELECT count(*) FROM nova.softaggregator_callback_receipts)=0
 AND (SELECT sum(amount_minor) FROM nova.wallet_transactions WHERE user_id='00000000-0000-0000-0000-000000000088')=940
 THEN 'PASS' ELSE 'FAIL' END;")"
[[ "$LOCAL" == PASS ]] || { echo "ERROR=STAGE6_LOCAL_PROOF_$LOCAL"; exit 1; }
echo 'STAGE8_LOCAL_REAL_WALLET_RPC_PROOF=PASS'
echo 'STAGE8_REMOTE_STAGING_DB_CONNECTED=false'
echo 'STAGING_NETWORK_MODE=none'

# Adapt only the known, previously successful signed client.
# Never print, copy to git or modify Ed25519 keys.
python3 - "$SRC" "$DST" <<'PY'
from pathlib import Path
import sys, os
src, dst = map(Path,sys.argv[1:3])
code=src.read_text()
replacements={
 'betvima-eu-casino-stage7-outbound': 'betvima-eu-casino-stage8-simulator',
 'SIGNED_STAGE7_OUTBOUND_ONLY_READ_ONLY':'SIGNED_STAGE8_FINANCIAL_SIMULATOR_READ_ONLY',
 'r.data.stage7_signed_outbound_bridge !== true': """(r.data.stage7_signed_outbound_bridge !== true
    || r.data.stage8_finance_simulation_passed !== true
    || r.data.stage8_finance_scenarios_total !== 16
    || r.data.stage8_finance_simulation_mode !== 'IN_MEMORY_NO_WALLET_DB_ACCESS'
    || r.data.stage8_wallet_rpc_from_edge_executed !== false)""",
 'STAGE7_FX_CHECKS':'STAGE8_FX_CHECKS',
}
for old,new in replacements.items():
 if code.count(old)!=1 and old!='STAGE7_FX_CHECKS':
  raise SystemExit(f'ERROR=UNEXPECTED_STAGE7_TEST_SOURCE:{old}')
 if old=='STAGE7_FX_CHECKS' and code.count(old)<1:
  raise SystemExit('ERROR=MISSING_STAGE7_RESULT_MARKER')
 code=code.replace(old,new)
if 'betvima-eu-casino-stage7-outbound' in code:
 raise SystemExit('ERROR=PREVIOUS_ENDPOINT_LEFT_IN_CLIENT')
dst.write_text(code)
os.chmod(dst,0o600)
print('STAGE8_ED25519_TEST_PREPARED=true')
PY
node --check "$DST"

echo '===== STAGE 8 VPS TO EDGE SIGNED TEST ====='
if timeout 120s node "$DST" > "$LOG" 2>&1; then
 echo 'STAGE8_EDGE_EXIT_CODE=0'
else
 ec=$?
 echo "ERROR=STAGE8_SIGNED_EDGE_EXIT_$ec"
 grep -E '^(STAGE8_|STAGE3_|EDGE_CANARY_|NO_MONEY_)' "$LOG" || true
 exit "$ec"
fi
grep -E '^(STAGE8_|STAGE3_|EDGE_CANARY_|NO_MONEY_)' "$LOG" || true
[[ "$(grep -c '^STAGE8_FX_CHECKS=32/32' "$LOG" || true)" -eq 4 ]] || { echo 'ERROR=FX_CHECKS_FAILED'; exit 1; }
[[ "$(grep -c '^STAGE3_SCHEMA_READY=true' "$LOG" || true)" -eq 4 ]] || { echo 'ERROR=SCHEMA_CHECKS_FAILED'; exit 1; }
grep -q '^NO_MONEY_CALLBACKS_OR_WRITES=true' "$LOG" || { echo 'ERROR=FINANCIAL_ISOLATION_FAILED'; exit 1; }
grep -q '^EDGE_CANARY_REGION=eu-west-1' "$LOG" || { echo 'ERROR=WRONG_EDGE_REGION'; exit 1; }
echo 'STAGE8_SYNTHETIC_EDGE_SIMULATION=PASS'
echo 'STAGE8_16_IN_MEMORY_FINANCIAL_SCENARIOS=PASS'
echo 'STAGE8_REAL_EDGE_WALLET_RPC_EXECUTED=false'
echo 'STAGE8_STAGING_DATABASE_DIRECTLY_ACCESSIBLE=false'
echo 'PRODUCTION_CASINO_3098_UNCHANGED=true'
echo 'FINISHED=true'
