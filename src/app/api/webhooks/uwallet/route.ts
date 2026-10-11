import { NextResponse } from 'next/server';
import { withErrorHandling } from '@/lib/errors';
import { createServices } from '@/server/services/container';
import { getTransaction } from '@/server/providers/uwallet/client';

export const dynamic = 'force-dynamic';

function jsonPayload(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === 'object' && parsed !== null && Array.isArray(parsed) === false
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}
export const POST = withErrorHandling(
  'webhooks.uwallet',
  async (_ctx, request: Request) => {
    const rawBody = await request.text();
    const payload = jsonPayload(rawBody);
    const transactionId = String(
      payload.id ?? payload.transactionId ?? payload.transaction_id ?? '',
    ).trim();
    const callbackStatus = String(payload.status ?? '').trim().toLowerCase();

    if (transactionId.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'transaction id is required' },
        { status: 400 },
      );
    }

    const services = createServices();
    const receipt = await services.payments.recordWebhook({
      provider: 'uwallet',
      eventId: `uwallet:${transactionId}:${callbackStatus || 'unknown'}`,
      eventType: callbackStatus || 'unknown',
      signatureValid: false,
      payload,
      raw: rawBody.slice(0, 20000),
      ip: null,
    });

    if (receipt.isDuplicate) {
      return NextResponse.json({ ok: true, status: 'duplicate' });
    }
    const transaction = await getTransaction(transactionId);
    const status = String(
      transaction.status ?? callbackStatus,
    ).trim().toLowerCase();

    const intent =
      await services.payments.getIntentByProviderReference({
        providerReference: transactionId,
      });

    if (!intent) {
      await services.payments.markWebhookProcessed({
        receiptId: receipt.receiptId,
        result: 'voucher_intent_not_found',
      });
      return NextResponse.json({
        ok: true,
        status: 'recorded',
      });
    }

    if (
      intent.methodId !== 'voucher_uvoucher' &&
      intent.methodId !== 'voucher_hotvoucher'
    ) {
      await services.payments.markWebhookProcessed({
        receiptId: receipt.receiptId,
        result: 'voucher_method_mismatch',
      });
      return NextResponse.json({
        ok: true,
        status: 'recorded',
      });
    }

    if (
      status === 'confirm' ||
      status === 'confirmed' ||
      status === 'success' ||
      status === 'succeeded'
    ) {
        const updated = await services.paymentsService.settleVoucherTransaction({
          publicId: intent.publicId,
          providerReference: transactionId,
          transaction: transaction as unknown as {
            status?: string;
            receive?: number;
            amount?: number;
            coin?: string;
            [key: string]: unknown;
          },
        });
      await services.payments.markWebhookProcessed({
        receiptId: receipt.receiptId,
        result: 'voucher_confirmed',
      });
      return NextResponse.json({
        ok: true,
        status: 'processed',
        intent: updated,
      });
    }
    if (
      status === 'reject' ||
      status === 'rejected' ||
      status === 'failed'
    ) {
        const updated = await services.paymentsService.settleVoucherTransaction({
          publicId: intent.publicId,
          providerReference: transactionId,
          transaction: transaction as unknown as {
            status?: string;
            receive?: number;
            amount?: number;
            coin?: string;
            [key: string]: unknown;
          },
        });
      await services.payments.markWebhookProcessed({
        receiptId: receipt.receiptId,
        result: 'voucher_rejected',
      });
      return NextResponse.json({
        ok: true,
        status: 'processed',
        intent: updated,
      });
    }
    await services.payments.markWebhookProcessed({
      receiptId: receipt.receiptId,
      result: 'voucher_pending',
    });
    return NextResponse.json({
      ok: true,
      status: 'pending',
    });
  },
);
