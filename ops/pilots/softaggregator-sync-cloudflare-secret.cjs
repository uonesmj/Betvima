'use strict';
// Repair one existing Cloudflare Worker secret, without printing secret values.
// Preconditions: a locally authenticated Wrangler CLI and REAL_MONEY_ENABLED=false.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const APP = '/opt/nova-releases/213b5ca3e6e3537705949a50ce69d7e056680c14';
const WORKER = 'betvima-casino-callback';
const KEY = 'SOFTAGGREGATOR_EDGE_HMAC_SECRET';
function message(s) { process.stdout.write(s + '\n'); }
function fail(s) { message('RESULT=BLOCKED'); message('REASON=' + s); process.exit(1); }
if (typeof process.getuid === 'function' && process.getuid() !== 0)
  fail('RUN_AS_ROOT');
process.env.NODE_ENV = 'production';
let loadEnvConfig;
try { ({ loadEnvConfig } = require(path.join(APP, 'node_modules/@next/env'))); }
catch { fail('ACTIVE_RELEASE_ENV_LOADER_NOT_FOUND'); }
loadEnvConfig(APP, false);
if (process.env.SOFTAGGREGATOR_REAL_MONEY_ENABLED === 'true')
  fail('PRODUCTION_REAL_MONEY_MUST_STAY_OFF_DURING_REPAIR');
const secret = process.env[KEY] || '';
if (Buffer.byteLength(secret, 'utf8') < 32 || Buffer.byteLength(secret, 'utf8') > 1024)
  fail('EDGE_SECRET_MISSING_OR_INVALID');
const candidates = [
  '/usr/local/bin/wrangler',
  '/usr/bin/wrangler',
  '/var/www/nova/node_modules/.bin/wrangler',
  path.join(APP, 'node_modules/.bin/wrangler'),
];
const wrangler = candidates.find(f => {
  try { fs.accessSync(f, fs.constants.X_OK); return true; }
  catch { return false; }
});
if (!wrangler) fail('WRANGLER_CLI_NOT_INSTALLED');
function run(args, input) {
  const r = spawnSync(wrangler, args, {
    env: process.env,
    encoding: 'utf8',
    input,
    timeout: 60000,
    maxBuffer: 1024 * 1024
  });
  return { ok: r.status === 0 && !r.error, status: r.status, error: r.error };
}
message('WORKER_TARGET=' + WORKER);
const whoami = run(['whoami']);
if (!whoami.ok) fail('WRANGLER_NOT_AUTHENTICATED');
message('WRANGLER_AUTH=OK');
const existing = run(['secret', 'list', '--name', WORKER, '--json']);
if (!existing.ok) fail('WORKER_NOT_ACCESSIBLE__CHECK_CLOUDFLARE_ACCOUNT');
message('WORKER_FOUND=YES');
const uploaded = run(['secret', 'put', KEY, '--name', WORKER], secret + '\n');
if (!uploaded.ok) fail('CLOUDFLARE_SECRET_UPDATE_FAILED');
message('CLOUDFLARE_SECRET_SYNC=SUCCESS');
message('PRODUCTION_REAL_MONEY=UNCHANGED_OFF');
message('NEXT=VERIFY_SIGNED_PROVIDER_CALLBACK_WITH_STRICT_EDGE_HMAC');
