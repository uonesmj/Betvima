#!/usr/bin/env bash
set -euo pipefail
cd /var/www/nova
set -a
source /var/www/nova/.env.production
set +a
export NODE_ENV=production
exec /usr/bin/node --import tsx src/workers/entrypoints/settlement.worker.ts
