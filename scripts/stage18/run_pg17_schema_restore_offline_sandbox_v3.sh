#!/usr/bin/env bash
# Stage18B: restore schema-only archive to a THROWAWAY, NO-NETWORK Postgres.
# Fail-closed. Never connect to production or an existing Supabase project.
# No customer rows, funds, payments, eligibility changes, or casino deployment.
set -Eeuo pipefail
umask 077
ROOT=/root/betvima-stage5
ARCHIVE="$ROOT/stage17-schema-only.l6OC0V/private-nova-schema-only.dump"
EXPECTED_SHA="1d297d5dec78418afc4ca019614af8e344f725a3a95f0a47a8dcadcade0e4a61"
NAME=""
SOCKET=""
RESTORE_LOG=""
cleanup(){
  local rc=$?
  trap - EXIT
  if [[ -n "$NAME" ]]; then podman rm --force "$NAME" >/dev/null 2>&1 || true; fi
  if [[ -n "$SOCKET" && "$SOCKET" == "$ROOT"/stage18b-socket.* && -d "$SOCKET" ]]; then
    rm -rf -- "$SOCKET"
  fi
  if [[ -n "$RESTORE_LOG" && "$RESTORE_LOG" == "$ROOT"/stage18b-restore-error.* && -f "$RESTORE_LOG" ]]; then
    rm -f -- "$RESTORE_LOG"
  fi
  echo "STAGE18B_TEMP_CONTAINER_REMOVED=true"
  echo "STAGE18B_LIVE_3098_CHANGED=false"
  exit "$rc"
}
trap cleanup EXIT
echo '===== STAGE18B OFFLINE SCHEMA RESTORE EXPERIMENT ====='
[[ "$(id -u)" -eq 0 ]] || { echo 'STAGE18B_ABORT=ROOT_REQUIRED'; exit 2; }
command -v podman >/dev/null || { echo 'STAGE18B_ABORT=PODMAN_UNAVAILABLE'; exit 2; }
command -v sha256sum >/dev/null || { echo 'STAGE18B_ABORT=SHA256_TOOL_MISSING'; exit 2; }
command -v timeout >/dev/null || { echo 'STAGE18B_ABORT=TIMEOUT_TOOL_MISSING'; exit 2; }
[[ -f "$ARCHIVE" && ! -L "$ARCHIVE" ]] ||
  { echo 'STAGE18B_ABORT=ARCHIVE_MISSING_OR_SYMLINK'; exit 2; }
[[ "$(stat -c '%a' "$ARCHIVE")" == 600 ]] ||
  { echo 'STAGE18B_ABORT=ARCHIVE_PERMISSIONS'; exit 2; }
[[ "$(sha256sum "$ARCHIVE" | cut -d ' ' -f1)" == "$EXPECTED_SHA" ]] ||
  { echo 'STAGE18B_ABORT=SCHEMA_ARCHIVE_HASH_MISMATCH'; exit 2; }
[[ ! -L "$ROOT" && -d "$ROOT" ]] ||
  { echo 'STAGE18B_ABORT=WORKDIR_UNEXPECTED'; exit 2; }
[[ "$(podman inspect betvima-stage5-pg --format '{{.HostConfig.NetworkMode}}' 2>/dev/null)" == none ]] ||
  { echo 'STAGE18B_ABORT=REFERENCE_CONTAINER_NOT_ISOLATED'; exit 2; }
REFERENCE_IMAGE="$(podman inspect betvima-stage5-pg --format '{{.ImageName}}')"
[[ -n "$REFERENCE_IMAGE" && "$REFERENCE_IMAGE" == *postgres* ]] ||
  { echo 'STAGE18B_ABORT=UNEXPECTED_REFERENCE_IMAGE'; exit 2; }
podman image exists "$REFERENCE_IMAGE" ||
  { echo 'STAGE18B_ABORT=REFERENCE_IMAGE_NOT_CACHED'; exit 2; }
