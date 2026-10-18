#!/usr/bin/env bash
# One-command read-only verification. Never enables a provider for wagering.
set -Eeuo pipefail
cd "$(dirname "$0")/.."
export NODE_OPTIONS="--max-old-space-size=768"
export CI=1
failures=0
report="$(mktemp)"
trap 'rm -f "$report"' EXIT
step() {
  local title="$1"; shift
  printf '\n=== %s ===\n' "$title"
  if "$@"; then printf '%s\tPASS\n' "$title" >> "$report"
  else printf '%s\tFAIL\n' "$title" >> "$report"; failures=$((failures+1)); fi
}
check_contract() {
  node - <<'JS'
const fs = require('node:fs');
const b = fs.readFileSync('src/providers/betsapi-bet365-catalogue.ts','utf8');
const p = fs.readFileSync('src/providers/betsapi-bet365-projection.ts','utf8');
const l = fs.readFileSync('src/app/api/v1/betsapi/preview-quote/route.ts','utf8');
const tests = [
 ['catalogue read-only',b.includes('readOnly: true')],
 ['wager publishing disabled',b.includes('canPublishBet365CatalogueToWagering(): false')],
 ['projection non-executable',p.includes('executable: false')],
 ['preview quote authenticated',l.includes('withUser(request, ctx)')],
 ['no place action in preview quote',!l.includes('bettingService.place(')],
 ['no wallet mutation in preview quote',!l.includes('walletService.')],
];
for (const [name,ok] of tests) console.log((ok?'PASS':'FAIL')+' '+name);
if(tests.some(x=>!x[1])) process.exitCode=1;
JS
}
step "TypeScript" npm run typecheck
step "BetsAPI unit tests" ./node_modules/.bin/vitest run tests/unit/betsapi-fi-link-evidence.test.ts tests/unit/betsapi-bet365-projection.test.ts tests/unit/betsapi-price-change-preview.test.ts tests/unit/betsapi-strict-diagnostic.test.ts --maxWorkers=1 --minWorkers=1
step "No-money-flow contract" check_contract
step "Next.js build" npm run build
if [[ -n "$BETSAPI_PREVIEW_BASE" ]]; then
  base="$(printf '%s' "$BETSAPI_PREVIEW_BASE" | sed 's:/*$::')"
  if [[ "$base" == http://127.0.0.1:* || "$base" == http://localhost:* ]]; then
    step "Local explorer HTTP" curl -fsS --max-time 40 -o /dev/null "$base/betsapi"
    step "Local live HTTP" curl -fsS --max-time 40 -o /dev/null "$base/live"
  else echo "Skipping non-loopback URL"; fi
fi
printf '\n=== SUMMARY ===\n'
cat "$report"
printf 'TOTAL FAILURES: %s\n' "$failures"
printf 'PRODUCTION CUTOVER: BLOCKED pending verified fixture identity and settlement\n'
test "$failures" -eq 0
