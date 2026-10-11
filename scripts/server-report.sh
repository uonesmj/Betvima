#!/usr/bin/env bash
# =====================================================================
# SERVER REPORT — read-only. Nothing is written, restarted or migrated.
#
# Run as root on the Betvima host:
#   bash scripts/server-report.sh            (or: sudo bash /path/to/this/file)
#
# Prints, in one screen:
#   1) which deploy layout this machine actually uses
#   2) the live web process (PM2) and nginx upstream
#   3) the reason the last continuous deployment stopped
#   4) migration state and REAL logo coverage straight from the database
#
# Supabase credentials are never printed — only aggregate numbers.
# =====================================================================
set -uo pipefail

say() { printf '\n\033[1m== %s ==\033[0m\n' "$1"; }
have() { command -v "$1" >/dev/null 2>&1; }

say "host"
printf 'user=%s host=%s kernel=%s\n' "$(whoami)" "$(hostname)" "$(uname -sr)"
date -u '+utc %F %T'

say "deploy layout"
for d in /var/www/nova /opt/nova-releases /opt/betvima-preview /opt/nova-git-seed /var/lib/betvima-continuous /etc/betvima; do
  if [ -e "$d" ]; then printf '  present  %s\n' "$d"; else printf '  missing  %s\n' "$d"; fi
done
if [ -d /opt/nova-releases ]; then
  printf '  newest releases:\n'
  ls -t /opt/nova-releases 2>/dev/null | head -n 4 | sed 's/^/    /'
fi

say "live web process"
if have pm2; then
  printf -- '-- root pm2 --\n'
  pm2 list 2>/dev/null | sed -n '1,14p'
fi
if id novaadmin >/dev/null 2>&1 && have sudo; then
  printf -- '-- novaadmin pm2 --\n'
  sudo -u novaadmin env PM2_HOME=/home/novaadmin/.pm2 \
    /usr/lib/node_modules/pm2/bin/pm2 list 2>/dev/null | sed -n '1,14p'
fi
printf -- '-- nginx upstream --\n'
grep -rhn 'proxy_pass' /etc/nginx/sites-enabled/ /etc/nginx/snippets/ 2>/dev/null | head -n 5 | sed 's/^/  /'

say "last deployment attempt"
for f in /var/lib/betvima-continuous/private-command-failure.log; do
  if [ -f "$f" ]; then
    printf '  %s (last 1500 bytes)\n' "$f"
    tail -c 1500 "$f" | sed 's/^/    /'
  else
    printf '  no failure log at %s\n' "$f"
  fi
done
for f in preview-progress.json preview-status.json pending.json; do
  p="/var/lib/betvima-continuous/$f"
  [ -f "$p" ] && printf '  %s: %s\n' "$f" "$(head -c 300 "$p")"
done

say "database: migrations + logo coverage"
envfile=""
for f in /var/www/nova/.env.production /var/www/nova/.env.local /etc/betvima/env /etc/betvima/betvima.env; do
  if [ -f "$f" ] && grep -q 'SUPABASE_DB_URL' "$f" 2>/dev/null; then envfile="$f"; break; fi
done
if [ -z "$envfile" ]; then
  printf '  no env file with SUPABASE_DB_URL found — skipping database checks\n'
  printf '  (looked in: /var/www/nova/.env.production, /var/www/nova/.env.local, /etc/betvima/)\n'
else
  printf '  using %s\n' "$envfile"
  # shellcheck disable=SC1090
  set -a; . "$envfile" >/dev/null 2>&1; set +a
  psql "$SUPABASE_DB_URL" -X --no-password -qAt -v ON_ERROR_STOP=1 <<'SQL' 2>&1 | sed 's/^/  /'
select 'last migrations: ' || string_agg(filename, ', ' order by filename)
from (select filename from nova.migrations order by filename desc limit 3) t;
select 'migration 0195 applied: ' || exists(select 1 from nova.migrations where filename like '0195%');
select 'logo_cache table: ' || (to_regclass('nova.logo_cache') is not null);
select 'teams: ' || count(*) || '  with logo: ' || count(*) filter (where logo is not null and logo <> '')
from nova.teams;
select 'leagues: ' || count(*) || '  with logo: ' || count(*) filter (where logo is not null and logo <> '')
from nova.leagues;
SQL
fi

printf '\n\033[1mreport complete\033[0m — nothing was changed\n'