# The Stage11 reference image may contain PostgreSQL 15/16; do not assume
# that an earlier successful SQL test guarantees a PostgreSQL 17 server.
# Run the VERSION command in an offline throwaway container (not the database).
verify_pg17_image(){
  local candidate="$1" version
  podman image exists "$candidate" || return 1
  version="$(timeout 15s podman run --rm --pull=never --network none \
    --entrypoint postgres "$candidate" -V 2>/dev/null)" || return 1
  [[ "$version" =~ ^postgres\ \(PostgreSQL\)\ 17\. ]]
}
IMAGE="$REFERENCE_IMAGE"
if verify_pg17_image "$IMAGE"; then
  echo 'STAGE18B_REFERENCE_IMAGE_POSTGRES17=PASS'
else
  echo 'STAGE18B_REFERENCE_IMAGE_POSTGRES17=false'
  IMAGE='docker.io/library/postgres:17.11-bookworm'
  if ! podman image exists "$IMAGE"; then
    # Network is used only to retrieve the official container IMAGE before
    # starting the sandbox. No archive, credentials or users are provided.
    echo 'STAGE18B_POSTGRES17_IMAGE_DOWNLOAD=REQUIRED'
    if ! timeout 180s podman pull --quiet "$IMAGE" >/dev/null; then
      echo 'STAGE18B_ABORT=OFFICIAL_POSTGRES17_IMAGE_PULL_FAILED'
      exit 2
    fi
  fi
  verify_pg17_image "$IMAGE" ||
    { echo 'STAGE18B_ABORT=OFFICIAL_POSTGRES17_IMAGE_VERIFICATION_FAILED'; exit 2; }
  echo 'STAGE18B_OFFICIAL_POSTGRES17_IMAGE=VERIFIED'
fi
if podman ps -a --format '{{.Names}}' | grep -Eq '^betvima-stage18b-pg-'; then
  echo 'STAGE18B_ABORT=STALE_STAGE18B_CONTAINER_PRESENT'
  exit 2
fi
# Preflight only the local root filesystem headroom, never run cleanup on VPS.
FREE_KB="$(df -Pk "$ROOT" | awk 'END {print $4}')"
[[ "$FREE_KB" =~ ^[0-9]+$ && "$FREE_KB" -gt 1048576 ]] ||
  { echo 'STAGE18B_ABORT=DISK_HEADROOM_INSUFFICIENT'; exit 2; }
SOCKET="$(mktemp -d "$ROOT/stage18b-socket.XXXXXXXX")"
chmod 1777 "$SOCKET"
RESTORE_LOG="$(mktemp "$ROOT/stage18b-restore-error.XXXXXXXX")"
chmod 600 "$RESTORE_LOG"
NAME="betvima-stage18b-pg-$(date +%s)-$$"
echo 'STAGE18B_CONTAINER_NETWORK=NONE'
echo 'STAGE18B_PUBLIC_PORTS=0'
echo 'STAGE18B_TARGET=THROWAWAY_LOCAL_POSTGRES'
podman run -d \
  --name "$NAME" \
  --pull=never \
  --network none \
  --memory 768m \
  --cpus 1 \
  --pids-limit 128 \
  -e POSTGRES_HOST_AUTH_METHOD=trust \
  -e POSTGRES_INITDB_ARGS=--auth-local=trust \
  -v "$SOCKET:/var/run/postgresql:rw" \
  "$IMAGE" >/dev/null
[[ "$(podman inspect "$NAME" --format '{{.HostConfig.NetworkMode}}')" == none ]] ||
  { echo 'STAGE18B_ABORT=CONTAINER_NETWORK_NOT_NONE'; exit 2; }
[[ -z "$(podman port "$NAME" 2>/dev/null)" ]] ||
  { echo 'STAGE18B_ABORT=PUBLIC_PORT_DETECTED'; exit 2; }
READY=false
for i in $(seq 1 40); do
  if [[ -S "$SOCKET/.s.PGSQL.5432" ]] &&
     podman exec "$NAME" pg_isready -h /var/run/postgresql -U postgres -d postgres >/dev/null 2>&1; then
    READY=true
    break
  fi
  sleep 0.5
