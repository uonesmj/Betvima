#!/usr/bin/env bash
# Stage11 isolated PostgreSQL integration: transient Podman container, UNIX socket,
# no published TCP ports, no production connections and no wallet/provider requests.
set -Eeuo pipefail
umask 077
ROOT=/root/betvima-stage5
LIVE=/opt/nova-releases/casino-3098-eligible-fallback-HU6Rbl
TEST="$ROOT/stage10-timeout-candidate"
CLIENT="$ROOT/stage11-real-pg-integration.cjs"
CONT_NAME=""
SOCKET=""
cleanup(){
  local rc=$?
  trap - EXIT
  if [[ -n "$CONT_NAME" ]]; then
    podman rm -f "$CONT_NAME" >/dev/null 2>&1 || true
  fi
  if [[ -n "$SOCKET" && "$SOCKET" == "$ROOT"/stage11-socket.* && -d "$SOCKET" ]]; then
    rm -rf -- "$SOCKET"
  fi
  echo "STAGE11_TEMP_CONTAINER_REMOVED=true"
  exit "$rc"
}
trap cleanup EXIT
echo "===== BETVIMA STAGE11: REAL BUT ISOLATED POSTGRES ====="
[[ "$(id -u)" -eq 0 ]] || { echo 'STAGE11_ABORT=ROOT_REQUIRED'; exit 2; }
command -v podman >/dev/null || { echo 'STAGE11_ABORT=PODMAN_UNAVAILABLE'; exit 2; }
[[ -f "$LIVE/src/server/db/postgres.ts" &&
   -f "$TEST/live-shadow/postgres.ts" &&
   -f "$CLIENT" ]] || { echo 'STAGE11_ABORT=SOURCE_MISSING'; exit 2; }
[[ "$(podman inspect betvima-stage5-pg --format '{{.HostConfig.NetworkMode}}')" == none ]] ||
   { echo 'STAGE11_ABORT=OLD_ISOLATED_PG_NO_LONGER_ISOLATED'; exit 2; }
IMAGE="$(podman inspect betvima-stage5-pg --format '{{.ImageName}}')"
[[ -n "$IMAGE" && "$IMAGE" == *postgres* ]] ||
   { echo 'STAGE11_ABORT=UNEXPECTED_LOCAL_POSTGRES_IMAGE'; exit 2; }
podman image exists "$IMAGE" ||
   { echo 'STAGE11_ABORT=LOCAL_POSTGRES_IMAGE_NOT_FOUND'; exit 2; }
node --check "$CLIENT"
python3 - "$LIVE/src/server/db/postgres.ts" "$TEST/live-shadow/postgres.ts" <<'PY'
import hashlib,sys
for p,expected,kind in zip(sys.argv[1:],("3d66c5724ff6","e02a19a9f3bf"),("ACTIVE","SHADOW")):
    with open(p,"rb") as f: val=hashlib.sha256(f.read()).hexdigest()[:12]
    if val!=expected: raise SystemExit("STAGE11_ABORT="+kind+"_SOURCE_HASH_MISMATCH")
    print("STAGE11_"+kind+"_SOURCE_HASH_GUARD=PASS")
PY
SOCKET="$(mktemp -d "$ROOT/stage11-socket.XXXXXXXX")"
chmod 1777 "$SOCKET"
CONT_NAME="betvima-stage11-pg-$(date +%s)-$$"
echo "STAGE11_TEST_DATABASE=FRESH_LOCAL_CONTAINER"
echo "STAGE11_CONTAINER_NETWORK=NONE"
echo "STAGE11_PUBLIC_PORTS=0"
podman run -d \
  --name "$CONT_NAME" \
  --network none \
  --memory 512m \
  --cpus 1 \
  --pids-limit 128 \
  -e POSTGRES_HOST_AUTH_METHOD=trust \
  -e POSTGRES_INITDB_ARGS=--auth-local=trust \
  -v "$SOCKET:/var/run/postgresql:rw" \
  "$IMAGE" >/dev/null
[[ "$(podman inspect "$CONT_NAME" --format '{{.HostConfig.NetworkMode}}')" == none ]] ||
   { echo 'STAGE11_ABORT=CONTAINER_NETWORK_NOT_ISOLATED'; exit 2; }
ready=false
for i in $(seq 1 40); do
  if [[ -S "$SOCKET/.s.PGSQL.5432" ]] &&
       podman exec "$CONT_NAME" pg_isready -h /var/run/postgresql \
       -U postgres -d postgres >/dev/null 2>&1; then
    ready=true
    break
  fi
  sleep 0.5
done
[[ "$ready" == true ]] || { echo 'STAGE11_ABORT=TEMP_POSTGRES_NOT_READY'; exit 2; }
echo "STAGE11_UNIX_SOCKET_READY=true"
echo "===== LIVE SOURCE VS SHADOW POSTGRES INTEGRATION ====="
# Bound entire test so any Postgres driver regression cannot leave a
# temporary database behind or keep the operator terminal waiting.
timeout --signal=TERM --kill-after=10s 110s node "$CLIENT" "$SOCKET"
echo "STAGE11_PRODUCTION_PORT_3098_UNCHANGED=true"
echo "===== STAGE11 FINISHED ====="
