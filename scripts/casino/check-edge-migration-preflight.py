#!/usr/bin/env python3
"""Read-only preflight for moving a future BetVima casino callback to Supabase Edge.

This tool NEVER changes Nginx, PM2, systemd, databases, wallet balances, or
secrets. It prints only booleans and SHA-256 prefixes, never secret values.
It rejects unexpected live callback routing.  Exit nonzero on unsafe state.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import sys
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

SITE = Path('/etc/nginx/sites-enabled/betvima.com')
STABLE = Path('/opt/nova-releases/casino-debit-fast-20261026')
CALLBACK_PATH = '/api/webhooks/softaggregator'
ROUTE = re.compile(
    r'location\s+\^~\s+/api/webhooks/softaggregator\s*'
    r'\{[^{}]*?\bproxy_pass\s+http://127\.0\.0\.1:(\d+)\s*;',
    re.S,
)
REQUIRED_FILES = (
    'src/app/api/webhooks/softaggregator/route.ts',
    'src/server/providers/softaggregator/contract.ts',
    'src/server/providers/softaggregator/wallet.ts',
    'src/server/providers/softaggregator/fiat-wallet.ts',
    'src/server/providers/softaggregator/financial-readiness.ts',
    'src/server/providers/softaggregator/player-wallet-binding.ts',
)

def stop(code: str) -> None:
    raise SystemExit('STOP_' + code)

def env_names_from_dotenv(path: Path) -> set[str]:
    if not path.is_file():
        return set()
    # Only parse key names, never values. We do not execute or echo .env files.
    names: set[str] = set()
    for line in path.read_text(errors='replace').splitlines():
        match = re.match(r'^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=', line)
        if match:
            names.add(match.group(1))
    return names

def main() -> None:
    if not SITE.exists() or not STABLE.is_dir():
        stop('BASE_RELEASE_OR_NGINX_MISSING')
    if not SITE.is_file():
        stop('NGINX_CONFIG_NOT_FILE')

    config = SITE.resolve().read_text()
    ports = ROUTE.findall(config)
    if len(ports) != 1:
        stop('CALLBACK_ROUTE_NOT_UNIQUE')
    print('ACTIVE_CALLBACK_PORT=' + ports[0])
    if ports[0] != '3098':
        stop('UNEXPECTED_LIVE_CALLBACK_UPSTREAM')

    for name in REQUIRED_FILES:
        path = STABLE / name
        if not path.is_file():
            stop('REQUIRED_SOURCE_FILE_MISSING_' + Path(name).name)
        digest = hashlib.sha256(path.read_bytes()).hexdigest()[:12]
        print('SOURCE_SHA256_12_' + Path(name).name.upper().replace('.', '_') + '=' + digest)

    route_text = (STABLE / REQUIRED_FILES[0]).read_text()
    must_have = (
        'verifySupplierCallbackSignature',
        'validateCallback',
        'SOFTAGGREGATOR_EDGE_HMAC_SECRET',
        'settleCasinoCallback',
    )
    if not all(key in route_text for key in must_have):
        stop('PROVIDER_AND_EDGE_SIGNATURE_GATES_NOT_VERIFIED')
    print('CALLBACK_SIGNATURE_GATES_IN_SOURCE=present')

    # Only inspect names in the production dotenv for migration planning;
    # runtime secrets may instead be provided by PM2 or systemd.
    env_names = set().union(*(
        env_names_from_dotenv(STABLE / name)
        for name in ('.env.production.local', '.env.production')
    ))
    for key in (
        'SUPABASE_DB_URL',
        'SOFTAGGREGATOR_SALT_KEY',
        'SOFTAGGREGATOR_EDGE_HMAC_SECRET',
        'SOFTAGGREGATOR_ALLOWED_COUNTRIES',
        'SOFTAGGREGATOR_TEST_USER_ID',
    ):
        print('DOTENV_HAS_' + key + '=' + str(key in env_names).lower())
    print('DOTENV_PRESENCE_ONLY_NOT_RUNTIME_VALUES=true')

    request = Request('http://127.0.0.1:3098' + CALLBACK_PATH,
                      method='GET', headers={'Cache-Control': 'no-store'})
    try:
        with urlopen(request, timeout=6) as response:
            status = response.status
            raw = response.read(512)
    except (HTTPError, URLError, TimeoutError, OSError):
        stop('ORIGINAL_UNSIGNED_CALLBACK_UNREACHABLE')
    try:
        response_json = json.loads(raw)
    except (ValueError, UnicodeDecodeError):
        stop('ORIGINAL_CALLBACK_INVALID_JSON')
    if status != 200 or response_json != {'error': 2, 'balance': 0}:
        stop('UNSIGNED_CALLBACK_NOT_REJECTED')
    print('ORIGINAL_UNSIGNED_CALLBACK_FAIL_CLOSED=true')

    print('REAL_MONEY_TRANSACTIONS_SENT=0')
    print('NGINX_DB_WALLET_PM2_MODIFIED=false')
    print('CASINO_EDGE_MIGRATION_PREFLIGHT_PASSED')

if __name__ == '__main__':
    if os.geteuid() != 0:
        stop('RUN_AS_ROOT_TO_READ_NGINX')
    main()