done
[[ "$READY" == true ]] || { echo 'STAGE18B_ABORT=TEMP_DB_NOT_READY'; exit 2; }
echo 'STAGE18B_TEMP_POSTGRES_READY=PASS'
# A running server check, only after readiness; prevents a startup race.
DB_VERSION="$(podman exec "$NAME" postgres -V 2>/dev/null || true)"
if [[ ! "$DB_VERSION" =~ ^postgres\ \(PostgreSQL\)\ 17\. ]]; then
  echo 'STAGE18B_ABORT=RUNNING_POSTGRES_MAJOR_NOT_17'
  exit 2
fi
echo 'STAGE18B_RUNNING_POSTGRES_MAJOR=17'
# This command ONLY copies the verified schema-only archive INTO the isolated
# ephemeral container; it never contains production rows or credentials.
podman cp "$ARCHIVE" "$NAME:/tmp/nova-schema.dump" >/dev/null
podman exec "$NAME" sh -c "chmod 600 /tmp/nova-schema.dump" >/dev/null
podman exec --user postgres "$NAME" createdb -h /var/run/postgresql -U postgres stage18_sandbox
echo 'STAGE18B_RESTORE_PHASE=BEGIN'
set +e
timeout --signal=TERM --kill-after=5s 130s \
  podman exec --user root "$NAME" \
    pg_restore --exit-on-error --single-transaction --schema-only \
    --no-owner --no-privileges -h /var/run/postgresql \
    -U postgres -d stage18_sandbox /tmp/nova-schema.dump \
    >"$RESTORE_LOG" 2>&1
RESTORE_RC=$?
set -e
if [[ "$RESTORE_RC" -ne 0 ]]; then
  echo 'STAGE18B_BASELINE_RESTORE=BLOCKED'
  # Only report an allowlisted metadata identifier for the FIRST PostgreSQL
  # failure; SQL source, function bodies and raw stderr stay in 0600 logfile,
  # removed automatically on exit. No credentials or private data printed.
  python3 - "$RESTORE_LOG" <<'PY'
import hashlib,re,sys
from pathlib import Path
raw=Path(sys.argv[1]).read_text(encoding='utf-8',errors='replace')
m=re.search(r'(?im)\bERROR:\s*([^\r\n]*)',raw)
err=(m.group(1) if m else '')[:2000]
category='OTHER_REDACTED'
if re.search(r'\btype\b.*\bdoes not exist\b',err,re.I): category='MISSING_TYPE'
elif re.search(r'\bfunction\b.*\bdoes not exist\b',err,re.I): category='MISSING_FUNCTION'
elif re.search(r'\bschema\b.*\bdoes not exist\b',err,re.I): category='MISSING_SCHEMA'
elif re.search(r'\bextension\b.*\b(?:not available|does not exist)\b',err,re.I): category='MISSING_EXTENSION'
elif re.search(r'\b(?:relation|table)\b.*\bdoes not exist\b',err,re.I): category='MISSING_RELATION'
elif re.search(r'\brole\b.*\bdoes not exist\b',err,re.I): category='MISSING_ROLE'
elif re.search(r'\bpermission denied|must be owner\b',err,re.I): category='PERMISSIONS'
elif re.search(r'\bsyntax error\b',err,re.I): category='SYNTAX'
elif re.search(r'\bduplicate|already exists\b',err,re.I): category='DUPLICATE'
print('STAGE18B_FIRST_ERROR_CATEGORY='+category)
print('STAGE18B_FIRST_ERROR_FINGERPRINT='+hashlib.sha256(err.encode()).hexdigest()[:12])
# Explicitly restrict output to safe SQL identifier tokens. Never print full
# original source SQL, queries, function arguments or full error log.
obj=re.search(r'(?i)\b(?:type|function|schema|extension|relation|role)\s+"?([A-Za-z_][A-Za-z_0-9.]{0,63})"?\s+(?:does not exist|is not available)',err)
if obj:
    token=obj.group(1)
    pieces=token.split('.')
    ns=pieces[0] if len(pieces)>1 else 'UNQUALIFIED'
    if ns not in ('auth','extensions','nova','public','pg_catalog','UNQUALIFIED'): ns='OTHER'
    print('STAGE18B_FIRST_MISSING_NAMESPACE='+ns.upper())
    print('STAGE18B_FIRST_MISSING_IDENTIFIER='+pieces[-1])
