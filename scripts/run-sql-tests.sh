#!/usr/bin/env bash
# Runs migrations + every SQL test suite against a real PostgreSQL instance.
#
# The suite list is derived from the filesystem (tests/sql/NN_*_test.sql) so adding a
# suite never requires editing this script, and no suite is ever run twice.
#
# Usage: PGHOST=/var/run/postgresql PGUSER=postgres NOVA_TEST_DB=nova_test bash scripts/run-sql-tests.sh
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB="${NOVA_TEST_DB:-nova_test}"
PSQL="psql -v ON_ERROR_STOP=1 -q -X"

echo "== recreating database $DB =="
psql -q -X -c "drop database if exists $DB" postgres
psql -q -X -c "create database $DB" postgres

echo "== applying migrations =="
for f in $(ls "$DIR"/supabase/migrations/*.sql | sort); do
  echo "-- $(basename "$f")"
  $PSQL -d "$DB" -f "$f"
done

echo "== loading fixtures =="
$PSQL -d "$DB" -f "$DIR/tests/sql/00_fixtures.sql"

for f in $(ls "$DIR"/tests/sql/[0-9][0-9]_*_test.sql | sort); do
  name="$(basename "$f")"
  label="$(echo "$name" | sed -E 's/^[0-9]+_//; s/_test\.sql$//; s/_/ /g')"
  echo "== $label tests =="
  echo "-- $name"
  $PSQL -d "$DB" -f "$f"
done

echo "== concurrency =="
DB="$DB" bash "$DIR/scripts/tests/concurrent-place.sh" "$DB"
echo "== SQL TEST SUITE PASSED =="
