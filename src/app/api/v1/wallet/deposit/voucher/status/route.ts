import { z } from 'zod';
import { withErrorHandling, jsonOk } from '@/lib/errors';
import { withUser } from '@/server/http/guard';
import { getTransaction } from '@/server/providers/uwallet/client';

export const dynamic = 'force-dynamic';

const schema = z.object({
  publicId: z.string().min(1).max(128),
});

export const GET = withErrorHandling('wallet.deposit.voucher.status', async (ctx, request: Request) => {
  const { services, user } = await withUser(request, ctx);

  const url = new URL(request.url);
  const body = schema.parse({
    publicId: url.searchParams.get('publicId') ?? '',
  });

  const intent = await services.payments.getIntent({ publicId: body.publicId, userId: user.id });

  if (!intent || intent.userId !== user.id) {
    const error = new Error('Payment intent not found');
    error.name = 'NOT_FOUND';
    throw error;
  }

  if (
    intent.methodId !== 'voucher_uvoucher' &&
    intent.methodId !== 'voucher_hotvoucher'
  ) {
    const error = new Error('Payment intent is not a voucher payment');
    error.name = 'BAD_REQUEST';
    throw error;
  }

  if (intent.status === 'succeeded' || intent.status === 'failed') {
    return jsonOk({ intent });
  }

  if (!intent.providerReference) {
    return jsonOk({ intent });
  }

  const transaction = await getTransaction(intent.providerReference);
  const status = String(transaction.status ?? '').trim().toLowerCase();

  if (
    status === 'confirm' ||
    status === 'confirmed' ||
    status === 'success' ||
    status === 'succeeded'
  ) {
    const updated = await services.paymentsService.settleVoucherTransaction({
      publicId: intent.publicId,
      providerReference: intent.providerReference,
      transaction: transaction as unknown as {
        status?: string;
        receive?: number;
        amount?: number;
        coin?: string;
        [key: string]: unknown;
      },
    });
    return jsonOk({ intent: updated });
  }

  if (
    status === 'reject' ||
    status === 'rejected' ||
    status === 'failed' ||
    status === 'failure'
  ) {
    const updated = await services.paymentsService.settleVoucherTransaction({
      publicId: intent.publicId,
      providerReference: intent.providerReference,
      transaction: transaction as unknown as {
        status?: string;
        receive?: number;
        amount?: number;
        coin?: string;
        [key: string]: unknown;
      },
    });
    return jsonOk({ intent: updated });
  }

  return jsonOk({ intent });
});
