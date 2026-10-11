import { NextResponse } from 'next/server';
import { withErrorHandling } from '@/lib/errors';
import { createServices } from '@/server/services/container';
import { clientIpFromHeaders, hashSignal } from '@/server/utils/hash';

export const dynamic = 'force-dynamic';

/**
 * Provider webhook endpoint.
 * - the raw body is read verbatim so signature verification stays possible
 * - the receipt is stored first (idempotent on provider event id)
 * - with no provider configured nothing is applied: the receipt is recorded and the
 *   response says so, instead of trusting an unverifiable payload
 */
export const POST = withErrorHandling('webhooks.payment', async (ctx, request: Request, params: { params: Promise<{ provider: string }> }) => {
  const { provider } = await params.params;
  const rawBody = await request.text();
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => { headers[key.toLowerCase()] = value; });
  const services = createServices();
  const result = await services.paymentsService.handleWebhook({
    provider, rawBody, headers, ip: clientIpFromHeaders(request.headers),
  });
  return NextResponse.json(
    { ok: true, data: { ...result, receivedAt: new Date().toISOString() } },
    { status: result.status === 'duplicate' ? 200 : 202, headers: { 'x-correlation-id': ctx.correlationId, 'x-webhook-fingerprint': hashSignal(rawBody).slice(0, 16) } },
  );
});
