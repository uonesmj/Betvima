#!/usr/bin/env python3
"""Read-only diagnostics for casino Debit SQL latency on the exact active 3098 VPS.

Never sends a callback, records a bet, changes wallet balances, modifies any
release, services or routes, or prints personal/secret database values.
Hard-fails unless production 3098 still matches its pinned source and cwd.
Connects with the same pg settings, starts READ ONLY transaction, and times
only bounded SELECT queries with the one approved pilot account when present.
"""
from __future__ import annotations

import hashlib
import os
from pathlib import Path
import re
import subprocess
import sys

LIVE = Path('/opt/nova-releases/casino-3098-eligible-fallback-HU6Rbl')
DEPS = Path('/opt/nova-releases/casino-rtt5-3098-candidate-20261030/node_modules/pg')
REL = Path('src/server/providers/softaggregator/wallet.ts')
SHA = '9df555a7e3f04354019435e8e9318675587eb9b401422c0e70e7cc16727ff5af'
PILOT = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')

def refuse(msg: str) -> None:
    raise SystemExit('REFUSED: ' + msg)

if os.geteuid() != 0:
    refuse('root required to read active environment without exposing credentials')
if not LIVE.is_dir() or LIVE.is_symlink() or not DEPS.is_dir():
    refuse('pinned live release or isolated pg dependency missing')
if hashlib.sha256((LIVE / REL).read_bytes()).hexdigest() != SHA:
    refuse('pinned live wallet changed')
ss = subprocess.run(['ss', '-ltnpH'], capture_output=True, text=True, timeout=8)
pids = re.findall(r':3098\s+[^\n]*?pid=(\d+)', ss.stdout)
if ss.returncode or len(pids) != 1 or Path('/proc/' + pids[0] + '/cwd').resolve() != LIVE:
    refuse('active callback process not pinned to known release')
live_env = {}
for entry in Path('/proc/' + pids[0] + '/environ').read_bytes().split(b'\0'):
    if b'=' in entry:
        key, val = entry.split(b'=', 1)
        live_env[os.fsdecode(key)] = os.fsdecode(val)
if live_env.get('NODE_TLS_REJECT_UNAUTHORIZED') == '0':
    refuse('insecure TLS configuration')
driver = (live_env.get('DB_DRIVER') or
          ('supabase' if live_env.get('SUPABASE_DB_URL') else 'postgres')).lower()
if driver not in ('postgres', 'supabase'):
    refuse('unrecognized database driver')
if driver == 'supabase' and not (
    live_env.get('SUPABASE_DB_URL') or live_env.get('DATABASE_URL')
):
    refuse('missing Supabase PostgreSQL connection string')
# Do not copy unnecessary secrets (including casino signature, player credentials,
# cookie keys, or service-role keys) to the read-only diagnostics subprocess.
allow = (
    'SUPABASE_DB_URL', 'DATABASE_URL', 'DB_DRIVER',
    'PGHOST', 'PGPORT', 'PGUSER', 'PGPASSWORD', 'PGDATABASE',
    'PGSSLMODE', 'PGSSLROOTCERT', 'PGAPPNAME',
    'SOFTAGGREGATOR_TEST_USER_ID',
)
env = {key: live_env[key] for key in allow if key in live_env}
pilot = env.get('SOFTAGGREGATOR_TEST_USER_ID', '').strip().lower()
if pilot and not PILOT.fullmatch(pilot):
    refuse('test player UUID format is invalid')
env['SOFTAGGREGATOR_TEST_USER_ID'] = pilot
env['PG_DIA_MODULE'] = str(DEPS)
env['NODE_ENV'] = 'production'
env['NODE_TLS_REJECT_UNAUTHORIZED'] = '1'

