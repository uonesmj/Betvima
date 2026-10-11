/**
 * CRYPTO PAYOUT WORKER
 *
 * Durable NOWPayments payout execution and reconciliation.
 * Wallet holds are captured only after provider terminal success.
 *
 * IMPORTANT:
 * A `submitting` attempt is ambiguous: NOWPayments may already have
 * accepted the payout while this process was crashing. It must NEVER
 * automatically create another provider payout.
 */
import { createWorker, type WorkerContext, type JobHandler } from './runtime';

const TERMINAL_INTENT_STATUSES = [
  'succeeded',
  'failed',
  'cancelled',
  'refunded',
  'reversed',
] as const;

const TERMINAL_ATTEMPT_STATUSES = ['succeeded', 'failed'] as const;

function payoutCurrencyFromIntent(intent: {
  providerMetadata?: Record<string, unknown> | null;
}): string {
  return String(intent.providerMetadata?.payoutCurrency ?? '').trim().toLowerCase();
}

function destinationFromIntent(intent: {
  providerMetadata?: Record<string, unknown> | null;
}): string {
  return String(intent.providerMetadata?.destination ?? '').trim();
}

export async function reconcile(publicId: string, ctx: WorkerContext): Promise<void> {
  const intent = await ctx.services.payments.getIntent({ publicId });

  if (!intent) {
    throw new Error(`NOT_FOUND:PAYMENT_INTENT:${publicId}`);
  }

  if (intent.direction !== 'withdrawal') {
    throw new Error(`INVALID_PAYMENT_DIRECTION:${publicId}`);
  }

  if (TERMINAL_INTENT_STATUSES.includes(intent.status as (typeof TERMINAL_INTENT_STATUSES)[number])) {
    return;
  }

  let attempt = await ctx.services.payments.getCryptoPayoutAttempt({ publicId });

  if (!attempt) {
    const destination = destinationFromIntent(intent);
    const payoutCurrency = payoutCurrencyFromIntent(intent);

    if (!destination) {
      throw new Error(`INVALID_PAYOUT_DESTINATION:${publicId}`);
    }

    if (!payoutCurrency) {
      throw new Error(`INVALID_PAYOUT_CURRENCY:${publicId}`);
    }

    attempt = await ctx.services.payments.prepareCryptoPayoutAttempt({
      publicId,
      destination,
      payoutCurrency,
      amountMinor: intent.amountMinor,
      provider: 'nowpayments',
    });
  }

  if (TERMINAL_ATTEMPT_STATUSES.includes(attempt.status as (typeof TERMINAL_ATTEMPT_STATUSES)[number])) {
    const status = attempt.status === 'succeeded' ? 'succeeded' : 'failed';

    await ctx.services.payments.completeIntent({
      publicId,
      status,
      providerReference: attempt.providerReference,
      failureCode: status === 'failed' ? 'PROVIDER_PAYOUT_FAILED' : null,
      failureMessage: status === 'failed'
        ? (attempt.lastError ?? 'NOWPayments payout failed or was rejected.')
        : null,
      raw: attempt.metadata,
    });

    return;
  }

  if (attempt.status === 'submitting') {
    await ctx.services.payments.updateCryptoPayoutAttempt({
      publicId,
      status: 'manual_review',
      lastError:
        'Payout submission is ambiguous. Provider request may have been accepted before process interruption; automatic recreation is forbidden.',
    });

    ctx.log.error('crypto payout moved to manual review after ambiguous submission', {
      publicId,
      attemptId: attempt.id,
    });

    return;
  }

  let providerReference = attempt.providerReference;

  if (attempt.status === 'prepared') {
    const claimed = await ctx.services.payments.claimCryptoPayoutAttempt({ publicId });

    if (claimed.status !== 'submitting') {
      throw new Error(
        `CRYPTO_PAYOUT_CLAIM_FAILED:${publicId}:${claimed.status}`,
      );
    }

    providerReference = null;
    attempt = claimed;
  } else if (attempt.status !== 'provider_created' && attempt.status !== 'processing' && !(attempt.status === 'manual_review' && Boolean(attempt.providerReference))) {
    throw new Error(
      `INVALID_CRYPTO_PAYOUT_ATTEMPT_STATE:${publicId}:${attempt.status}`,
    );
  }

  const providerMetadata: Record<string, unknown> = {
    ...(intent.providerMetadata ?? {}),
  };

  if (providerReference) {
    providerMetadata.payoutId = providerReference;
  }

  const result = await ctx.services.providers.payments.executeWithdrawal({
    intentId: intent.id,
    publicId: intent.publicId,
    amountMinor: intent.amountMinor,
    currency: intent.currency,
    methodId: intent.methodId ?? 'crypto_withdrawal',
    userId: intent.userId,
    destination: {
      account: destinationFromIntent(intent),
    },
    providerMetadata,
    idempotencyKey: `crypto-payout:${intent.publicId}`,
  });

  if (!result.ok || !result.value) {
    await ctx.services.payments.updateCryptoPayoutAttempt({
      publicId,
      status: attempt.status === 'submitting' ? 'submitting' : 'manual_review',
      lastError: `${result.errorCode ?? 'PAYOUT_EXECUTION_FAILED'}:${result.errorMessage ?? 'unknown provider error'}`,
    });

    throw new Error(
      `${result.errorCode ?? 'PAYOUT_EXECUTION_FAILED'}:${result.errorMessage ?? 'unknown provider error'}`,
    );
  }

  const provider = result.value;

  const attemptStatus =
    provider.status === 'succeeded'
      ? 'succeeded'
      : provider.status === 'failed'
        ? 'failed'
        : provider.providerReference
          ? 'processing'
          : 'submitting';

  const updatedAttempt = await ctx.services.payments.updateCryptoPayoutAttempt({
    publicId,
    status: attemptStatus,
    providerReference: provider.providerReference || providerReference,
    lastError: provider.status === 'failed'
      ? 'NOWPayments payout failed or was rejected.'
      : null,
    metadata: {
      ...(provider.raw ?? {}),
      payout_id: provider.providerReference || providerReference || null,
    },
  });

  const completed = await ctx.services.payments.completeIntent({
    publicId,
    status:
      provider.status === 'succeeded'
        ? 'succeeded'
        : provider.status === 'failed'
          ? 'failed'
          : 'pending',
    providerReference: updatedAttempt.providerReference,
    failureCode: provider.status === 'failed'
      ? 'PROVIDER_PAYOUT_FAILED'
      : null,
    failureMessage: provider.status === 'failed'
      ? 'NOWPayments payout failed or was rejected.'
      : null,
    raw: provider.raw,
  });

  if (
    provider.status === 'processing' ||
    provider.status === 'pending' ||
    provider.status === 'requires_action'
  ) {
    await ctx.services.jobs.enqueue({
      queue: 'crypto_payout',
      kind: 'crypto.payout_reconcile',
      payload: { publicId: intent.publicId },
      runAfter: new Date(Date.now() + 60_000).toISOString(),
      idempotencyKey:
        `crypto-payout-reconcile:${intent.publicId}:${Math.floor(Date.now() / 60_000)}`,
      maxAttempts: 20,
    });
  }

  ctx.log.info('crypto payout state synchronized', {
    publicId: intent.publicId,
    attemptStatus: updatedAttempt.status,
    providerReference: updatedAttempt.providerReference,
    status: completed.intent.status,
  });
}

const handlers: JobHandler[] = [
  {
    kinds: ['crypto.payout_execute', 'crypto.payout_reconcile'],
    async handle(job, ctx: WorkerContext) {
      const publicId = String(job.payload.publicId ?? '').trim();

      if (!publicId) {
        throw new Error('INVALID_CRYPTO_PAYOUT_PUBLIC_ID');
      }

      await reconcile(publicId, ctx);
    },
  },
];

export function startCryptoPayoutWorker() {
  return createWorker({
    queue: 'crypto_payout',
    handlers,
    tickIntervalMs: 10_000,
    pollIntervalMs: 2_000,
    batchSize: 2,
  });
}
