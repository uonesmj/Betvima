import { randomInt, randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createDemoSpin, validateBetCents } from '@/lib/casino/pharaoh-gold';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** DEMO ONLY. Never debits, credits, reads or modifies a customer's wallet. */
export async function POST(request: Request) {
  try {
    if (Number(request.headers.get('content-length') || '0') > 1024)
      return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
    const payload: unknown = await request.json();
    if (!payload || typeof payload !== 'object' || Array.isArray(payload))
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    const { betCents, freeSpin } = payload as Record<string, unknown>;
    if (typeof betCents !== 'number' || typeof freeSpin !== 'boolean')
      return NextResponse.json({ error: 'Invalid bet' }, { status: 400 });
    validateBetCents(betCents);
    const result = createDemoSpin(betCents, freeSpin, randomInt, randomUUID());
    return NextResponse.json({ mode: 'demo', currency: 'USD', result }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    if (err instanceof RangeError || err instanceof SyntaxError || (err instanceof Error && err.message.startsWith('Invalid')))
      return NextResponse.json({ error: 'Invalid game request' }, { status: 400 });
    return NextResponse.json({ error: 'Demo spin unavailable' }, { status: 503 });
  }
}
