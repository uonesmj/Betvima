import { NextResponse } from 'next/server';
import { validateCallback } from '@/server/providers/softaggregator/contract';
import { casinoRealMoneyEnabled } from '@/server/providers/softaggregator/client';
import { settleCasinoCallback } from '@/server/providers/softaggregator/wallet';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function reply(error: 0 | 1 | 2, balance = 0) {
  // SoftAggregator requires HTTP 200 even on business errors.
  return NextResponse.json({ error, balance }, {
    status: 200, headers: { 'Cache-Control': 'no-store, max-age=0', 'X-Content-Type-Options': 'nosniff' },
  });
}

export async function GET(request: Request) {
  if (!casinoRealMoneyEnabled()) return reply(2);
  const salt = process.env.SOFTAGGREGATOR_SALT_KEY ?? '';
  // Different secrets: provider's MD5 salt proves its timestamp; the trusted
  // edge HMAC authenticates all amount, player, round and rollback fields.
  const edgeSecret = process.env.SOFTAGGREGATOR_EDGE_HMAC_SECRET ?? '';
  if (Buffer.byteLength(edgeSecret, 'utf8') < 32) return reply(2);
  const event = validateCallback(
    new URL(request.url), request.headers.get('x-signature'), salt,
    Date.now(), edgeSecret,
  );
  if (!event) return reply(2);
  try {
    const result = await settleCasinoCallback(event);
    return reply(result.error, result.balance);
  } catch (err) {
    // Never acknowledge a failed database transaction as successful.
    console.error('softaggregator.callback.failed', err instanceof Error ? err.name : 'unknown');
    return reply(2);
  }
}
