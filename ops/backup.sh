#!/usr/bin/env bash
# =====================================================================
# BACKUP
#
# Takes a logical backup of the authoritative database plus the deploy manifest, verifies the
# archive, and prunes old copies. Money is only ever in the database, so the database dump is
# the backup that matters.
#
#   BACKUP_DIR=/var/backups/nova  SUPABASE_DB_URL=postgres://...  bash ops/backup.sh
#
# Cron:
#   15 * * * * BACKUP_DIR=/var/backups/nova SUPABASE_DB_URL="$SUPABASE_DB_URL" bash /srv/nova-sportsbook/ops/backup.sh
# =====================================================================
set -euo pipefail
cd "$(dirname "$0")/.."

: "${SUPABASE_DB_URL:?SUPABASE_DB_URL is required}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/nova}"
RETAIN="${RETAIN:-72}"                # keep the last 72 files (3 days of hourly backups)
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FILE="$BACKUP_DIR/nova-$STAMP.dump"

mkdir -p "$BACKUP_DIR"
command -v pg_dump >/dev/null || { echo "pg_dump not found" >&2; exit 1; }

echo "== dumping to $FILE =="
# Custom format: compressed, restorable with pg_restore, includes large objects.
pg_dump "$SUPABASE_DB_URL" --format=custom --compress=6 --no-owner --no-privileges --file="$FILE"

echo "== verifying archive =="
if ! pg_restore --list "$FILE" >/dev/null; then
  echo "backup verification FAILED: $FILE is not a readable archive" >&2
  rm -f "$FILE"
  exit 1
fi

echo "== recording deploy manifest =="
{
  echo "stamp=$STAMP"
  echo "git_commit=$(git -C "$(dirname "$0")/.." rev-parse --short HEAD 2>/dev/null || echo none)"
  echo "build_id=$(cat .next/BUILD_ID 2>/dev/null || echo none)"
  echo "node=$(node -v 2>/dev/null || echo none)"
  echo "migrations=$(psql "$SUPABASE_DB_URL" -tAc "select count(*) from nova.migrations" 2>/dev/null || echo unknown)"
  echo "wallets=$(psql "$SUPABASE_DB_URL" -tAc "select count(*) from nova.wallets" 2>/dev/null || echo unknown)"
  echo "ledger_sum_minor=$(psql "$SUPABASE_DB_URL" -tAc "select coalesce(sum(amount_minor),0) from nova.wallet_transactions where status='posted'" 2>/dev/null || echo unknown)"
} > "$BACKUP_DIR/nova-$STAMP.manifest"

echo "== checksum =="
sha256sum "$FILE" >> "$BACKUP_DIR/nova-$STAMP.manifest"
cat "$BACKUP_DIR/nova-$STAMP.manifest"

echo "== pruning (keeping the newest $RETAIN dumps) =="
ls -1t "$BACKUP_DIR"/nova-*.dump 2>/dev/null | tail -n +$((RETAIN + 1)) | while read -r old; do
  rm -f "$old" "$(dirname "$old")/$(basename "$old" .dump).manifest"
  echo "  removed $(basename "$old")"
done

echo "BACKUP COMPLETE: $FILE"
