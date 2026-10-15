import { randomInt, randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createDemoSpin, validateBetCents } from '@/lib/casino/pharaoh-gold';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * DEMO ONLY. GET is intentionally side-effect-free: this endpoint creates an
 * unredeemable random display result, NOT a wager or financial transaction.
 * The isolated Preview proxy only permits GET/HEAD/OPTIONS; never open its
 * POST write surface or reuse this endpoint as a real-money betting API.
 */
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const betRaw = params.get('betCents');
    const freeRaw = params.get('freeSpin');
    if (!betRaw || !/^(0|[1-9]\d{0,4})$/.test(betRaw) || (freeRaw !== 'true' && freeRaw !== 'false'))
      return NextResponse.json({ error: 'Invalid demo request' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
    const betCents = validateBetCents(Number(betRaw));
    const result = createDemoSpin(betCents, freeRaw === 'true', randomInt, randomUUID());
    return NextResponse.json({ mode: 'demo', currency: 'USD', result }, {
      headers: { 'Cache-Control': 'private, no-store, no-cache, must-revalidate', 'Pragma': 'no-cache' },
    });
  } catch (err) {
    if (err instanceof RangeError || (err instanceof Error && err.message.startsWith('Invalid')))
      return NextResponse.json({ error: 'Invalid game request' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
    return NextResponse.json({ error: 'Demo spin unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
