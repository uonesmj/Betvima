import { NextResponse } from 'next/server';
import { validateCallback, verifyCallbackEdgeSignature, verifySupplierCallbackSignature } from '@/server/providers/softaggregator/contract';
import { casinoRealMoneyEnabled } from '@/server/providers/softaggregator/client';
import { settleCasinoCallback } from '@/server/providers/softaggregator/wallet';
import { traceCasinoCallback } from '@/server/providers/softaggregator/perf-trace';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function reply(error: 0 | 1 | 2, balance = 0) {
  // SoftAggregator requires HTTP 200 even on business errors.
  return NextResponse.json({ error, balance }, {
    status: 200, headers: { 'Cache-Control': 'no-store, max-age=0', 'X-Content-Type-Options': 'nosniff' },
  });
}

/**
 * Optional balance-only audit: verify real provider + independent Worker
 * signatures in the live callback path while ALL financial processing remains
 * disabled. Never logs secrets, params, user names or balances and never
 * reports success to the vendor. Other actions are never inspected or settled.
 * Disabled by default; MUST NOT be treated as real-money authorization.
 */
function auditSignedTestBalance(request: Request) {
  if (process.env.SOFTAGGREGATOR_CALLBACK_AUDIT_ENABLED !== 'true') return;
  const url = new URL(request.url);
  const params = url.searchParams;
  if (params.get('action') !== 'balance' ||
      params.get('username') !== 'softagg_test' ||
      params.get('currency') !== 'USD' ||
      !/^[a-zA-Z0-9_-]{1,160}$/.test(params.get('call_id') ?? '') ||
      params.has('amount') || params.has('rb') ||
      params.has('round_id') || params.has('game_id')) return;
  const salt = process.env.SOFTAGGREGATOR_SALT_KEY ?? '';
  const edgeSecret = process.env.SOFTAGGREGATOR_EDGE_HMAC_SECRET ?? '';
  // Do not log any unsigned/untrusted source, even a rejected request.
  if (!verifySupplierCallbackSignature(url, request.headers.get('x-signature'), salt) ||
      !verifyCallbackEdgeSignature(
        url, request.headers.get('x-betvima-edge-signature'),
        salt, Date.now(), edgeSecret,
      )) return;
  console.info('softaggregator.callback.audit', 'dual_signature_verified_balance_only');
}

export async function GET(request: Request) {
  if (!casinoRealMoneyEnabled()) {
    auditSignedTestBalance(request);
    return reply(2);
  }
  const salt = process.env.SOFTAGGREGATOR_SALT_KEY ?? '';
  // Different secrets: provider's MD5 salt proves its timestamp; the trusted
  // edge HMAC authenticates all amount, player, round and rollback fields.
  const edgeSecret = process.env.SOFTAGGREGATOR_EDGE_HMAC_SECRET ?? '';
  if (Buffer.byteLength(edgeSecret, 'utf8') < 32) return reply(2);
  const url = new URL(request.url);
  // Require both independently authenticated signatures. SoftAggregator signs
  // the decoded query with the supplier salt; the trusted Cloudflare ingress
  // signs the percent-encoded query with an unrelated server-side secret.
  // Never accept an edge-only callback that lacks supplier authentication.
  if (!verifySupplierCallbackSignature(url, request.headers.get('x-signature'), salt))
    return reply(2);
  const event = validateCallback(
    url, request.headers.get('x-betvima-edge-signature'), salt,
    Date.now(), edgeSecret,
  );
  if (!event) return reply(2);
  try {
    const result = await traceCasinoCallback(event.action, event.rollback,
      () => settleCasinoCallback(event));
    return reply(result.error, result.balance);
  } catch (err) {
    // Never acknowledge a failed database transaction as successful.
    console.error('softaggregator.callback.failed', err instanceof Error ? err.name : 'unknown');
    return reply(2);
  }
}
