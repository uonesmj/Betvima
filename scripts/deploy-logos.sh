#!/usr/bin/env bash
# =====================================================================
# LOGO GO-LIVE — one command, four steps.
#
#   1. apply pending migrations (creates nova.logo_cache)
#   2. backfill REAL team/league badges in rounds (NOVA_WORKER_ONCE)
#   3. start/restart the permanent logo worker under PM2
#   4. print final coverage numbers
#
# Run on the server, from the repository root:
#   bash scripts/deploy-logos.sh
#
# Tunables:
#   LOGO_BACKFILL_ROUNDS=20   how many one-shot sweeps to run (default 10)
#   SUPABASE_DB_URL=...       required (normally read from .env.production)
#
# Safe to re-run: migrations are idempotent, sweeps skip names already
# cached, and the worker is restarted rather than duplicated.
# =====================================================================
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

rounds="${LOGO_BACKFILL_ROUNDS:-10}"

# Secrets live in the deployment env file on the server (never in git).
if [[ -z "${SUPABASE_DB_URL:-}" && -f /var/www/nova/.env.production ]]; then
  set -a
  # shellcheck disable=SC1091
  source /var/www/nova/.env.production
  set +a
fi

echo "== 1/4  migrations =="
bash scripts/db-migrate.sh

echo
echo "== 2/4  logo backfill — $rounds rounds (Ctrl-C anytime; progress is cached) =="
for i in $(seq 1 "$rounds"); do
  echo "--- round $i/$rounds ---"
  # Exit code 1 means a job failed; the sweep continues on the next round.
  NOVA_WORKER_ONCE=true npm run worker:logo || echo "  (round $i reported failures — see log above)"
done

echo
echo "== 3/4  permanent worker =="
if command -v pm2 >/dev/null 2>&1; then
  if pm2 describe nova-worker-logo >/dev/null 2>&1; then
    pm2 restart nova-worker-logo
  else
    pm2 start ecosystem.config.cjs --only nova-worker-logo
  fi
  pm2 save >/dev/null 2>&1 || true
  echo "  nova-worker-logo is running under PM2"
else
  echo "  pm2 not found — start the worker with: npm run worker:logo &"
fi

echo
echo "== 4/4  coverage =="
: "${SUPABASE_DB_URL:?SUPABASE_DB_URL is required for the coverage report}"
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 <<'SQL'
select
  s.slug as sport,
  count(*)::int as teams,
  count(*) filter (where t.logo is not null and t.logo <> '')::int as with_logo,
  round(100.0 * count(*) filter (where t.logo is not null and t.logo <> '') / greatest(count(*), 1), 1) as pct
from nova.teams t
join nova.sports s on s.id = t.sport_id
group by s.slug
order by teams desc;

select
  'teams' as entity,
  count(*)::int as total,
  count(*) filter (where logo is not null and logo <> '')::int as with_logo
from nova.teams
union all
select
  'leagues',
  count(*)::int,
  count(*) filter (where logo is not null and logo <> '')::int
from nova.leagues;

select entity_type,
       count(*)::int as names_cached,
       count(*) filter (where logo_url is not null)::int as resolved,
       count(*) filter (where logo_url is null)::int as confirmed_misses
from nova.logo_cache
group by entity_type;
SQL

echo
echo "Done. Live coverage is also on the admin page: /admin/logos"
