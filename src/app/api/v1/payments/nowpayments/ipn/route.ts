import { createServices } from '@/server/services/container';
import { serverEnv } from '@/server/env';
import { verifyNowPaymentsSignature } from '@/server/providers/nowpayments/signature';
import { withErrorHandling } from '@/lib/errors';
import { hashSignal } from '@/server/utils/hash';

export const dynamic = 'force-dynamic';

export const POST = withErrorHandling(
  'payments.nowpayments.ipn',
  async (ctx, request: Request) => {
    const env = serverEnv();
    const rawBody = await request.text();
    const signature =
      request.headers.get('x-nowpayments-sig') ??
      request.headers.get('x-nowpayments-signature');

    const valid = verifyNowPaymentsSignature(
      rawBody,
      signature,
      env.paymentWebhookSecret,
    );

    if (!valid) {
      return new Response(
        JSON.stringify({ ok: false, error: 'INVALID_SIGNATURE' }),
        { status: 401, headers: { 'content-type': 'application/json' } },
      );
    }

    let payload: Record<string, unknown>;
    try {
      const parsed = JSON.parse(rawBody);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('invalid payload');
      }
      payload = parsed as Record<string, unknown>;
    } catch {
      return new Response(
        JSON.stringify({ ok: false, error: 'INVALID_JSON' }),
        { status: 400, headers: { 'content-type': 'application/json' } },
      );
    }

    const paymentId = payload.payment_id;
    const orderId = typeof payload.order_id === 'string' ? payload.order_id : null;
    const status =
      typeof payload.payment_status === 'string'
        ? payload.payment_status
        : 'unknown';

    const eventId = paymentId != null
      ? `nowpayments:${String(paymentId)}:${status}`
      : `nowpayments:${hashSignal(rawBody).slice(0, 32)}`;

    const services = createServices();

    const receipt = await services.payments.recordWebhook({
      provider: 'nowpayments',
      eventId,
      eventType: status,
      signatureValid: true,
      payload,
      raw: rawBody,
      ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    });

    if (receipt.isDuplicate) {
      return Response.json({ ok: true, duplicate: true });
    }

    if (!orderId) {
      return Response.json({ ok: true, recorded: true });
    }

    const terminalSuccess = status === 'finished';
    const terminalFailure =
      status === 'failed' ||
      status === 'expired' ||
      status === 'refunded';

    if (terminalSuccess || terminalFailure) {
      const result = await services.payments.completeIntent({
        publicId: orderId,
        status: terminalSuccess ? 'succeeded' : 'failed',
        providerReference: paymentId != null ? String(paymentId) : null,
        failureCode: terminalFailure ? status.toUpperCase() : null,
        failureMessage: terminalFailure ? `NOWPayments status: ${status}` : null,
        raw: payload,
      });

      await services.payments.markWebhookProcessed({
        receiptId: receipt.receiptId,
        result: `${result.intent.status}:${orderId}`,
      });
      return Response.json({
        ok: true,
        processed: true,
        publicId: result.intent.publicId,
        status: result.intent.status,
      });
    }

    return Response.json({ ok: true, recorded: true, status });
  },
);
