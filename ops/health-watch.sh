#!/usr/bin/env bash
# =====================================================================
# HEALTH WATCH
#
# Polls the readiness probe and the database invariants and writes a single line per run so
# that cron output (or a log-based alert) shows the truth: ok / degraded / down.
#
#   SITE_URL=https://nova.example.com SUPABASE_DB_URL=postgres://... bash ops/health-watch.sh
#
# Cron (every minute):
#   * * * * * SITE_URL=https://nova.example.com SUPABASE_DB_URL="$SUPABASE_DB_URL" \
#     bash /srv/nova-sportsbook/ops/health-watch.sh >> /var/log/nova/health.log 2>&1
# =====================================================================
set -uo pipefail
cd "$(dirname "$0")/.."

SITE_URL="${SITE_URL:-http://127.0.0.1:3000}"
STAMP="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

READY_CODE="000"
READY_BODY=""
if command -v curl >/dev/null 2>&1; then
  READY_BODY="$(curl -s --max-time 10 -w '\n%{http_code}' "${SITE_URL%/}/api/health/ready" || true)"
  READY_CODE="$(printf '%s' "$READY_BODY" | tail -1)"
  READY_BODY="$(printf '%s' "$READY_BODY" | sed '$d')"
fi

DB_STATE="unknown"
LEDGER_STATE="unknown"
WORKERS="unknown"
if [ -n "${SUPABASE_DB_URL:-}" ] && command -v psql >/dev/null 2>&1; then
  DB_STATE="$(psql "$SUPABASE_DB_URL" -tAc "select 1" >/dev/null 2>&1 && echo up || echo down)"
  LEDGER_STATE="$(psql "$SUPABASE_DB_URL" -tAc "select count(*) from nova.wallets w where w.balance_minor <> coalesce((select sum(t.amount_minor) from nova.wallet_transactions t where t.wallet_id = w.id and t.status='posted'),0)" 2>/dev/null || echo unknown)"
  WORKERS="$(psql "$SUPABASE_DB_URL" -tAc "select count(*) from nova.worker_heartbeats where last_seen_at > now() - interval '5 minutes'" 2>/dev/null || echo unknown)"
fi

STATUS="ok"
[ "$READY_CODE" = "200" ] || STATUS="degraded"
[ "$DB_STATE" = "up" ] || STATUS="down"
[ "$LEDGER_STATE" = "0" ] || STATUS="down"

printf '%s status=%s ready=%s db=%s ledger_mismatches=%s workers_5m=%s url=%s\n' \
  "$STAMP" "$STATUS" "$READY_CODE" "$DB_STATE" "$LEDGER_STATE" "$WORKERS" "$SITE_URL"

[ "$STATUS" = "ok" ] || exit 1
