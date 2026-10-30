#!/usr/bin/env bash
# BetVima isolated stage-5 PostgreSQL financial constraint test, 2026-10-30.
# Does NOT access Supabase production or the 3098 service.
set -Eeuo pipefail
umask 077
NAME='betvima-stage5-pg'
DB='betvima_stage5'
REF="$STAGE5_REF"
[[ "$REF" =~ ^[0-9a-f]{40}$ ]] || { echo 'ERROR=INVALID_SOURCE_COMMIT'; exit 1; }
DIR='/root/betvima-stage5/stage5-sql'
MIGRATIONS_SHA='9d0476a619e81b5b78f612d401eb6e35758dc19c'
BASE="https://raw.githubusercontent.com/uonesmj/Betvima/$REF/scripts/stage5"
MIG_BASE="https://raw.githubusercontent.com/uonesmj/Betvima/$MIGRATIONS_SHA/supabase/migrations"
FILES=(
  '0208_softaggregator_callback_receipts.sql'
  '0209_softaggregator_fx_rounds.sql'
  '0210_softaggregator_reverse_win_receipts.sql'
  '0211_softaggregator_player_wallet_binding.sql'
  '0212_softaggregator_receipt_ledger_integrity.sql'
)
echo '===== STAGE 5 ISOLATION CHECK ====='
command -v podman >/dev/null || { echo 'ERROR=PODMAN_MISSING'; exit 1; }
podman container exists "$NAME" || { echo 'ERROR=STAGING_CONTAINER_MISSING'; exit 1; }
mode="$(podman inspect "$NAME" --format '{{.HostConfig.NetworkMode}}')"
running="$(podman inspect "$NAME" --format '{{.State.Running}}')"
[[ "$mode" == 'none' && "$running" == 'true' ]] || {
  echo "ERROR=BAD_STAGING_ISOLATION NETWORK=$mode RUNNING=$running"; exit 1;
}
db_name="$(podman exec "$NAME" psql -X -U stage5_owner -d "$DB" -Atqc 'select current_database()')"
[[ "$db_name" == "$DB" ]] || { echo 'ERROR=WRONG_DATABASE'; exit 1; }
prior="$(podman exec "$NAME" psql -X -U stage5_owner -d "$DB" -Atqc "select count(*) from pg_namespace where nspname in ('nova','stage5_test')")"
[[ "$prior" == '0' ]] || { echo 'ERROR=STAGE5_ALREADY_INITIALIZED_REFUSING_REPLAY'; exit 1; }
echo "ISOLATED_DATABASE=$db_name"
echo 'NETWORK_MODE=none'
echo 'FINANCIAL_PRODUCTION_ACCESS=none'
install -d -m 700 "$DIR"
fetch() {
  local url="$1" dest="$2"
  timeout 35s curl --fail --location --silent --show-error --retry 2 --connect-timeout 10 "$url" -o "$dest"
  test -s "$dest"
}
fetch "$BASE/bootstrap.sql" "$DIR/bootstrap.sql"
fetch "$BASE/financial_invariants.sql" "$DIR/financial_invariants.sql"
for f in "\${FILES[@]}"; do
  fetch "$MIG_BASE/$f" "$DIR/$f"
done
echo '===== STAGING BOOTSTRAP ====='
podman exec -i "$NAME" psql -X -U stage5_owner -d "$DB" -v ON_ERROR_STOP=1 < "$DIR/bootstrap.sql"
echo '===== ORIGINAL CASINO MIGRATIONS 0208..0212 ====='
for f in "\${FILES[@]}"; do
  echo "APPLY_STAGING_ONLY=$f"
  podman exec -i "$NAME" psql -X -U stage5_owner -d "$DB" -v ON_ERROR_STOP=1 -q < "$DIR/$f"
done
echo '===== SYNTHETIC FINANCIAL INVARIANT TESTS ====='
podman exec -i "$NAME" psql -X -U stage5_owner -d "$DB" -v ON_ERROR_STOP=1 < "$DIR/financial_invariants.sql"
echo '===== STAGE 5 RESULT ====='
echo 'STAGE5_CONSTRAINT_TESTS_COMPLETED=true'
echo 'SYNTHETIC_TEST_ROWS_ROLLED_BACK=true'
echo 'SUPABASE_PRODUCTION_UNCHANGED=true'
echo 'CASINO_3098_UNCHANGED=true'
echo 'FINISHED=true'
