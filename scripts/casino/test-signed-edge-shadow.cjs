#!/usr/bin/env node
/**
 * BetVima: signed synthetic Edge shadow probe. NO casino financial activity.
 *
 * Reads an unrelated root-owned Ed25519 private key from the operator's VPS;
 * checks it matches the PUBLIC SPKI pin deployed to Supabase. Submits only
 * {v,ts,nonce,kind:'probe'} to betvima-casino-edge-shadow in eu-west-1.
 *
 * Required environment: BV_SUPABASE_ANON_JWT (PUBLIC JWT, role=anon).
 * Does not accept service_role or secret keys. Does not modify any files.
 */
'use strict';

const { readFileSync, lstatSync } = require('node:fs');
const { createPrivateKey, createPublicKey, sign, randomBytes } = require('node:crypto');
const { performance } = require('node:perf_hooks');

const SHADOW_KEY_PATH = '/etc/betvima/edge-bridge/edge-bridge-shadow-ed25519.pem';
const PINNED_PUBLIC_SPKI =
  'MCowBQYDK2VwAyEAZ/H+1/rAxIccH4jY+wx7PE5wgFsotby7io0m6wx77cs=';
const ENDPOINT =
  'https://mqygiufkubxxxjodsycu.supabase.co/functions/v1/betvima-casino-edge-shadow?forceFunctionRegion=eu-west-1';

function stop(code) {
  console.log('STOP_' + code);
  process.exit(1);
}

const jwt = process.env.BV_SUPABASE_ANON_JWT || '';
if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(jwt) || jwt.length > 8192) {
  stop('PUBLIC_ANON_JWT_REQUIRED');
}
let jwtPayload;
try {
  jwtPayload = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString('utf8'));
} catch {
  stop('INVALID_PUBLIC_JWT');
}
if (jwtPayload.role !== 'anon' ||
    jwtPayload.ref !== 'mqygiufkubxxxjodsycu' ||
    jwtPayload.iss !== 'supabase' ||
    !Number.isSafeInteger(jwtPayload.exp) ||
    jwtPayload.exp <= Math.floor(Date.now() / 1000)) {
  stop('ONLY_PROJECT_LEGACY_ANON_JWT_ALLOWED');
}
if (process.getuid?.() !== 0) stop('ROOT_REQUIRED_FOR_LOCAL_PRIVATE_KEY');
let keyFile;
try {
  keyFile = lstatSync(SHADOW_KEY_PATH);
} catch {
  stop('SHADOW_PRIVATE_KEY_MISSING');
}
if (!keyFile.isFile() || keyFile.isSymbolicLink() ||
    keyFile.uid !== 0 || (keyFile.mode & 0o077) !== 0) {
  stop('SHADOW_PRIVATE_KEY_PERMISSIONS_UNSAFE');
}
let privateKey;
try {
  privateKey = createPrivateKey(readFileSync(SHADOW_KEY_PATH));
  if (privateKey.asymmetricKeyType !== 'ed25519') {
    stop('EXPECTED_ED25519_PRIVATE_KEY');
  }
  const actualPublicKey = createPublicKey(privateKey)
    .export({ type: 'spki', format: 'der' }).toString('base64');
  if (actualPublicKey !== PINNED_PUBLIC_SPKI) {
    stop('PRIVATE_KEY_DOES_NOT_MATCH_PINNED_PUBLIC_KEY');
  }
} catch {
  stop('PRIVATE_KEY_UNREADABLE');
}
console.log('SHADOW_BRIDGE_LOCAL_PUBLIC_KEY_MATCH=true');

