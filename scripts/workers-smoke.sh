#!/usr/bin/env bash
# =====================================================================
# WORKER SMOKE TEST
#
# Starts each worker in one-shot mode (`NOVA_WORKER_ONCE=true`) against the configured
# database and fails if any of them errors. Use it after a deploy, in CI, or from cron
# as a cheap liveness proof that is stronger than "the process started".
# =====================================================================
set -uo pipefail
cd "$(dirname "$0")/.."

DB_URL="${SUPABASE_DB_URL:-${DATABASE_URL:-}}"
if [ -z "$DB_URL" ]; then
  echo "SUPABASE_DB_URL (or DATABASE_URL) is required" >&2
  exit 1
fi
export SUPABASE_DB_URL="$DB_URL"
export NOVA_WORKER_ONCE=true

status=0
for worker in odds settlement affiliate notification; do
  printf '== %s worker (one-shot) ==\n' "$worker"
  if npx tsx --tsconfig tsconfig.json "src/workers/entrypoints/${worker}.worker.ts" >"/tmp/nova-worker-${worker}.log" 2>&1; then
    grep -o '"msg":"one-shot run finished"[^}]*}' "/tmp/nova-worker-${worker}.log" | tail -1 | sed 's/^/  /'
    printf '  \033[32mok\033[0m\n'
  else
    printf '  \033[31mFAIL\033[0m %s worker exited non-zero (log: /tmp/nova-worker-%s.log)\n' "$worker" "$worker"
    tail -5 "/tmp/nova-worker-${worker}.log" | sed 's/^/    /'
    status=1
  fi
done

exit "$status"
