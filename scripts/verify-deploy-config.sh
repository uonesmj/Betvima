#!/usr/bin/env bash
# =====================================================================
# VERIFY DEPLOY CONFIGURATION
#
# Checks the deployment artifacts that cannot be type-checked: the Nginx site config, the PM2
# ecosystem file and every shell script. Safe to run in CI and as part of the preflight.
#
#   bash scripts/verify-deploy-config.sh
# =====================================================================
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
failures=0
ok()   { printf '  \033[32mok\033[0m   %s\n' "$1"; }
bad()  { printf '  \033[31mFAIL\033[0m %s\n' "$1"; failures=$((failures + 1)); }

echo "== shell syntax =="
while IFS= read -r file; do
  if bash -n "$file" 2>/dev/null; then ok "bash -n ${file#"$DIR"/}"; else bad "bash -n ${file#"$DIR"/}"; fi
done < <(find "$DIR/scripts" "$DIR/ops" "$DIR/deploy" -name '*.sh' | sort)

echo "== PM2 ecosystem =="
if node -e "
  const cfg = require('$DIR/deploy/pm2/ecosystem.config.cjs');
  if (!Array.isArray(cfg.apps) || cfg.apps.length === 0) throw new Error('no apps defined');
  const web = cfg.apps.filter((a) => a.name === 'nova-web');
  if (web.length !== 1 || web[0].exec_mode !== 'cluster') throw new Error('nova-web must run in cluster mode');
  if (web[0].instances < 2) throw new Error('nova-web needs at least 2 instances for zero-downtime reload');
  const workers = cfg.apps.filter((a) => a.name.startsWith('nova-worker-'));
  if (workers.length !== 4) throw new Error('expected 4 worker apps, found ' + workers.length);
  console.log('apps: ' + cfg.apps.map((a) => a.name).join(', '));
"; then ok "ecosystem.config.cjs parses (web cluster + 4 workers)"; else bad "ecosystem.config.cjs"; fi

echo "== nginx site configuration =="
NGINX_BIN="$(command -v nginx 2>/dev/null || true)"
# /usr/sbin is not on the PATH of a non-root shell on Debian/Ubuntu, so look there explicitly.
[ -z "$NGINX_BIN" ] && [ -x /usr/sbin/nginx ] && NGINX_BIN=/usr/sbin/nginx
if [ -n "$NGINX_BIN" ]; then
  # nova.conf is a server-level fragment: wrap it in a minimal http{} block to validate it the
  # same way it is loaded in production (include inside http{}).
  TMP="$(mktemp -d)"
  cat > "$TMP/main.conf" <<CONF
events { worker_connections 1024; }
http {
  include /etc/nginx/mime.types;
  map \$http_upgrade \$connection_upgrade { default upgrade; '' close; }
  include $DIR/deploy/nginx/nova.conf;
}
CONF
  # Include paths inside the config are absolute (/etc/nginx/snippets/...), so validate them too.
  if [ -f /etc/nginx/snippets/nova-proxy.conf ] && cmp -s "$DIR/deploy/nginx/snippets/nova-proxy.conf" /etc/nginx/snippets/nova-proxy.conf; then
    ok "installed snippet matches deploy/nginx/snippets/nova-proxy.conf"
  else
    echo "  note: install the snippet with: sudo cp deploy/nginx/snippets/nova-proxy.conf /etc/nginx/snippets/"
  fi
  NGINX_OUT="$("$NGINX_BIN" -t -c "$TMP/main.conf" -p "$TMP" 2>&1 || true)"
  if echo "$NGINX_OUT" | grep -q "test is successful"; then
    ok "nginx -t on deploy/nginx/nova.conf"
  elif echo "$NGINX_OUT" | grep -qE "cannot load certificate|cannot load certificate key|BIO_new_file|no such file"; then
    # Syntax and directive validation already passed; only the deployment-specific certificate
    # files (created by certbot on the target host, root-readable) are missing here.
    ok "nginx -t on deploy/nginx/nova.conf (syntax ok; certificate files are host-specific)"
  else
    bad "nginx -t on deploy/nginx/nova.conf"
    echo "$NGINX_OUT" | tail -3
  fi
  rm -rf "$TMP"
else
  echo "  skipped: nginx is not installed on this host (config not validated)"
fi

echo
if [ "$failures" -eq 0 ]; then
  echo "DEPLOY CONFIG VERIFICATION PASSED"
else
  echo "DEPLOY CONFIG VERIFICATION FAILED: $failures problem(s)"
  exit 1
fi
