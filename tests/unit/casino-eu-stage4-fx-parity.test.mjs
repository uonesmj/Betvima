import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runSyntheticFxChecks} from '../../supabase/functions/betvima-eu-casino-stage4-fx-parity/fixtures.ts';

const root = new URL('../../supabase/functions/betvima-eu-casino-stage4-fx-parity/', import.meta.url);
const fx = readFileSync(new URL('fx.ts', root), 'utf8');
const fixtures = readFileSync(new URL('fixtures.ts', root), 'utf8');

test('all FX parity and fail-closed checks pass', () => {
  const checks = runSyntheticFxChecks();
  assert.equal(checks.length, 32);
  for (const check of checks) assert.equal(check.passed, true, check.name);
});
test('uses exact integer arithmetic, no floating point for casino FX', () => {
  assert.match(fx, /const SCALE = 100_000_000n/);
  assert.match(fx, /exactCasinoRefund/);
  assert.doesNotMatch(fx, /\bNumber\s*\(/);
});
test('no API key, provider request, SQL or wallet mutation in test fixtures', () => {
  assert.doesNotMatch(fixtures, /fetch\s*\(|\bprocess\.env\b|\bDeno\.env\b/);
  assert.doesNotMatch(fixtures, /\b(insert|update|delete|truncate)\s+(?:into\s+|from\s+)?nova\./i);
  assert.doesNotMatch(fixtures, /\b(post_wallet_entry|SUPABASE_SERVICE_ROLE_KEY|ARZHAAM_API_KEY)\b/);
});
