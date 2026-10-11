#!/usr/bin/env bash
# CONCURRENCY TEST (spec §14): N parallel placements of the SAME idempotency key must
# produce exactly ONE bet and ONE wallet debit; insufficient funds must never go negative.
set -euo pipefail
DB="${1:-nova_test}"
PSQL="psql -q -X -v ON_ERROR_STOP=1 -d $DB"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

SETUP=$($PSQL -t -A -c "
  select u::text || '|' || m::text from (
    select tests.make_user('race@test.local','user','active',true,'IRT',100000) as u,
           tests.make_match(25000) as m) s;")
USER_ID="${SETUP%%|*}"; MATCH_ID="${SETUP##*|}"
SEL_ID=$($PSQL -t -A -c "select tests.selection_of('$MATCH_ID','HOME')::text")
MARKET_ID=$($PSQL -t -A -c "select tests.market_of('$MATCH_ID')::text")

race_call() {
  local key="$1" out="$2"
  psql -q -X -d "$DB" -t -A -c "
    select coalesce(nova.place_bet('$USER_ID','$key','SINGLE',50000,'IRT',
      jsonb_build_array(jsonb_build_object('match_id','$MATCH_ID','market_id','$MARKET_ID','selection_id','$SEL_ID','odds_seen',25000,'odds_version',1)),
      false,'test',null,'race',null,null)->>'idempotent_replay','ERR');" >"$out" 2>&1 || echo "ERR" > "$out"
}

# --- 8 concurrent requests with the SAME key
for i in $(seq 1 8); do race_call "race-same-key-0001" "$TMP/same_$i.out" & done
wait
BETS=$($PSQL -t -A -c "select count(*) from nova.bets where user_id='$USER_ID'")
DEBITS=$($PSQL -t -A -c "select count(*) from nova.wallet_transactions where user_id='$USER_ID' and type='bet_debit'")
BALANCE=$($PSQL -t -A -c "select balance_minor from nova.wallets where user_id='$USER_ID' and currency='IRT'")
[ "$BETS" = "1" ] || { echo "FAIL: expected 1 bet, got $BETS"; exit 1; }
[ "$DEBITS" = "1" ] || { echo "FAIL: expected 1 debit, got $DEBITS"; exit 1; }
[ "$BALANCE" = "50000" ] || { echo "FAIL: expected balance 50000, got $BALANCE"; exit 1; }
echo "OK: 8 concurrent identical requests -> 1 bet, 1 debit, balance 50000"

# --- 4 concurrent DIFFERENT keys with only enough balance for one
for i in $(seq 1 4); do race_call "race-diff-key-000$i" "$TMP/diff_$i.out" & done
wait
BETS2=$($PSQL -t -A -c "select count(*) from nova.bets where user_id='$USER_ID'")
BALANCE2=$($PSQL -t -A -c "select balance_minor from nova.wallets where user_id='$USER_ID' and currency='IRT'")
[ "$BETS2" = "2" ] || { echo "FAIL: expected exactly 1 additional bet, got $BETS2"; exit 1; }
[ "$BALANCE2" = "0" ] || { echo "FAIL: expected balance 0 (and never below), got $BALANCE2"; exit 1; }
echo "OK: 4 concurrent distinct stakes on a 50,000 balance -> exactly 1 accepted, balance 0 (never negative)"

# --- ledger integrity after the race
MISMATCH=$($PSQL -t -A -c "select count(*) from nova.wallets w where w.balance_minor <> coalesce((select sum(t.amount_minor) from nova.wallet_transactions t where t.wallet_id=w.id and t.status='posted'),0)")
[ "$MISMATCH" = "0" ] || { echo "FAIL: wallet/ledger mismatch after race"; exit 1; }
echo "OK: wallet balance equals ledger sum after concurrent load"
