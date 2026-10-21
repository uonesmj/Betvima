import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { jsonOk, withErrorHandling } from '@/lib/errors';
import { withUser } from '@/server/http/guard';
import { secureRoyalDemoSpin } from '@/server/originals/royal-vault-demo';

/**
 * Authenticated, server-generated DEMO result only.
 * Absolutely no wallet debit/credit, fund reservation or settlement calls.
 * Requires an explicit preview flag (off by default).
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Input = z.object({
  stakeCredits: z.union([
    z.literal(5), z.literal(10), z.literal(20), z.literal(50), z.literal(100),
  ]),
}).strict();

export const POST = withErrorHandling('originals.royal-vault.demo-spin', async (ctx, request: Request) => {
  if (process.env.BETVIMA_ORIGINALS_PREVIEW_ENABLED !== 'true') {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }
  await withUser(request, ctx); // Session verified server-side; no caller-supplied user ID.
  const length = Number(request.headers.get('content-length') ?? '0');
  if (!Number.isSafeInteger(length) || length < 0 || length > 1024) {
    return NextResponse.json({ error: 'INVALID_REQUEST' }, { status: 400 });
  }
  let parsed: z.infer<typeof Input>;
  try {
    const data: unknown = await request.json();
    parsed = Input.parse(data);
  } catch {
    return NextResponse.json({ error: 'INVALID_REQUEST' }, { status: 400 });
  }
  const round = secureRoyalDemoSpin(parsed.stakeCredits);
  return jsonOk({
    roundId: randomUUID(),
    mode: 'demo' as const,
    round,
  }, { headers: { 'Cache-Control': 'private, no-store' } });
});
