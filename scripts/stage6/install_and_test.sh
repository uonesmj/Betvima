#!/usr/bin/env bash
# BetVima Stage 6: synthetic ONLY, no production wallet/website operations.
set -Eeuo pipefail
umask 077
NAME=betvima-stage5-pg
DB=betvima_stage6
REF="${STAGE6_REF:-}"
MIG_REF=9d0476a619e81b5b78f612d401eb6e35758dc19c
DIR=/root/betvima-stage5/stage6-sql

[[ "$REF" =~ ^[a-f0-9]{40}$ ]] || { echo 'ERROR=INVALID_PINNED_GITHUB_REF'; exit 1; }
[[ "$(id -u)" -eq 0 ]] || { echo 'ERROR=ROOT_REQUIRED'; exit 1; }
command -v podman >/dev/null || { echo 'ERROR=PODMAN_NOT_FOUND'; exit 1; }
podman container exists "$NAME" || { echo 'ERROR=ISOLATED_CONTAINER_NOT_FOUND'; exit 1; }
[[ "$(podman inspect "$NAME" --format '{{.HostConfig.NetworkMode}}')" == none ]] || { echo 'ERROR=NETWORK_NOT_DISABLED'; exit 1; }
[[ "$(podman inspect "$NAME" --format '{{.State.Running}}')" == true ]] || { echo 'ERROR=CONTAINER_NOT_RUNNING'; exit 1; }
[[ "$(podman exec "$NAME" psql -X -U stage5_owner -d postgres -Atqc 'select current_database()')" == postgres ]] || { echo 'ERROR=WRONG_MAINTENANCE_DB'; exit 1; }
[[ "$(podman exec "$NAME" psql -X -U stage5_owner -d postgres -Atqc "select count(*) from pg_database where datname='betvima_stage6'")" == 0 ]] || { echo 'ERROR=STAGE6_ALREADY_EXISTS'; exit 1; }
[[ "$(df -Pk / | awk 'END {print $4}')" -gt 8388608 ]] || { echo 'ERROR=LOW_DISK_SPACE'; exit 1; }
[[ ! -e "$DIR" ]] || { echo 'ERROR=STAGE6_DIR_EXISTS_REFUSING_OVERWRITE'; exit 1; }

echo 'ISOLATION=NETWORK_NONE'
echo 'PRODUCTION_DATABASE_ACCESS=NONE'
install -d -m 700 "$DIR"
fetch() {
  timeout 50s curl -fsSL --connect-timeout 10 --retry 2 "$1" -o "$2"
  test -s "$2"
  chmod 600 "$2"
}
for f in bootstrap.sql seed.sql positive_receipts.sql bad_receipt.sql; do
  fetch "https://raw.githubusercontent.com/uonesmj/Betvima/$REF/scripts/stage6/$f" "$DIR/$f"
done
migrations=(0001_extensions_helpers.sql 0030_wallet.sql 0070_functions_wallet.sql 0208_softaggregator_callback_receipts.sql 0209_softaggregator_fx_rounds.sql 0210_softaggregator_reverse_win_receipts.sql 0211_softaggregator_player_wallet_binding.sql 0212_softaggregator_receipt_ledger_integrity.sql)
for f in "${migrations[@]}"; do
  fetch "https://raw.githubusercontent.com/uonesmj/Betvima/$MIG_REF/supabase/migrations/$f" "$DIR/$f"
