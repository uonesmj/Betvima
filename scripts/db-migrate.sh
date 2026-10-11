#!/usr/bin/env bash
# =====================================================================
# MIGRATIONS
#
# Applies every migration in supabase/migrations in lexical order, exactly once, and
# records what was applied (filename + SHA-256 checksum + duration) in `nova.migrations`.
#
#   * already-applied files are skipped (no risky re-runs on every deploy)
#   * an applied file that changed afterwards is DRIFT and fails the run: a deployed
#     migration is immutable, ship a new file instead
#   * `--status` lists applied/current state without touching the database
#   * `--baseline` records every file as applied without executing it (only for adopting
#     an existing database whose schema was created before this tracking existed)
#
# Usage: SUPABASE_DB_URL=postgres://... bash scripts/db-migrate.sh [--status|--baseline]
# =====================================================================
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
: "${SUPABASE_DB_URL:?SUPABASE_DB_URL is required (never commit it)}"
command -v psql >/dev/null || { echo "psql not found"; exit 1; }
MODE="${1:-apply}"
export PGOPTIONS="${PGOPTIONS:-} -c search_path=nova,public,extensions"
PSQL=(psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -q)

checksum() { sha256sum "$1" | cut -d' ' -f1; }

"${PSQL[@]}" -c "create schema if not exists nova;
  create table if not exists nova.migrations (
    filename text primary key,
    checksum text not null,
    applied_at timestamptz not null default now(),
    duration_ms int,
    baseline boolean not null default false
  );"

if [ "$MODE" = "--status" ]; then
  echo "== migration status =="
  for f in $(ls "$DIR"/supabase/migrations/*.sql | sort); do
    name="$(basename "$f")"; sum="$(checksum "$f")"
    recorded="$(psql "$SUPABASE_DB_URL" -tAc "select checksum from nova.migrations where filename = '$name'")"
    if [ -z "$recorded" ]; then echo "  pending  $name"
    elif [ "$recorded" != "$sum" ]; then echo "  DRIFTED  $name (applied checksum differs from the file)"
    else echo "  applied  $name"; fi
  done
  exit 0
fi

status=0
for f in $(ls "$DIR"/supabase/migrations/*.sql | sort); do
  name="$(basename "$f")"; sum="$(checksum "$f")"
  recorded="$(psql "$SUPABASE_DB_URL" -tAc "select checksum from nova.migrations where filename = '$name'")"
  if [ -n "$recorded" ] && [ "$recorded" != "$sum" ]; then
    echo "!! DRIFT: $name was already applied with a different checksum. Deployed migrations are immutable - create a new migration file."
    status=1
    continue
  fi
  if [ -n "$recorded" ] && [ "$MODE" != "--baseline" ]; then
    continue
  fi
  if [ "$MODE" = "--baseline" ]; then
    "${PSQL[@]}" -c "insert into nova.migrations (filename, checksum, baseline) values ('$name', '$sum', true)
                     on conflict (filename) do update set checksum = excluded.checksum, baseline = true;"
    echo "-- baselined $name"
    continue
  fi
  echo "-- applying $name"
  started=$(date +%s%3N)
  "${PSQL[@]}" -f "$f"
  elapsed=$(( $(date +%s%3N) - started ))
  "${PSQL[@]}" -c "insert into nova.migrations (filename, checksum, duration_ms) values ('$name', '$sum', $elapsed)
                   on conflict (filename) do update set checksum = excluded.checksum, applied_at = now(), duration_ms = excluded.duration_ms;"
done

[ "$status" -eq 0 ] || { echo "== migrations FAILED (drift detected) =="; exit 1; }
echo "== migrations complete =="