else:
    print('STAGE18B_FIRST_MISSING_NAMESPACE=UNKNOWN')
    print('STAGE18B_FIRST_MISSING_IDENTIFIER=UNKNOWN')
toc=re.search(r'(?im)^pg_restore: from TOC entry (\d+);',raw)
print('STAGE18B_FIRST_TOC_ENTRY='+(toc.group(1) if toc else 'UNKNOWN'))
PY
  if grep -Eiq 'schema "auth" does not exist|relation "auth[.]|schema auth does not exist' "$RESTORE_LOG"; then
    echo 'STAGE18B_FIRST_DEPENDENCY_CLASS=MANAGED_SUPABASE_AUTH_SCHEMA'
  elif grep -Eiq 'schema "extensions" does not exist|type "extensions[.]|function extensions[.]' "$RESTORE_LOG"; then
    echo 'STAGE18B_FIRST_DEPENDENCY_CLASS=MANAGED_SUPABASE_EXTENSIONS'
  elif grep -Eiq 'role ".*" does not exist|permission denied|must be owner' "$RESTORE_LOG"; then
    echo 'STAGE18B_FIRST_DEPENDENCY_CLASS=ROLES_OR_PRIVILEGES'
  elif grep -Eiq 'type .*does not exist|function .*does not exist' "$RESTORE_LOG"; then
    echo 'STAGE18B_FIRST_DEPENDENCY_CLASS=UNRESOLVED_TYPE_OR_FUNCTION'
  elif [[ "$RESTORE_RC" -eq 124 || "$RESTORE_RC" -eq 137 ]]; then
    echo 'STAGE18B_FIRST_DEPENDENCY_CLASS=RESTORE_TIMEOUT'
  else
    echo 'STAGE18B_FIRST_DEPENDENCY_CLASS=OTHER_REDACTED'
  fi
  echo 'STAGE18B_NOTE=PLAIN_POSTGRES_NOT_SUPABASE_EQUIVALENT'
  echo 'STAGE18B_ARCHIVE_INTEGRITY_ALREADY_PASSED=true'
  echo 'STAGE18B_PRODUCTION_DB_CONNECTIONS=0'
  exit 3
fi
echo 'STAGE18B_BASELINE_RESTORE=PASS'
COUNTS="$(podman exec --user postgres "$NAME" psql -XAt -h /var/run/postgresql -U postgres -d stage18_sandbox -v ON_ERROR_STOP=1 -c "
  select
   (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='nova' and c.relkind='r') || ',' ||
   (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='nova') || ',' ||
   (select count(*) from pg_trigger g join pg_class c on c.oid=g.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='nova' and not g.tgisinternal) || ',' ||
   (select count(*) from pg_policies where schemaname='nova') || ',' ||
   (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='nova' and c.relkind='r' and c.relrowsecurity)
" 2>/dev/null)"
echo "STAGE18B_PARITY_COUNTS=$COUNTS"
if [[ "$COUNTS" == '97,96,45,87,91' ]]; then
  echo 'STAGE18B_LOCAL_SCHEMA_COUNTS=PASS'
else
  echo 'STAGE18B_LOCAL_SCHEMA_COUNTS=FAIL'
  exit 3
fi
echo 'STAGE18B_FULL_SUPABASE_SECURITY_PARITY=NOT_YET_VERIFIED'
echo 'STAGE18B_PRODUCTION_DB_CONNECTIONS=0'
echo 'STAGE18B_NO_REAL_USERS_OR_MONEY=true'
echo 'STAGE18B_OFFLINE_RESTORE_EXPERIMENT=PASS'
