#!/usr/bin/env python3
"""Read-only 6543 vs 5432 Supabase pooler RTT probe from the LIVE 3098 VPS.

Uses the already-running process environment in memory; never prints credentials,
modifies app config, touches business data, starts services or changes nginx.
Only SELECT 1 is executed. Requires verified active production release.
"""
from __future__ import annotations
import os, re, subprocess, sys
from pathlib import Path

LIVE = Path('/opt/nova-releases/casino-3098-eligible-fallback-HU6Rbl')
NODE_SCRIPT = r"""
'use strict';
(async function () {
  require('@next/env').loadEnvConfig(process.cwd(), false);
  const { Pool } = require('pg');
  const source = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
  if (!source) {
    console.log('STOP: NO_DATABASE_CONNECTION_STRING');
    process.exitCode = 2;
    return;
  }
  let url;
  try { url = new URL(source); }
  catch { console.log('STOP: INVALID_DATABASE_URL'); process.exitCode = 2; return; }
  if (!url.hostname.endsWith('.pooler.supabase.com') || url.port !== '6543') {
    console.log('STOP: EXPECTED_SHARED_SUPABASE_TRANSACTION_POOLER_6543');
    process.exitCode = 2;
    return;
  }
  if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') {
    console.log('STOP: TLS_VERIFICATION_DISABLED');
    process.exitCode = 2;
    return;
  }
  const now = () => Number(process.hrtime.bigint()) / 1e6;
  const summarize = (samples) => {
    samples.sort((a, b) => a - b);
    const median = samples.length % 2 ? samples[(samples.length - 1) / 2] :
      (samples[samples.length / 2 - 1] + samples[samples.length / 2]) / 2;
    return {
      count: samples.length,
      min_ms: +samples[0].toFixed(1),
      median_ms: +median.toFixed(1),
      max_ms: +samples[samples.length - 1].toFixed(1)
    };
  };
  async function measure(port, label) {
    const candidate = new URL(url.toString());
    candidate.port = String(port);
    const pool = new Pool({
      connectionString: candidate.toString(), max: 1,
      connectionTimeoutMillis: 7500,
      statement_timeout: 5000,
      query_timeout: 7500,
      idleTimeoutMillis: 1000,
      allowExitOnIdle: true
    });
    const started = now();
    let client;
    try {
      client = await pool.connect();
      const connectMs = now() - started;
      for (let j = 0; j < 2; ++j) {
        const r = await client.query('SELECT 1 AS ok');
        if (r.rows[0]?.ok !== 1) throw new Error('READ_ONLY_QUERY_FAILED');
      }
      const samples = [];
      for (let j = 0; j < 10; ++j) {
        const start = now();
        const r = await client.query('SELECT 1 AS ok');
        if (r.rows[0]?.ok !== 1) throw new Error('READ_ONLY_QUERY_FAILED');
        samples.push(now() - start);
      }
      console.log(label + ': ' + JSON.stringify({
        connect_ms: +connectMs.toFixed(1), ...summarize(samples)
      }));
      return summarize(samples);
    } catch (e) {
      console.log(label + ': UNAVAILABLE (' + (e.code || e.name || 'ERROR') + ')');
      return null;
    } finally {
      if (client) client.release();
      await pool.end();
    }
  }
  console.log('===== READ_ONLY_POSTGRES_RTT =====');
  const transaction = await measure(6543, 'TRANSACTION_POOLER_6543');
  const session = await measure(5432, 'SESSION_POOLER_5432');
  if (transaction && session) {
    console.log('SESSION_MINUS_TRANSACTION_MEDIAN_MS: ' +
      (session.median_ms - transaction.median_ms).toFixed(1));
  }
  console.log('DB_WRITE_COMMANDS: NONE');
})().catch(e => {
  console.log('STOP: RTT_PROBE_FAILED (' + (e.code || e.name || 'ERROR') + ')');
  process.exitCode = 2;
});
"""

def fail(message: str) -> None:
    raise SystemExit('STOP: ' + message)

if os.geteuid() != 0:
    fail('root required to inspect active 3098 process environment')
if not LIVE.is_dir():
    fail('pinned 3098 release not found')
result = subprocess.run(['ss', '-ltnpH'], capture_output=True, text=True, timeout=8)
if result.returncode != 0:
    fail('cannot inspect listeners')
pids = re.findall(r':3098\s+[^\n]*?pid=(\d+)', result.stdout)
if len(pids) != 1 or Path('/proc/' + pids[0] + '/cwd').resolve() != LIVE:
    fail('production 3098 release was changed')
env = {
    'PATH': '/usr/bin:/bin',
    'HOME': '/root',
    'NODE_ENV': 'production'
}
allowed = {
    'SUPABASE_DB_URL', 'DATABASE_URL', 'NODE_EXTRA_CA_CERTS',
    'PGSSLMODE', 'PGSSLROOTCERT', 'PGHOST', 'PGPORT',
    'PGDATABASE', 'PGUSER', 'PGPASSWORD'
}
for item in Path('/proc/' + pids[0] + '/environ').read_bytes().split(b'\0'):
    if b'=' not in item:
        continue
    a, b = item.split(b'=', 1)
    key = os.fsdecode(a)
    if key in allowed:
        env[key] = os.fsdecode(b)
if env.get('NODE_EXTRA_CA_CERTS') and not Path(env['NODE_EXTRA_CA_CERTS']).is_file():
    fail('active TLS CA bundle no longer exists')
if env.get('NODE_TLS_REJECT_UNAUTHORIZED') == '0':
    fail('unsafe TLS configuration')
result = subprocess.run(
    ['/usr/bin/node', '-e', NODE_SCRIPT],
    cwd=LIVE, env=env, timeout=70, check=False
)
raise SystemExit(result.returncode)
