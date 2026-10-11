#!/usr/bin/env bash
# =====================================================================
# RESTORE DRILL
#
# An untested backup is not a backup. This restores the newest dump into a scratch database,
# re-runs the schema/financial verification against it and drops it again.
#
#   RESTORE_TEST_DB=nova_restore_test SUPABASE_DB_URL=<admin url> BACKUP_DIR=/var/backups/nova \
#     bash ops/restore-test.sh
#
# Weekly cron is a reasonable cadence; run it manually before every risky migration.
# =====================================================================
set -euo pipefail
cd "$(dirname "$0")/.."

: "${SUPABASE_DB_URL:?SUPABASE_DB_URL is required (a role that may create databases)}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/nova}"
TARGET="${RESTORE_TEST_DB:-nova_restore_test}"

DUMP="${1:-}"
if [ -z "$DUMP" ]; then
  DUMP="$(ls -1t "$BACKUP_DIR"/nova-*.dump 2>/dev/null | head -1 || true)"
fi
[ -n "$DUMP" ] || { echo "no dump found in $BACKUP_DIR (pass one as the first argument)" >&2; exit 1; }
[ -f "$DUMP" ] || { echo "dump not found: $DUMP" >&2; exit 1; }

echo "== restoring $DUMP into $TARGET =="
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -q -c "drop database if exists $TARGET"
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -q -c "create database $TARGET"

RESTORE_URL="$(TARGET_DB="$TARGET" node -e '
  const url = new URL(process.env.SUPABASE_DB_URL);
  url.pathname = "/" + process.env.TARGET_DB;
  process.stdout.write(url.toString());
')"

pg_restore --dbname="$RESTORE_URL" --no-owner --no-privileges --exit-on-error "$DUMP"

echo "== verifying the restored database =="
SUPABASE_DB_URL="$RESTORE_URL" bash scripts/db-verify.sh

echo "== comparing key totals with the live database =="
for q in \
  "select count(*) from nova.profiles" \
  "select count(*) from nova.bets" \
  "select coalesce(sum(amount_minor),0) from nova.wallet_transactions where status='posted'" \
  "select coalesce(sum(amount_minor),0) from nova.affiliate_ledger" ; do
  live="$(psql "$SUPABASE_DB_URL" -tAc "$q" | tr -d ' ')"
  restored="$(psql "$RESTORE_URL" -tAc "$q" | tr -d ' ')"
  printf '  %-70s live=%s restored=%s\n' "$q" "$live" "$restored"
  if [ "$live" != "$restored" ]; then
    echo "MISMATCH: the restore does not match the live database (expected when the dump is not the newest)" >&2
  fi
done

echo "== dropping the scratch database =="
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -q -c "drop database $TARGET"
echo "RESTORE DRILL COMPLETE"
