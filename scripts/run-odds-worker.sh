#!/usr/bin/env bash
set -a
source /var/www/nova/.env.production
set +a
export ODDS_WORKER_MODE=bulk
exec /usr/bin/npm run worker:odds
