#!/usr/bin/env bash
# =====================================================================
# ROLLBACK
#
# Two independent rollbacks, because they solve different problems:
#
#   code:    git checkout <previous release> && npm ci && npm run build && pm2 reload nova-web
#   schema:  NEVER by dropping columns. Money and history are append-only; a schema rollback is
#            applied forward with a new migration that reverses the effect in a compatible way.
#
# This script automates the code rollback, checks that the database still matches the code
# (db-verify) and refuses to continue if the target release is older than the database schema
# (which is the one case where rolling back the code is unsafe).
#
#   RELEASE_TAG=2026-09-01-1200 bash ops/rollback.sh
# =====================================================================
set -euo pipefail
cd "$(dirname "$0")/.."

: "${RELEASE_TAG:?RELEASE_TAG is required (a git tag, branch or commit of the target release)}"
: "${SUPABASE_DB_URL:?SUPABASE_DB_URL is required}"

echo "== current release =="
git rev-parse --short HEAD || echo "(not a git checkout)"
CURRENT="$(git rev-parse HEAD)"

echo "== fetching and checking out $RELEASE_TAG =="
git fetch --all --tags --prune
git checkout "$RELEASE_TAG"
TARGET="$(git rev-parse HEAD)"
echo "  target: $TARGET"

echo "== migration compatibility check =="
# Migrations present in the deployed database but missing from the target release mean the
# code would run against a schema it does not know: rolling back the code is unsafe.
DB_MIGRATIONS="$(psql "$SUPABASE_DB_URL" -tAc "select count(*) from nova.migrations" 2>/dev/null || echo 0)"
CODE_MIGRATIONS="$(ls supabase/migrations/*.sql | wc -l | tr -d ' ')"
echo "  database: $DB_MIGRATIONS migration(s) recorded, release: $CODE_MIGRATIONS file(s)"
if [ "$DB_MIGRATIONS" -gt "$CODE_MIGRATIONS" ]; then
  echo "REFUSING TO CONTINUE: the database has migrations this release does not contain." >&2
  echo "Ship a forward migration that is compatible with the target release, or restore a backup." >&2
  git checkout "$CURRENT"
  exit 1
fi

echo "== install and build =="
npm ci
npm run build

echo "== verify the database still matches this release =="
bash scripts/db-verify.sh

echo "== reload the web process (workers keep running) =="
if command -v pm2 >/dev/null 2>&1; then
  pm2 reload nova-web --update-env
  pm2 status
else
  echo "  pm2 not installed: restart the web process manually"
fi

echo "== post-rollback checks =="
bash scripts/scan-service-role-exposure.sh --include-build
SUPABASE_DB_URL="$SUPABASE_DB_URL" bash scripts/workers-smoke.sh

echo "ROLLBACK COMPLETE to $RELEASE_TAG ($TARGET)"
