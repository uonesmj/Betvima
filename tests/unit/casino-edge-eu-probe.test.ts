import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyDebitEuCanary } from '../../supabase/functions/betvima-eu-debit-batch-probe/verify.ts';

// No production keys, identity or financial data are needed for negative-path tests.
const encoder = new TextEncoder();
const publicKey = 'MCowBQYDK2VwAyEAZ/H+1/rAxIccH4jY+wx7PE5wgFsotby7io0m6wx77cs=';
const body = encoder.encode(JSON.stringify({
  v: 1, kind: 'debit_eu_canary',
  nonce: '0123456789abcdef0123456789abcdef',
  ts: Date.now(),
}));

test('reject non-EU function invocation', async () => {
  const result = await verifyDebitEuCanary(body, '', publicKey, 'us-east-1');
  assert.deepEqual(result, {ok:false, code:'UNEXPECTED_REGION'});
});
test('reject missing signer', async () => {
  const result = await verifyDebitEuCanary(body, '', publicKey, 'eu-west-1');
  assert.deepEqual(result, {ok:false, code:'INVALID_SIGNATURE_FORMAT'});
});
test('reject too-large synthetic request', async () => {
  const result = await verifyDebitEuCanary(new Uint8Array(513), '', publicKey, 'eu-west-1');
  assert.deepEqual(result, {ok:false, code:'BODY_SIZE_INVALID'});
});
test('reject malformed key and signature before JSON processing', async () => {
  const result = await verifyDebitEuCanary(body, 'not_base64', publicKey, 'eu-west-1');
  assert.deepEqual(result, {ok:false, code:'INVALID_SIGNATURE_FORMAT'});
});
