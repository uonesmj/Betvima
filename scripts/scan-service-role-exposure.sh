#!/usr/bin/env bash
# =====================================================================
# SECRET EXPOSURE SCAN
#
# The Supabase service-role key bypasses RLS. It must never reach the browser.
# This scan fails the build with a non-zero exit code if:
#   1. NEXT_PUBLIC_ is used for a private credential (service role, SMTP, provider keys)
#   2. a client component ("use client") references a server-only secret
#   3. a route handler returns the service role key in a response
#   4. the key value itself (or the literal SUPABASE_SERVICE_ROLE_KEY name) appears in
#      static assets or in the client chunks of a production build
#   5. .env files that hold secrets are not ignored by git
#
# Usage: bash scripts/scan-service-role-exposure.sh [--include-build]
# =====================================================================
set -uo pipefail
cd "$(dirname "$0")/.."

FAILURES=0
note() { printf '  %s\n' "$1"; }
fail() { printf '  \033[31mFAIL\033[0m %s\n' "$1"; FAILURES=$((FAILURES + 1)); }
pass() { printf '  \033[32mok\033[0m   %s\n' "$1"; }

echo "== 1. no private credentials behind NEXT_PUBLIC_ =="
if grep -rn --include='*.ts' --include='*.tsx' --include='*.js' --include='*.mjs' --include='*.json' --include='.env*' \
     -E 'NEXT_PUBLIC_[A-Z0-9_]*(SERVICE_ROLE|SECRET|API_KEY|PASSWORD|PRIVATE|SMTP|WEBHOOK_SECRET)' . \
     --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.git >/tmp/nova-scan-public.txt 2>/dev/null; then
  cat /tmp/nova-scan-public.txt
  fail "a private credential is exposed through NEXT_PUBLIC_"
else
  pass "no private credential uses a NEXT_PUBLIC_ name"
fi

echo "== 2. client components never touch server-only secrets =="
CLIENT_HITS=$(grep -rln --include='*.tsx' --include='*.ts' "'use client'" src 2>/dev/null \
  | xargs grep -ln -E 'SUPABASE_SERVICE_ROLE_KEY|SUPABASE_DB_URL|PAYMENT_PROVIDER_API_KEY|SPORTS_PROVIDER_API_KEY|SMS_API_KEY' 2>/dev/null || true)
if [ -n "$CLIENT_HITS" ]; then
  echo "$CLIENT_HITS" | sed 's/^/    /'
  fail "a client component references a server-only secret"
else
  pass "no client component references a server-only secret"
fi

echo "== 3. no route handler returns the service-role key =="
if grep -rn --include='*.ts' -E 'return (jsonOk|jsonCreated|NextResponse\.json)\(.*(SERVICE_ROLE|serviceRoleKey)' src/app/api >/tmp/nova-scan-return.txt 2>/dev/null; then
  cat /tmp/nova-scan-return.txt
  fail "a route handler returns the service-role key"
else
  pass "no route handler returns the service-role key"
fi

echo "== 4. server-only modules are not imported by client code =="
if grep -rn --include='*.tsx' --include='*.ts' "'use client'" -l src 2>/dev/null \
  | xargs grep -ln "@/server/env" 2>/dev/null | grep -v '^$' >/tmp/nova-scan-serverimport.txt; then
  if [ -s /tmp/nova-scan-serverimport.txt ]; then
    sed 's/^/    /' /tmp/nova-scan-serverimport.txt
    fail "a client component imports the server-only env module"
  else
    pass "no client component imports @/server/env"
  fi
else
  pass "no client component imports @/server/env"
fi

echo "== 5. .env files are git-ignored =="
if [ -f .gitignore ] && grep -qE '^\.env' .gitignore; then
  pass ".env* is ignored by git"
else
  fail ".env files are not ignored by git"
fi

if [ "${1:-}" = "--include-build" ] || [ -d .next ]; then
  echo "== 6. build artefacts contain no service-role key =="
  if [ ! -d .next ]; then
    note "skipped: no .next build present (run npm run build first for the full scan)"
  else
    if [ -n "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
      if grep -rl --binary-files=text -F "$SUPABASE_SERVICE_ROLE_KEY" .next >/tmp/nova-scan-key.txt 2>/dev/null; then
        cat /tmp/nova-scan-key.txt
        fail "the service-role key value appears inside .next"
      else
        pass "the service-role key value does not appear inside .next"
      fi
    else
      note "skipped value scan: SUPABASE_SERVICE_ROLE_KEY is not set in this shell"
    fi
    if grep -rl --binary-files=text -E 'service_role"|SUPABASE_SERVICE_ROLE_KEY' .next/static >/tmp/nova-scan-static.txt 2>/dev/null; then
      cat /tmp/nova-scan-static.txt
      fail "service-role naming appears in client static assets"
    else
      pass "no service-role naming in client static assets"
    fi
  fi
fi

echo
if [ "$FAILURES" -gt 0 ]; then
  echo "SECRET SCAN FAILED ($FAILURES problem(s))"
  exit 1
fi
echo "SECRET SCAN PASSED"
