/**
 * PAYMENT / VOUCHER RECONCILIATION WORKER
 *
 * Reconciles pending uWallet voucher deposits when the provider webhook
 * is delayed, missing, duplicated, or rejected.
 *
 * Settlement always goes through the existing PaymentService settlement path.
 * This worker never modifies payment or wallet ledger rows directly.
 */
import { createWorker, type WorkerContext, type JobHandler } from './runtime';
import { getTransaction, type UWalletTransaction } from '@/server/providers/uwallet/client';

const handlers: JobHandler[] = [
  {
    kinds: ['payment.reconcile_vouchers'],
    async handle(job) {
      return {
        status: 'accepted',
        jobId: job.id,
      };
    },
  },
];

const CONFIRMED_STATUSES = new Set([
  'confirm',
  'confirmed',
  'success',
  'succeeded',
  'completed',
]);

const REJECTED_STATUSES = new Set([
  'reject',
  'rejected',
  'failed',
  'failure',
  'cancelled',
  'canceled',
]);

const VOUCHER_METHODS = new Set([
  'voucher_hotvoucher',
  'voucher_uvoucher',
]);

async function reconcileVoucher(ctx: WorkerContext, intent: {
  publicId: string;
  providerReference: string | null;
  method: string;
}) {
  if (!intent.providerReference) return;

  const transaction: UWalletTransaction = await getTransaction(
    intent.providerReference,
  );

  const status = String(transaction.status ?? '').trim().toLowerCase();

  if (CONFIRMED_STATUSES.has(status)) {
    await ctx.services.paymentsService.settleVoucherTransaction({
      publicId: intent.publicId,
      providerReference: intent.providerReference,
      transaction,
    });

    ctx.log.info('voucher deposit reconciled', {
      publicId: intent.publicId,
      providerReference: intent.providerReference,
      method: intent.method,
      status,
    });

    return;
  }

  if (REJECTED_STATUSES.has(status)) {
    await ctx.services.payments.completeIntent({
      publicId: intent.publicId,
      status: 'failed',
      providerReference: intent.providerReference,
      failureCode: 'PROVIDER_REJECTED',
      failureMessage: `uWallet voucher status: ${status}`,
      raw: transaction as unknown as Record<string, unknown>,
    });

    ctx.log.warn('voucher deposit rejected', {
      publicId: intent.publicId,
      providerReference: intent.providerReference,
      method: intent.method,
      status,
    });
  }
}

createWorker({
  queue: 'payment',
  handlers,
  tickIntervalMs: 30_000,
  pollIntervalMs: 5_000,
  batchSize: 5,

  async tick(ctx: WorkerContext) {
    await ctx.withLock(
      'payment:voucher-reconciliation',
      90,
      async () => {
        const pending = await ctx.services.payments.listIntents({
          direction: 'deposit',
          status: 'pending',
          page: 1,
          pageSize: 25,
        });

        const vouchers = pending.items.filter((intent) =>
          VOUCHER_METHODS.has(String(intent.methodId ?? '').toLowerCase()),
        );

        if (vouchers.length === 0) return;

        for (const intent of vouchers) {
          try {
            await reconcileVoucher(ctx, {
              publicId: intent.publicId,
              providerReference: intent.providerReference,
              method: String(intent.methodId ?? ''),
            });
          } catch (error) {
            ctx.log.error('voucher reconciliation failed', {
              publicId: intent.publicId,
              providerReference: intent.providerReference,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      },
    );
  },
});