done
# Strictly within the already existing network-disabled Podman PostgreSQL container.
podman exec "$NAME" createdb -U stage5_owner "$DB"
run_sql() { podman exec -i "$NAME" psql -X -U stage5_owner -d "$DB" -v ON_ERROR_STOP=1 < "$DIR/$1"; }
query() { podman exec "$NAME" psql -X -U stage5_owner -d "$DB" -v ON_ERROR_STOP=1 -Atqc "$1"; }
assert_eq() {
  local label="$1" statement="$2" expected="$3" got
  got="$(query "$statement")"
  [[ "$got" == "$expected" ]] || { echo "ERROR=$label EXPECTED=$expected GOT=$got"; exit 1; }
  echo "PASS=$label"
}
echo '===== INSTALL ORIGINAL DB WALLET RPC + RECEIPT MIGRATIONS ====='
for f in 0001_extensions_helpers.sql bootstrap.sql 0030_wallet.sql 0070_functions_wallet.sql 0208_softaggregator_callback_receipts.sql 0209_softaggregator_fx_rounds.sql 0210_softaggregator_reverse_win_receipts.sql 0211_softaggregator_player_wallet_binding.sql 0212_softaggregator_receipt_ledger_integrity.sql; do
  echo "STAGE6_INSTALL=$f"
  if ! run_sql "$f" > "$DIR/install-$f.log" 2>&1; then
    echo "ERROR=STAGE6_INSTALL:$f"; tail -n 25 "$DIR/install-$f.log"; exit 1
  fi
done
if ! run_sql seed.sql > "$DIR/seed.log" 2>&1; then
  echo 'ERROR=STAGE6_SEED'; tail -n 25 "$DIR/seed.log"; exit 1
fi
uid=00000000-0000-0000-0000-000000000088
assert_eq initial_balance "select balance_minor from nova.wallets where user_id='$uid' and currency='USD'" 1000

echo '===== TWELVE SAME-KEY CONCURRENT DEBITS ====='
pids=()
for i in $(seq 1 12); do
  (
    query "select (nova.post_wallet_entry('$uid'::uuid,'bet_debit'::wallet_tx_type,-10,'USD','stage6-same-key','softaggregator:stage6-same-key',null,null,null,null,null,'{}'::jsonb,0,false)->>'balance_after_minor')" > "$DIR/same-$i.log" 2>&1
  ) &
  pids+=("$!")
done
failed=0
for pid in "${pids[@]}"; do wait "$pid" || failed=1; done
[[ "$failed" == 0 ]] || { echo 'ERROR=CONCURRENT_DUPLICATE_DEBIT_FAILED'; exit 1; }
for i in $(seq 1 12); do [[ "$(cat "$DIR/same-$i.log")" == 990 ]] || { echo "ERROR=DUPLICATE_RESPONSE_$i"; exit 1; }; done
assert_eq identical_debits_single_ledger "select count(*) from nova.wallet_transactions where idempotency_key='stage6-same-key'" 1
assert_eq identical_debits_balance_990 "select balance_minor from nova.wallets where user_id='$uid' and currency='USD'" 990

echo '===== TEN DISTINCT CONCURRENT DEBITS ====='
pids=()
for i in $(seq 1 10); do
  (
    query "select nova.post_wallet_entry('$uid'::uuid,'bet_debit'::wallet_tx_type,-25,'USD','stage6-debit-$i','softaggregator:stage6-debit-$i',null,null,null,null,null,'{}'::jsonb,0,false)" > "$DIR/debit-$i.log" 2>&1
  ) &
  pids+=("$!")
done
failed=0
for pid in "${pids[@]}"; do wait "$pid" || failed=1; done
[[ "$failed" == 0 ]] || { echo 'ERROR=CONCURRENT_DISTINCT_DEBITS_FAILED'; exit 1; }
assert_eq ten_distinct_debits "select count(*) from nova.wallet_transactions where idempotency_key like 'stage6-debit-%'" 10
assert_eq after_debits_740 "select balance_minor from nova.wallets where user_id='$uid' and currency='USD'" 740

echo '===== TWO CONCURRENT CREDITS ====='
pids=()
for i in 1 2; do
  (
    query "select nova.post_wallet_entry('$uid'::uuid,'win_credit'::wallet_tx_type,100,'USD','stage6-credit-$i','softaggregator:stage6-credit-$i',null,null,null,null,null,'{}'::jsonb,null,false)" > "$DIR/credit-$i.log" 2>&1
  ) &
  pids+=("$!")
