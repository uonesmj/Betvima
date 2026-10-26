#!/usr/bin/env python3
"""Prepare RTT4 in a fresh local release, without touching a live service.

Must run as root on the existing VPS.  Uses exact fail-closed source anchors.
Only SoftAggregator wallet.ts and the corresponding unit-test mock are edited.
Keeps .env, countries, FX, financial ledger, Nginx and PM2 untouched.

After success, caller may run typecheck/tests/build in this isolated release.
"""
from pathlib import Path
import hashlib
import os
import re
import shutil
import subprocess
import sys

BASE = Path('/opt/nova-releases/casino-callback-rtt3-20261026')
NEW = Path('/opt/nova-releases/casino-callback-rtt4-20261026')
MAIN = 'src/server/providers/softaggregator/wallet.ts'
TEST = 'tests/unit/softaggregator-wallet.test.ts'

def stop(message):
    raise SystemExit('STOP: ' + message)

def replace_exact(source, old, new, label):
    count = source.count(old)
    if count != 1:
        stop('SOURCE_MISMATCH_' + label + '_COUNT_' + str(count))
    return source.replace(old, new, 1)

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def check_current():
    if os.geteuid() != 0:
        stop('ROOT_REQUIRED')
    if NEW.exists():
        stop('CANDIDATE_ALREADY_EXISTS')
    if not BASE.joinpath('.next/BUILD_ID').is_file():
        stop('RTT3_BASE_RELEASE_NOT_BUILT')
    if not BASE.joinpath(MAIN).is_file():
        stop('WALLET_SOURCE_MISSING')
    if not BASE.joinpath(TEST).is_file():
        stop('UNIT_TEST_SOURCE_MISSING')
    nginx = Path('/etc/nginx/sites-enabled/betvima.com').resolve().read_text()
    matches = re.findall(
        r'location\s+\^~\s+/api/webhooks/softaggregator\s*\{([^{}]*)\}', nginx, re.S)
    if len(matches) != 1 or re.search(
        r'proxy_pass\s+http://127\.0\.0\.1:3098\s*;', matches[0]
    ) is None:
        stop('LIVE_NGINX_CALLBACK_NOT_3098')
    if subprocess.run(
        ['curl', '-fsS', '--max-time', '5',
         'http://127.0.0.1:3098/'],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    ).returncode != 0:
        stop('ACTIVE_CALLBACK_SERVICE_NOT_HEALTHY')

def transform():
    wallet = BASE.joinpath(MAIN).read_text()
    wallet = replace_exact(wallet,
        "  // Read-only preflight for a normal debit: run independent validations in\n"
        "  // parallel so network RTTs do not accumulate before the financial transaction.\n"
        "  // The checks, lock order and transaction itself remain unchanged; credits,\n"
        "  // balances and rollback debits retain their existing sequential path.",
        "  // Read-only preflight for normal Debit AND Credit is parallel.\n"
        "  // Financial rules, wallet binding and receipt lock order are unchanged.\n"
        "  // Every rollback keeps its original sequential checks.",
        'READ_ONLY_COMMENT')
    wallet = replace_exact(wallet,
        "  const normalDebit = event.action === 'debit' && !event.rollback &&\n"
        "    Boolean(event.roundId && event.gameId);",
        "  const normalFinancialCallback =\n"
        "    (event.action === 'debit' || event.action === 'credit') &&\n"
        "    !event.rollback && Boolean(event.roundId && event.gameId);",
        'NORMAL_DEBIT_VARIABLE')
    wallet = replace_exact(wallet,
        "  if (normalDebit) {",
        "  if (normalFinancialCallback) {",
        'PRECHECK_BRANCH')
    wallet = replace_exact(wallet,
        "    const p = await getProfile(tx, userId);\n"
        "    if (!p) return { error: 2, balance: 0 };\n"
        "    await tx.query(\n"
        "      \"insert into nova.wallets(user_id,currency,balance_minor) values ($1,'USD',0) on conflict (user_id,currency) do nothing\",",
        "    // Existing earned Credit requires account existence but not fresh\n"
        "    // eligibility/KYC/country/limits approval. Debit and all Rollbacks\n"
        "    // retain their original getProfile query and business policies.\n"
        "    const ordinaryCredit = event.action === 'credit' && !event.rollback;\n"
        "    let p: ProfileRow | null = null;\n"
        "    if (ordinaryCredit) {\n"
        "      const exists = await tx.queryOne<{ found: number }>(\n"
        "        'select 1 as found from nova.profiles where id = $1', [userId],\n"
        "      );\n"
        "      if (!exists) return { error: 2, balance: 0 };\n"
        "    } else {\n"
        "      p = await getProfile(tx, userId);\n"
        "      if (!p) return { error: 2, balance: 0 };\n"
        "    }\n"
        "    await tx.query(\n"
        "      \"insert into nova.wallets(user_id,currency,balance_minor) values ($1,'USD',0) on conflict (user_id,currency) do nothing\",",
        'ORDINARY_CREDIT_PROFILE')
    wallet = replace_exact(wallet,
        "(!event.rollback && (!accountCanBet(p) || p.currency !== currency || event.amountMinor! < SOFTAGGREGATOR_MIN_BET_MINOR ||",
        "(!event.rollback && (!p || !accountCanBet(p) || p.currency !== currency || event.amountMinor! < SOFTAGGREGATOR_MIN_BET_MINOR ||",
        'DEBIT_REQUIRES_PROFILE')
    test = BASE.joinpath(TEST).read_text()
    test = replace_exact(test,
        "      if (sql.includes('from nova.profiles p')) {",
        "      if (sql.includes('select 1 as found from nova.profiles where id = $1')) {\n"
        "        return { found: 1 };\n"
        "      }\n"
        "      if (sql.includes('from nova.profiles p')) {",
        'TEST_MOCK_CREDIT_PROFILE')
    return {MAIN: wallet, TEST: test}

def main():
    check_current()
    modified = transform()
    # Reflink copy is local only; no external requests, installs, secret changes.
    subprocess.run(['cp', '-a', '--reflink=auto', str(BASE), str(NEW)], check=True)
    for rel, content in modified.items():
        path = NEW / rel
        if not path.is_file():
            stop('CANDIDATE_FILE_NOT_FOUND_' + rel)
        path.write_text(content)
        if path.read_text() != content:
            stop('CANDIDATE_WRITE_VERIFY_FAILED_' + rel)
    for env in ('.env.production', '.env.production.local'):
        a, b = BASE / env, NEW / env
        if a.is_file() != b.is_file() or (a.is_file() and sha(a) != sha(b)):
            stop('ENV_DIFF_DETECTED_' + env)
    print('RTT4_CANDIDATE_PREPARED', flush=True)
    print('RELEASE=' + str(NEW), flush=True)
    print('SOURCE_EDITED=' + MAIN, flush=True)
    print('UNIT_TEST_MOCK_EDITED=' + TEST, flush=True)
    print('NGINX_PM2_DB_COUNTRY_CURRENCY_WALLET_LEDGER_UNTOUCHED', flush=True)

if __name__ == '__main__':
    main()