function bodyForSyntheticProbe() {
  return Buffer.from(JSON.stringify({
    v: 1,
    ts: Date.now(),
    nonce: randomBytes(16).toString('hex'),
    kind: 'probe',
  }), 'utf8');
}
async function send(body, signature) {
  const headers = {
    'apikey': jwt,
    'Authorization': 'Bearer ' + jwt,
    'Content-Type': 'application/json',
    'x-region': 'eu-west-1',
  };
  if (signature) headers['x-betvima-bridge-signature'] = signature;
  const start = performance.now();
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers,
    body,
    signal: AbortSignal.timeout(15_000),
  });
  const elapsed = Math.round((performance.now() - start) * 10) / 10;
  let json = {};
  try {
    json = await response.json();
  } catch {
    stop('EDGE_RESPONSE_NOT_JSON');
  }
  const region = response.headers.get('x-sb-edge-region');
  return { status: response.status, ms: elapsed, json, region };
}

(async () => {
  const body = bodyForSyntheticProbe();

  // The public anon JWT alone is NOT sufficient; no signature must be rejected.
  const unsigned = await send(body, null);
  console.log('SHADOW_UNSIGNED_HTTP=' + unsigned.status);
  if (unsigned.status !== 401 ||
      unsigned.json.error !== 'INVALID_SIGNATURE_FORMAT') {
    stop('UNSIGNED_PROBE_NOT_REJECTED');
  }

  const signed = [];
  const signedDb = [];
  for (let i = 0; i < 3; i++) {
    const b = bodyForSyntheticProbe();
    const signature = sign(null, b, privateKey).toString('base64');
    const result = await send(b, signature);
    console.log('SHADOW_SIGNED_HTTP_' + (i + 1) + '=' + result.status);
    if (result.status !== 200 ||
        result.region !== 'eu-west-1' ||
        result.json.ok !== true ||
        result.json.mode !== 'SHADOW_ONLY' ||
        result.json.signed_transport !== true ||
        result.json.financial_operations_enabled !== false ||
        result.json.wallet_modified !== false ||
        result.json.db_operation !== 'SELECT_1' ||
        typeof result.json.db_query_ms !== 'number' ||
        !Number.isFinite(result.json.db_query_ms) ||
        result.json.db_query_ms < 0 ||
        result.json.db_query_ms > 15_000) {
      stop('SIGNED_SHADOW_RESPONSE_NOT_EXPECTED');
    }
    signed.push(result.ms);
    signedDb.push(result.json.db_query_ms);
  }
  const original = bodyForSyntheticProbe();
  const validSignature = sign(null, original, privateKey).toString('base64');
  const tampered = Buffer.from(
    original.toString('utf8').replace('"kind":"probe"', '"kind":"nope"'),
    'utf8',
  );
  if (tampered.equals(original)) stop('TAMPER_TEST_NOT_CONSTRUCTED');
  const bad = await send(tampered, validSignature);
  console.log('SHADOW_TAMPERED_HTTP=' + bad.status);
  if (bad.status !== 401 || bad.json.error !== 'INVALID_SIGNATURE') {
    stop('TAMPERED_PROBE_NOT_REJECTED');
  }

  console.log('SHADOW_SIGNED_TIMES_MS=' + JSON.stringify(signed));
  console.log('SHADOW_EDGE_DB_READ_ONLY_TIMES_MS=' + JSON.stringify(signedDb));
  console.log('SHADOW_EDGE_DB_READ_ONLY_AVG_MS=' + (signedDb.reduce((a,b) => a+b,0) / signedDb.length).toFixed(1));
  console.log('SHADOW_REGION=eu-west-1');
  console.log('SHADOW_SIGNED_TRANSPORT_VERIFIED=true');
  console.log('SHADOW_UNSIGNED_AND_TAMPERED_REJECTED=true');
  console.log('EDGE_DB_QUERY=SELECT_1_ONLY');
  console.log('FINANCIAL_TRANSACTIONS_SENT=0');
  console.log('NGINX_CALLBACK_STILL_UNCHANGED_BY_THIS_SCRIPT=true');
  console.log('SHADOW_TRANSPORT_TEST_SUCCESS');
})().catch((e) => {
  console.log('STOP_SHADOW_NETWORK_TEST_ERROR=' + String(e.code || e.name).slice(0,60));
  process.exitCode = 1;
});