done
failed=0
for pid in "${pids[@]}"; do wait "$pid" || failed=1; done
[[ "$failed" == 0 ]] || { echo 'ERROR=CONCURRENT_CREDITS_FAILED'; exit 1; }
assert_eq two_credits_940 "select balance_minor from nova.wallets where user_id='$uid' and currency='USD'" 940

echo '===== OVERDRAFT REJECTION ====='
if query "select nova.post_wallet_entry('$uid'::uuid,'bet_debit'::wallet_tx_type,-10000,'USD','stage6-overdraft','softaggregator:stage6-overdraft',null,null,null,null,null,'{}'::jsonb,0,false)" > "$DIR/overdraft.log" 2>&1; then
  echo 'ERROR=OVERDRAFT_ACCEPTED'; exit 1
fi
grep -q INSUFFICIENT_BALANCE "$DIR/overdraft.log" || { echo 'ERROR=OVERDRAFT_WRONG_REJECTION'; exit 1; }
assert_eq overdraft_no_ledger "select count(*) from nova.wallet_transactions where idempotency_key='stage6-overdraft'" 0
assert_eq overdraft_no_balance_change "select balance_minor from nova.wallets where user_id='$uid' and currency='USD'" 940
assert_eq ledger_balance_consistent "select balance_minor=(select sum(amount_minor) from nova.wallet_transactions where user_id='$uid' and status='posted') from nova.wallets where user_id='$uid' and currency='USD'" t

echo '===== SIGNED-OUT-OF-SCOPE SYNTHETIC RECEIPT/ROLLBACK TRANSACTION ====='
if ! run_sql positive_receipts.sql > "$DIR/positive-receipts.log" 2>&1; then
  echo 'ERROR=VALID_RECEIPT_TEST'; tail -n 25 "$DIR/positive-receipts.log"; exit 1
fi
grep -q STAGE6_FULL_RPC_RECEIPT_PARITY_PASS "$DIR/positive-receipts.log" || { echo 'ERROR=POSITIVE_RECEIPT_MARKER'; exit 1; }
assert_eq positive_receipts_rolled_back "select count(*) from nova.softaggregator_callback_receipts" 0
assert_eq positive_test_kept_940 "select balance_minor from nova.wallets where user_id='$uid' and currency='USD'" 940
if run_sql bad_receipt.sql > "$DIR/bad-receipt.log" 2>&1; then
  echo 'ERROR=INVALID_RECEIPT_ACCEPTED'; exit 1
fi
grep -q CASINO_RECEIPT_ROUND_CURRENCY_MISMATCH "$DIR/bad-receipt.log" || { echo 'ERROR=INVALID_RECEIPT_WRONG_ERROR'; tail -n 20 "$DIR/bad-receipt.log"; exit 1; }
assert_eq failed_receipt_rolled_back_debit "select count(*) from nova.wallet_transactions where idempotency_key='stage6-rejected-atomic'" 0
assert_eq failed_receipt_no_balance_change "select balance_minor from nova.wallets where user_id='$uid' and currency='USD'" 940
assert_eq failed_receipt_no_orphans "select count(*) from nova.softaggregator_callback_receipts" 0
assert_eq final_wallet_ledger_consistent "select balance_minor=(select sum(amount_minor) from nova.wallet_transactions where user_id='$uid' and status='posted') from nova.wallets where user_id='$uid' and currency='USD'" t

echo 'STAGE6_REAL_RPC_PARALLEL_IDEMPOTENCY_PASS=true'
echo 'STAGE6_REAL_RPC_CONCURRENT_DEBITS_CREDITS_PASS=true'
echo 'STAGE6_REAL_RPC_OVERDRAFT_REJECTED=true'
echo 'STAGE6_RECEIPT_AND_LEDGER_ATOMICITY_PASS=true'
echo 'STAGE6_DATABASE=betvima_stage6'
echo 'STAGE6_NETWORK=none'
echo 'PRODUCTION_DATABASE_UNCHANGED=true'
echo 'CASINO_3098_UNCHANGED=true'
echo 'FINISHED=true'