node = r"""
'use strict';
const {performance} = require('node:perf_hooks');
const {Pool} = require(process.env.PG_DIA_MODULE);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const userId = process.env.SOFTAGGREGATOR_TEST_USER_ID || '';
const config = {
  max:1,
  connectionTimeoutMillis:10000,
  statement_timeout:8000,
  idleTimeoutMillis:1000,
  application_name:'betvima-debit-readonly-20261030',
  keepAlive:true,
};
if (process.env.SUPABASE_DB_URL || process.env.DATABASE_URL) {
  config.connectionString = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
} else {
  config.host = process.env.PGHOST || '127.0.0.1';
  config.port = Number(process.env.PGPORT || 5432);
  config.user = process.env.PGUSER || 'postgres';
  config.password = process.env.PGPASSWORD || '';
  config.database = process.env.PGDATABASE || 'postgres';
}
const pool = new Pool(config);
function stats(label, values) {
  if (!values.length) return;
  const s = values.slice().sort((a,b)=>a-b);
  const at = q => s[Math.min(s.length-1, Math.ceil(q*s.length)-1)];
  console.log(label + ' n=' + s.length +
    ' p50_ms=' + at(0.50).toFixed(1) +
    ' p90_ms=' + at(0.90).toFixed(1) +
    ' max_ms=' + s[s.length-1].toFixed(1));
}
async function measure(client, label, sql, args, rounds) {
  const values = [];
  for (let i=0; i<rounds; i++) {
    const a=performance.now();
    await client.query({text:sql,values:args});
    values.push(Math.max(0,performance.now()-a));
  }
  stats(label,values);
}
async function main() {
  const start=performance.now();
  const client = await pool.connect();
  console.log('DB_COLD_CONNECT_MS='+(performance.now()-start).toFixed(1));
  try {
    await client.query('BEGIN READ ONLY');
    try {
      await client.query('SELECT 1');
      console.log('DB_TRANSACTION_MODE=READ_ONLY');
      await measure(client,'db.network_roundtrip_select1',
        'SELECT 1 AS ok',[],12);
      await measure(client,'db.schema_catalogue_probe',
        "SELECT to_regclass('nova.softaggregator_callback_receipts') IS NOT NULL AS ok",[],5);
      if (UUID.test(userId)) {
        console.log('APPROVED_PILOT_AVAILABLE=TRUE');
        await measure(client,'db.wallet_binding',
          'SELECT wallet_currency FROM nova.softaggregator_player_wallet_bindings WHERE user_id=$1',
          [userId],5);
        await measure(client,'db.wallet',
          "SELECT balance_minor::text, locked_minor::text, is_frozen FROM nova.wallets WHERE user_id=$1 AND currency='USD'",
          [userId],5);
        await measure(client,'db.profile_limits',
          "SELECT p.status, l.max_stake_per_day_minor FROM nova.profiles p LEFT JOIN nova.user_limits l ON l.user_id=p.id AND l.currency='USD' WHERE p.id=$1",
          [userId],4);
        await measure(client,'db.receipt_no_match',
          'SELECT identity_hash FROM nova.softaggregator_callback_receipts WHERE call_id=$1',
          ['bv-readonly-no-matching-callback-20261030'],5);
        await measure(client,'db.round_no_match',
          'SELECT wallet_currency FROM nova.softaggregator_round_fx WHERE user_id=$1 AND round_id=$2 AND game_id=$3',
          [userId,'bv-readonly-no-matching-round-20261030','bv-readonly-no-matching-game'],5);
        await measure(client,'db.pilot_receipts_aggregate',
          "SELECT coalesce(sum(CASE WHEN action='debit' AND rollback=false AND created_at >= date_trunc('day',now() at time zone 'UTC') at time zone 'UTC' THEN amount_minor ELSE 0 END),0)::text AS daily_stake FROM nova.softaggregator_callback_receipts WHERE user_id=$1 AND response_error=0 AND action IN ('debit','credit')",
          [userId],3);
      } else {
        console.log('APPROVED_PILOT_AVAILABLE=FALSE');
      }
    } finally {
      await client.query('ROLLBACK');
    }
  } finally {
    client.release();
  }
}
main().then(async()=>{
  console.log('DIAGNOSTIC_SUCCESS_READ_ONLY=TRUE');
  await pool.end();
}).catch(async err=>{
  console.log('DIAGNOSTIC_FAILED_ERROR_CLASS='+(err && err.constructor ? err.constructor.name : 'unknown'));
  // Never print error text, database URL, SQL, account IDs or balance amounts.
  try {await pool.end();} catch {}
  process.exitCode=2;
});
"""
print('===== DEBIT DB ROUNDTRIP DIAGNOSTIC =====', flush=True)
print('PRODUCTION_SOURCE_AND_PROCESS_PINNED=TRUE', flush=True)
print('NO_CALLBACK_NO_WAGER_NO_MONEY_WRITES=TRUE', flush=True)
try:
    result = subprocess.run(
        ['/usr/bin/node', '-e', node],
        env=env, text=True, capture_output=True, timeout=100,
    )
except subprocess.TimeoutExpired:
    refuse('read-only diagnostic timed out')
# Node script is intentionally silent about all secret values and returned rows.
if result.stdout:
    print(result.stdout.strip(), flush=True)
if result.returncode:
    refuse('diagnostic failed; server and database left unchanged')
print('PRODUCTION_3098_UNCHANGED', flush=True)
