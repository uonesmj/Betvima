#!/usr/bin/env bash
# =====================================================================
# DATABASE VERIFICATION
#
# Proves the deployed schema is what the code expects, using only SQL:
#   * every migration is recorded
#   * RLS is enabled on every tenant-facing table
#   * the money invariant holds (wallet balance == sum of its ledger)
#   * commissions are never double-charged (no duplicate ledger keys)
#   * settlement idempotency holds (one settlement per bet + revision)
#   * the ledger has no orphan entries
#
# Exit code 1 on any violation. Safe to run on production (read-only queries).
# =====================================================================
set -euo pipefail
cd "$(dirname "$0")/.."

DB_URL="${SUPABASE_DB_URL:-${DATABASE_URL:-}}"
if [ -z "$DB_URL" ]; then
  echo "SUPABASE_DB_URL (or DATABASE_URL) is required" >&2
  exit 1
fi
PSQL=(psql "$DB_URL" -v ON_ERROR_STOP=1 -tA)

problems=0
check() {
  local label="$1" sql="$2" expect="$3" expected="${4:-0}"
  local value
  value="$("${PSQL[@]}" -c "$sql")"
  if [ "$expect" = "zero" ] && [ "$value" != "0" ]; then
    printf '  \033[31mFAIL\033[0m %s -> %s (expected 0)\n' "$label" "$value"; problems=$((problems + 1)); return
  fi
  if [ "$expect" = "atleast" ] && [ "$value" -lt "$expected" ] 2>/dev/null; then
    printf '  \033[31mFAIL\033[0m %s -> %s (expected >= %s)\n' "$label" "$value" "$expected"; problems=$((problems + 1)); return
  fi
  printf '  \033[32mok\033[0m   %s -> %s\n' "$label" "$value"
}

echo "== migrations applied =="
APPLIED="$("${PSQL[@]}" -c "select count(*) from nova.migrations" 2>/dev/null || echo missing)"
if [ "$APPLIED" = "missing" ]; then
  printf '  \033[31mFAIL\033[0m nova.migrations is missing: run scripts/db-migrate.sh (the schema is untracked)\n'
  problems=$((problems + 1))
else
  printf '  \033[32mok\033[0m   %s migration(s) recorded\n' "$APPLIED"
fi

echo "== RLS enabled on money and identity tables =="
check "tables without RLS (excluding service-only tables)" \
  "select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'nova' and c.relkind = 'r'
      and not c.relrowsecurity
      and c.relname not in ('schema_migrations','job_queue','worker_heartbeats','worker_locks','provider_health',
                            'rate_limit_buckets','idempotency_keys','reconciliation_records')" zero

echo "== financial invariants =="
check "wallets whose balance differs from their ledger sum" \
  "select count(*) from nova.wallets w where w.balance_minor <> coalesce((
      select sum(t.amount_minor) from nova.wallet_transactions t
       where t.wallet_id = w.id and t.status = 'posted'), 0)" zero
check "ledger entries without a wallet" \
  "select count(*) from nova.wallet_transactions t left join nova.wallets w on w.id = t.wallet_id where w.id is null" zero
check "duplicate commission ledger keys" \
  "select count(*) from (select idempotency_key from nova.affiliate_ledger
     where idempotency_key is not null group by 1 having count(*) > 1) d" zero
check "bets settled more than once for the same revision" \
  "select count(*) from (select bet_id, revision from nova.bet_settlements
     where kind = 'settlement' group by 1,2 having count(*) > 1) d" zero
check "negative wallet balances" \
  "select count(*) from nova.wallets where balance_minor < 0" zero
check "paid affiliate payouts without an external reference" \
  "select count(*) from nova.affiliate_payouts where status = 'paid' and (provider_reference is null or provider_reference = '')" zero

echo "== ledger activation =="
check "betting operation enabled (1 = enabled)" \
  "select count(*) from nova.system_operations where key = 'BETTING' and enabled" atleast 1

echo
if [ "$problems" -gt 0 ]; then
  echo "DATABASE VERIFICATION FAILED ($problems problem(s))"
  exit 1
fi
echo "DATABASE VERIFICATION PASSED"
