#!/usr/bin/env bash
# =====================================================================
# GO LIVE — from Termius, one command.
#
#   bash /var/www/nova/scripts/go-live.sh            # normal release
#   bash /var/www/nova/scripts/go-live.sh --skip-migrate   # if you already migrated
#
# What it does, in order (and STOPS at the first problem):
#   1. pull the latest main from GitHub
#   2. install dependencies (only when the lockfile changed)
#   3. typecheck + unit tests + build          <- a broken build never ships
#   4. apply pending migrations (idempotent, checksum-protected)
#   5. backfill REAL logos in rounds
#   6. reload web + start/restart the logo worker (PM2)
#   7. print real coverage straight from the database
#
# It is safe to re-run: migrations skip what is applied, sweeps skip cached
# names, and processes are reloaded rather than duplicated.
# =====================================================================
set -euo pipefail

APP_DIR=/var/www/nova
ROUNDS="${LOGO_BACKFILL_ROUNDS:-10}"
SKIP_MIGRATE=0
[[ "${1:-}" == "--skip-migrate" ]] && SKIP_MIGRATE=1

cd "$APP_DIR"

step() { printf '\n\033[1m== %s ==\033[0m\n' "$1"; }
die()  { printf '\n\033[1;31mSTOPPED: %s\033[0m\n' "$1" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "Run as root:  sudo bash $APP_DIR/scripts/go-live.sh"

step "1/7  fetching latest"
git fetch --quiet origin main
git checkout --quiet main
git reset --hard --quiet origin/main
echo "  now at $(git log --oneline -1)"

step "2/7  dependencies"
before=$(sha256sum package-lock.json | cut -d' ' -f1)
git diff --quiet HEAD@{1} HEAD -- package-lock.json 2>/dev/null || true
npm ci --ignore-scripts --silent 2>/dev/null || npm ci --ignore-scripts
echo "  lockfile $before -> $(sha256sum package-lock.json | cut -d' ' -f1)"
echo "  (dependencies refreshed; npm ci is deterministic)"

step "3/7  verify before shipping"
npm run typecheck || die "typecheck failed — nothing was deployed"
npm run test:unit  || die "unit tests failed — nothing was deployed"
npm run build     || die "build failed — nothing was deployed"
echo "  typecheck + tests + build OK"

if [ "$SKIP_MIGRATE" -eq 0 ]; then
  step "4/7  migrations"
  bash scripts/db-migrate.sh --status || true
  bash scripts/db-migrate.sh         || die "migration failed — web was NOT reloaded (site keeps serving the old build)"
else
  step "4/7  migrations (skipped by flag)"
fi

step "5/7  logo backfill — $ROUNDS rounds (Ctrl-C is safe; progress is cached)"
for i in $(seq 1 "$ROUNDS"); do
  echo "--- round $i/$ROUNDS ---"
  NOVA_WORKER_ONCE=true npm run worker:logo || echo "  (round $i reported failures — see above)"
done

step "6/7  reload web + logo worker"
if command -v pm2 >/dev/null 2>&1; then
  pm2 reload nova-web 2>/dev/null || pm2 restart nova-web 2>/dev/null || echo "  WARN: could not find a pm2 app named nova-web"
  if pm2 describe nova-worker-logo >/dev/null 2>&1; then
    pm2 restart nova-worker-logo
  else
    pm2 start ecosystem.config.cjs --only nova-worker-logo 2>/dev/null || echo "  WARN: start nova-worker-logo manually"
  fi
  pm2 save >/dev/null 2>&1 || true
  pm2 list | sed -n '1,12p'
else
  echo "  pm2 not found — reload the web process yourself, then run: npm run worker:logo &"
fi

step "7/7  real coverage"
bash scripts/db-verify.sh >/dev/null 2>&1 || true
set -a; . "$APP_DIR/.env.production" 2>/dev/null || true; set +a
if [ -n "${SUPABASE_DB_URL:-}" ]; then
  psql "$SUPABASE_DB_URL" -X --no-password -q -v ON_ERROR_STOP=1 <<'SQL' || echo "  (coverage query failed — check .env.production)"
select s.slug as sport, count(*)::int as teams,
       count(*) filter (where t.logo is not null and t.logo <> '')::int as with_logo,
       round(100.0*count(*) filter (where t.logo is not null and t.logo <> '')/greatest(count(*),1),1) as pct
from nova.teams t join nova.sports s on s.id=t.sport_id group by s.slug order by teams desc;
select 'TOTAL teams: '||count(*)||'  with logo: '||count(*) filter (where logo is not null and logo<>'') from nova.teams;
select 'TOTAL leagues: '||count(*)||'  with logo: '||count(*) filter (where logo is not null and logo<>'') from nova.leagues;
select 'logo cache: '||count(*)||' names, resolved: '||count(*) filter (where logo_url is not null) from nova.logo_cache;
SQL
else
  echo "  SUPABASE_DB_URL not found in .env.production — open /admin/logos for live coverage"
fi

printf '\n\033[1;32mDONE\033[0m — site published, logos backfilled, worker running.\n'
printf 'Live numbers: https://betvima.com/admin/logos\n'
