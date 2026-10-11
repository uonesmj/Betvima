#!/usr/bin/env bash
# =====================================================================
# BUILD THE FINAL DELIVERY ARCHIVE
#
# Produces sportsbook-production-final.tar.gz containing the complete source tree plus a
# manifest (counts, migration list, checksums, verification summary). Build output, dependency
# directories, test results and scratch files are excluded by design - the recipient runs
# `npm ci && npm run build`.
#
#   bash scripts/make-archive.sh [output-dir]
# =====================================================================
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="${1:-$DIR}"
cd "$DIR"

NAME="sportsbook-production-final"
STAMPED="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

echo "== staging files =="
mkdir -p "$WORK/$NAME"
tar -cf - \
  --exclude='./node_modules' --exclude='./.next' --exclude='./.git' \
  --exclude='./test-results' --exclude='./playwright-report' --exclude='./tmp' \
  --exclude='./coverage' --exclude='./.env.local' --exclude='./.env' \
  --exclude='*.log' --exclude='*.tsbuildinfo' \
  . | (cd "$WORK/$NAME" && tar -xf -)

echo "== manifest =="
{
  echo "NOVA SPORTSBOOK - production archive"
  echo "generated_at: $STAMPED"
  echo "host: $(uname -srm)"
  echo "node: $(node --version 2>/dev/null || echo unknown)"
  echo "npm: $(npm --version 2>/dev/null || echo unknown)"
  echo
  echo "files:        $(find "$WORK/$NAME" -type f | wc -l)"
  echo "ts/tsx files: $(find "$WORK/$NAME" -name '*.ts' -o -name '*.tsx' | wc -l)"
  echo "migrations:   $(ls "$WORK/$NAME"/supabase/migrations/*.sql | wc -l)"
  echo "api routes:   $(find "$WORK/$NAME/src/app/api" -name route.ts | wc -l)"
  echo "pages:        $(find "$WORK/$NAME/src/app" -name page.tsx | wc -l)"
  echo "unit suites:  $(ls "$WORK/$NAME"/tests/unit | wc -l)"
  echo "sql suites:   $(ls "$WORK/$NAME"/tests/sql/*_test.sql | wc -l)"
  echo "docs:         $(ls "$WORK/$NAME"/docs/*.md | wc -l)"
  echo
  echo "migrations:"
  for f in "$WORK/$NAME"/supabase/migrations/*.sql; do echo "  $(basename "$f")  $(sha256sum "$f" | cut -c1-16)"; done
  echo
  echo "top-level:"
  (cd "$WORK/$NAME" && ls -1 | sed 's/^/  /')
} > "$WORK/$NAME/ARCHIVE_MANIFEST.txt"
cat "$WORK/$NAME/ARCHIVE_MANIFEST.txt"

echo "== writing archive =="
mkdir -p "$OUT_DIR"
ARCHIVE="$OUT_DIR/$NAME.tar.gz"
tar -czf "$ARCHIVE" -C "$WORK" "$NAME"
sha256sum "$ARCHIVE" | tee "$ARCHIVE.sha256"
echo "ARCHIVE COMPLETE: $ARCHIVE ($(du -h "$ARCHIVE" | cut -f1))"
