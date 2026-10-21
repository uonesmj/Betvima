#!/usr/bin/env node
/**
 * Read-only historical supplier signature audit. Use locally on the trusted
 * backend host where SOFTAGGREGATOR_SALT_KEY is already present privately.
 *
 * Input is ONE JSON object via stdin, never command-line parameters:
 * {"url":"https://.../api/webhooks/softaggregator?...",
 *  "xSignature":"<64 hex chars>"}
 * Optional "edgeSignature" may be supplied ONLY if actually captured from
 * the signed edge-to-origin request; otherwise its verification stays null.
 *
 * No input, secret, hash, signature, URL, player, IP, or balance is printed.
 * The history timestamp is not refreshed; the live 30-second check is reported
 * separately and is expected to be false for an old test.
 *
 * No API requests, database access, files written or financial operations.
 */
import { inspectHistoricalSoftAggregatorCallback } from './lib/softaggregator-offline-verifier.mjs';

const MAX_STDIN_BYTES = 16_384;

function fail(reason) {
  process.stdout.write(JSON.stringify({
    readOnly: true, financialOperationsPerformed: false,
    ok: false, reason, realMoneyApproved: false,
  }) + '\n');
  process.exitCode = 1;
}

async function main() {
  // Do not perform troubleshooting against an enabled real-money instance.
  if (process.env.SOFTAGGREGATOR_REAL_MONEY_ENABLED === 'true') {
    fail('real_money_mode_enabled_refused');
    return;
  }
  const salt = process.env.SOFTAGGREGATOR_SALT_KEY ?? '';
  if (salt.length < 12) {
    fail('private_supplier_salt_unavailable');
    return;
  }

  let data = '';
  for await (const chunk of process.stdin) {
    data += chunk.toString('utf8');
    if (Buffer.byteLength(data, 'utf8') > MAX_STDIN_BYTES) {
      fail('invalid_input'); return;
    }
  }
  let input;
  try { input = JSON.parse(data); } catch { fail('invalid_input'); return; }
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      Object.keys(input).some(key => !['url', 'xSignature', 'edgeSignature'].includes(key)) ||
      typeof input.url !== 'string' || typeof input.xSignature !== 'string' ||
      (input.edgeSignature !== undefined && typeof input.edgeSignature !== 'string')) {
    fail('invalid_input'); return;
  }
  const result = inspectHistoricalSoftAggregatorCallback({
    ...input,
    salt,
    edgeSecret: process.env.SOFTAGGREGATOR_EDGE_HMAC_SECRET ?? '',
  });
  const cryptoValid = result.requestShapeValid && result.supplierHmacValid &&
    result.legacyTimestampMd5Valid;
  process.stdout.write(JSON.stringify({
    ...result,
    historicalSupplierCryptographyVerified: cryptoValid,
  }) + '\n');
  if (!cryptoValid) process.exitCode = 1;
}

main().catch(() => fail('verification_failed'));
