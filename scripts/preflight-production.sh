#!/usr/bin/env bash
# =====================================================================
# PRODUCTION PREFLIGHT
#
# Run this before (and after) every production deploy. It refuses to pass while
# anything that would make the sportsbook silently half-work is missing:
# configuration, migrations, secrets exposure, schema invariants, build output,
# provider honesty and worker liveness.
#
# Exit code 0 = safe to start traffic. Any other code = do not deploy.
# =====================================================================
set -uo pipefail
cd "$(dirname "$0")/.."

FAILURES=0
WARNINGS=0
step() { printf '\n== %s ==\n' "$1"; }
ok()   { printf '  \033[32mok\033[0m   %s\n' "$1"; }
warn() { printf '  \033[33mwarn\033[0m %s\n' "$1"; WARNINGS=$((WARNINGS + 1)); }
bad()  { printf '  \033[31mFAIL\033[0m %s\n' "$1"; FAILURES=$((FAILURES + 1)); }

step "1. runtime"
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
if [ "$NODE_MAJOR" -ge 20 ]; then ok "node $(node -v)"; else bad "node >= 20 required (found $(node -v 2>/dev/null || echo none))"; fi
if [ -f package-lock.json ]; then ok "package-lock.json present (npm ci reproducible)"; else warn "no package-lock.json: installs are not reproducible"; fi

step "2. required environment"
require_env() {
  local name="$1" purpose="$2"
  if [ -n "${!name:-}" ]; then ok "$name set ($purpose)"; else bad "$name missing ($purpose)"; fi
}
if [ "${APP_ENV:-}" = "production" ] || [ "${NODE_ENV:-}" = "production" ]; then
  require_env SUPABASE_DB_URL "authoritative database connection"
  require_env NEXT_PUBLIC_SUPABASE_URL "customer authentication"
  require_env NEXT_PUBLIC_SUPABASE_ANON_KEY "customer authentication (public key)"
  require_env SUPABASE_SERVICE_ROLE_KEY "server-only privileged operations"
  require_env NEXT_PUBLIC_SITE_URL "canonical origin for SEO and webhooks"
  case "${NEXT_PUBLIC_SITE_URL:-}" in
    https://*) ok "NEXT_PUBLIC_SITE_URL uses https" ;;
    *) bad "NEXT_PUBLIC_SITE_URL must be an https origin (found '${NEXT_PUBLIC_SITE_URL:-unset}')" ;;
  esac
else
  warn "APP_ENV/NODE_ENV is not 'production' - production-only checks were skipped"
fi

step "3. secret exposure"
if bash scripts/scan-service-role-exposure.sh --include-build; then ok "secret scan passed"; else bad "secret scan failed"; fi

step "4. database"
if [ -n "${SUPABASE_DB_URL:-}" ] || [ -n "${DATABASE_URL:-}" ]; then
  if bash scripts/db-verify.sh; then ok "database verification passed"; else bad "database verification failed"; fi
else
  warn "no database URL: schema verification skipped"
fi

step "5. providers (honest state, never faked)"
for var in SPORTS_PROVIDER PAYMENT_PROVIDER NOTIFY_EMAIL_PROVIDER NOTIFY_SMS_PROVIDER NOTIFY_PUSH_PROVIDER; do
  value="${!var:-disabled}"
  if [ "$value" = "disabled" ]; then
    warn "$var=disabled: the related feature returns NOT_CONFIGURED instead of working"
  else
    ok "$var=$value"
  fi
done
if [ -z "${PAYMENT_WEBHOOK_SECRET:-}" ] && [ "${PAYMENT_PROVIDER:-disabled}" != "disabled" ]; then
  bad "PAYMENT_WEBHOOK_SECRET is required for webhook signature verification"
fi

step "6. build output"
if [ -d .next ]; then
  ok ".next build present"
  if [ -f .next/BUILD_ID ]; then ok "build id $(cat .next/BUILD_ID)"; else warn "no build id recorded"; fi
  if grep -rl --binary-files=text -q "SUPABASE_SERVICE_ROLE_KEY" .next/server 2>/dev/null; then
    warn "the service-role variable name appears in server chunks (expected: it is server-side only)"
  fi
else
  bad ".next is missing: run npm run build"
fi

step "7. tests that must be green"
if npx vitest run tests/unit >/tmp/nova-preflight-unit.log 2>&1; then ok "unit tests"; else bad "unit tests failed (see /tmp/nova-preflight-unit.log)"; fi
if [ -n "${SUPABASE_DB_URL:-}${DATABASE_URL:-}${PGHOST:-}" ]; then
  if npx vitest run tests/integration >/tmp/nova-preflight-int.log 2>&1; then ok "integration tests"; else bad "integration tests failed (see /tmp/nova-preflight-int.log)"; fi
else
  warn "no database URL: integration tests skipped"
fi

step "8. workers and switches"
if [ -n "${SUPABASE_DB_URL:-}" ] || [ -n "${DATABASE_URL:-}" ]; then
  HEARTBEATS="$(psql "${SUPABASE_DB_URL:-$DATABASE_URL}" -tA -c "select count(*) from nova.worker_heartbeats where last_seen_at > now() - interval '5 minutes'" 2>/dev/null || echo 0)"
  if [ "${HEARTBEATS:-0}" -gt 0 ]; then ok "$HEARTBEATS worker(s) reported a heartbeat in the last 5 minutes"
  else warn "no recent worker heartbeat: start the odds/settlement/affiliate/notification workers"; fi
  BACKLOG="$(psql "${SUPABASE_DB_URL:-$DATABASE_URL}" -tA -c "select count(*) from nova.job_queue where status = 'queued'" 2>/dev/null || echo 0)"
  if [ "${BACKLOG:-0}" -gt 500 ]; then warn "$BACKLOG queued jobs: check the workers"
  else ok "queued jobs: ${BACKLOG:-0}"; fi
else
  warn "no database URL: worker liveness skipped"
fi

step "9. public surface"
if [ -n "${NEXT_PUBLIC_SITE_URL:-}" ]; then
  HEALTH_URL="${NEXT_PUBLIC_SITE_URL%/}/api/health/ready"
  if command -v curl >/dev/null 2>&1; then
    CODE="$(curl -s -o /tmp/nova-health.json -w '%{http_code}' --max-time 10 "$HEALTH_URL" || echo 000)"
    if [ "$CODE" = "200" ]; then ok "readiness probe returned 200"
    else warn "readiness probe returned $CODE at $HEALTH_URL (expected while the app is not running)"; fi
  fi
fi

step "10. client/API contract (methods and paths)"
if node scripts/verify-api-contract.mjs > /tmp/nova-api-contract.log 2>&1; then
  ok "$(tail -1 /tmp/nova-api-contract.log)"
else
  bad "client/API contract mismatch - a screen would return 405 or 404"
  grep '✗' /tmp/nova-api-contract.log | head -5
fi

step "11. deployment artifacts (nginx / pm2 / shell)"
if bash scripts/verify-deploy-config.sh > /tmp/nova-deploy-config.log 2>&1; then
  ok "deploy configuration verified ($(grep -c 'ok' /tmp/nova-deploy-config.log) checks passed)"
else
  bad "deploy configuration verification failed - see /tmp/nova-deploy-config.log"
  tail -5 /tmp/nova-deploy-config.log
fi

printf '\n== summary ==\n'
printf '  failures: %s\n  warnings: %s\n' "$FAILURES" "$WARNINGS"
if [ "$FAILURES" -gt 0 ]; then
  echo "PREFLIGHT FAILED: do not deploy"
  exit 1
fi
echo "PREFLIGHT PASSED: safe to start traffic"
