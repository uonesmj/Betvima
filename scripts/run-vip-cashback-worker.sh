#!/usr/bin/env bash
set -euo pipefail
cd /opt/nova
exec /usr/bin/node --import tsx src/workers/entrypoints/vip-cashback.worker.ts
