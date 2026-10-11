import { describe, expect, it } from 'vitest';
import type { WorkerContext } from '@/workers/runtime';
import type { Services } from '@/server/services/container';
import { reconcile } from '@/workers/crypto-payout.worker';

describe('crypto payout durable state machine', () => {
  it('moves an ambiguous submitting attempt to manual_review without recreating the payout', async () => {
    let executeWithdrawalCalls = 0;
    let updatedStatus: string | null = null;

    const intent = {
      id: 'intent-id',
      publicId: 'pi-test-ambiguous',
      direction: 'withdrawal',
      status: 'pending',
      userId: 'user-id',
      amountMinor: 100000n,
      currency: 'IRT',
      methodId: 'crypto',
      providerMetadata: {
        destination: 'TTestAddress',
        payoutCurrency: 'usdttrc20',
      },
    } as any;

    const attempt = {
      id: 'attempt-id',
      paymentTransactionId: 'tx-id',
      status: 'submitting',
      provider: 'nowpayments',
      providerReference: null,
      attemptNo: 1,
      destination: 'TTestAddress',
      payoutCurrency: 'usdttrc20',
      amountMinor: 100000n,
      requestStartedAt: new Date().toISOString(),
      providerCreatedAt: null,
      lastCheckedAt: null,
      completedAt: null,
      manualReviewAt: null,
      lastError: null,
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as any;

    const services = {
      payments: {
        getIntent: async () => intent,
        getCryptoPayoutAttempt: async () => attempt,
        updateCryptoPayoutAttempt: async (input: { status: string }) => {
          updatedStatus = input.status;
          return { ...attempt, status: input.status };
        },
      },
      providers: {
        payments: {
          executeWithdrawal: async () => {
            executeWithdrawalCalls += 1;
            throw new Error('executeWithdrawal must not be called');
          },
        },
      },
    } as unknown as Services;

    const ctx = {
      services,
      log: {
        error: () => undefined,
        info: () => undefined,
        warn: () => undefined,
        debug: () => undefined,
      },
    } as unknown as WorkerContext;

    await reconcile(intent.publicId, ctx);

    expect(updatedStatus).toBe('manual_review');
    expect(executeWithdrawalCalls).toBe(0);
  });

  it('reconciles a manual_review payout with an existing provider reference without creating a new payout', async () => {
    let executeWithdrawalCalls = 0;
    let receivedPayoutId: unknown = null;
    let storedStatus: string | null = null;

    const intent = {
      id: 'intent-id-manual-review',
      publicId: 'pi-test-manual-review',
      direction: 'withdrawal',
      status: 'pending',
      userId: 'user-id-manual-review',
      amountMinor: 200000n,
      currency: 'IRT',
      methodId: 'crypto',
      providerMetadata: {
        destination: 'TTestAddressManualReview',
        payoutCurrency: 'usdttrc20',
      },
    } as any;

    const manualReviewAttempt = {
      id: 'attempt-id-manual-review',
      paymentTransactionId: 'tx-id-manual-review',
      status: 'manual_review',
      provider: 'nowpayments',
      providerReference: 'NP-EXISTING-MANUAL-REVIEW-999',
      attemptNo: 1,
      destination: 'TTestAddressManualReview',
      payoutCurrency: 'usdttrc20',
      amountMinor: 200000n,
      requestStartedAt: new Date().toISOString(),
      providerCreatedAt: new Date().toISOString(),
      lastCheckedAt: new Date().toISOString(),
      completedAt: null,
      manualReviewAt: new Date().toISOString(),
      lastError: 'previous verification failure',
      metadata: {
        payout_id: 'NP-EXISTING-MANUAL-REVIEW-999',
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as any;

    const services = {
      payments: {
        getIntent: async () => intent,
        getCryptoPayoutAttempt: async () => manualReviewAttempt,
        updateCryptoPayoutAttempt: async (input: {
          status: string;
          providerReference?: string | null;
          metadata?: Record<string, unknown> | null;
        }) => {
          storedStatus = input.status;
          return {
            ...manualReviewAttempt,
            status: input.status,
            providerReference:
              input.providerReference ?? manualReviewAttempt.providerReference,
            metadata: input.metadata ?? manualReviewAttempt.metadata,
          };
        },
        completeIntent: async (input: {
          publicId: string;
          status: string;
          providerReference?: string | null;
        }) => ({
          intent: {
            ...intent,
            status: input.status,
            providerReference: input.providerReference ?? null,
          },
          walletEntryId: null,
        }),
      },
      providers: {
        payments: {
          executeWithdrawal: async (input: {
            providerMetadata: Record<string, unknown> | null;
          }) => {
            executeWithdrawalCalls += 1;
            receivedPayoutId =
              (input.providerMetadata as Record<string, unknown> | null)?.payoutId ?? null;

            return {
              ok: true,
              value: {
                providerReference: 'NP-EXISTING-MANUAL-REVIEW-999',
                status: 'failed' as const,
                redirectUrl: null,
                expiresAt: null,
                raw: {
                  payout_id: 'NP-EXISTING-MANUAL-REVIEW-999',
                  status: 'REJECTED',
                },
              },
            };
          },
        },
      },
      jobs: {
        enqueue: async () => ({ id: 'reconcile-manual-review-job' }),
      },
    } as unknown as Services;

    const ctx = {
      services,
      log: {
        error: () => undefined,
        info: () => undefined,
        warn: () => undefined,
        debug: () => undefined,
      },
    } as unknown as WorkerContext;

    await reconcile(intent.publicId, ctx);

    expect(executeWithdrawalCalls).toBe(1);
    expect(receivedPayoutId).toBe('NP-EXISTING-MANUAL-REVIEW-999');
    expect(storedStatus).toBe('failed');
  });

  it('executes a prepared payout once and persists the provider reference for reconciliation', async () => {
    let executeWithdrawalCalls = 0;
    let receivedProviderMetadata: Record<string, unknown> | null = null;
    let storedStatus: string | null = null;
    let storedProviderReference: string | null = null;

    const intent = {
      id: 'intent-id-2',
      publicId: 'pi-test-processing',
      direction: 'withdrawal',
      status: 'pending',
      userId: 'user-id-2',
      amountMinor: 200000n,
      currency: 'IRT',
      methodId: 'crypto',
      providerMetadata: {
        destination: 'TTestAddress2',
        payoutCurrency: 'usdttrc20',
      },
    } as any;

    const preparedAttempt = {
      id: 'attempt-id-2',
      paymentTransactionId: 'tx-id-2',
      status: 'prepared',
      provider: 'nowpayments',
      providerReference: null,
      attemptNo: 1,
      destination: 'TTestAddress2',
      payoutCurrency: 'usdttrc20',
      amountMinor: 200000n,
      requestStartedAt: null,
      providerCreatedAt: null,
      lastCheckedAt: null,
      completedAt: null,
      manualReviewAt: null,
      lastError: null,
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as any;

    const submittingAttempt = {
      ...preparedAttempt,
      status: 'submitting',
      requestStartedAt: new Date().toISOString(),
    };

    const services = {
      payments: {
        getIntent: async () => intent,
        getCryptoPayoutAttempt: async () => preparedAttempt,
        claimCryptoPayoutAttempt: async () => submittingAttempt,
        updateCryptoPayoutAttempt: async (input: {
          status: string;
          providerReference?: string | null;
          metadata?: Record<string, unknown> | null;
        }) => {
          storedStatus = input.status;
          storedProviderReference = input.providerReference ?? null;
          return {
            ...submittingAttempt,
            status: input.status,
            providerReference: input.providerReference ?? null,
            metadata: input.metadata ?? {},
          };
        },
        completeIntent: async (input: {
          publicId: string;
          status: string;
          providerReference?: string | null;
        }) => ({
          intent: {
            ...intent,
            status: input.status,
            providerReference: input.providerReference ?? null,
          },
          walletEntryId: null,
        }),
      },
      providers: {
        payments: {
          executeWithdrawal: async (input: {
            providerMetadata: Record<string, unknown> | null;
          }) => {
            executeWithdrawalCalls += 1;
            receivedProviderMetadata = input.providerMetadata;

            return {
              ok: true,
              value: {
                providerReference: 'NP-TEST-PAYOUT-001',
                status: 'processing' as const,
                redirectUrl: null,
                expiresAt: null,
                raw: {
                  payout_id: 'NP-TEST-PAYOUT-001',
                },
              },
            };
          },
        },
      },
      jobs: {
        enqueue: async () => ({ id: 'reconcile-job' }),
      },
    } as unknown as Services;

    const ctx = {
      services,
      log: {
        error: () => undefined,
        info: () => undefined,
        warn: () => undefined,
        debug: () => undefined,
      },
    } as unknown as WorkerContext;

    await reconcile(intent.publicId, ctx);

    expect(executeWithdrawalCalls).toBe(1);
    expect((receivedProviderMetadata as Record<string, unknown> | null)?.payoutId).toBeUndefined();
    expect(storedStatus).toBe('processing');
    expect(storedProviderReference).toBe('NP-TEST-PAYOUT-001');
  });


  it('reconciles an existing payout by passing the stored provider reference instead of creating a new payout', async () => {
    let executeWithdrawalCalls = 0;
    let receivedPayoutId: unknown = null;
    let storedStatus: string | null = null;

    const intent = {
      id: 'intent-id-3',
      publicId: 'pi-test-reconcile',
      direction: 'withdrawal',
      status: 'pending',
      userId: 'user-id-3',
      amountMinor: 300000n,
      currency: 'IRT',
      methodId: 'crypto',
      providerMetadata: {
        destination: 'TTestAddress3',
        payoutCurrency: 'usdttrc20',
      },
    } as any;

    const processingAttempt = {
      id: 'attempt-id-3',
      paymentTransactionId: 'tx-id-3',
      status: 'processing',
      provider: 'nowpayments',
      providerReference: 'NP-EXISTING-PAYOUT-777',
      attemptNo: 1,
      destination: 'TTestAddress3',
      payoutCurrency: 'usdttrc20',
      amountMinor: 300000n,
      requestStartedAt: new Date().toISOString(),
      providerCreatedAt: new Date().toISOString(),
      lastCheckedAt: new Date().toISOString(),
      completedAt: null,
      manualReviewAt: null,
      lastError: null,
      metadata: {
        payout_id: 'NP-EXISTING-PAYOUT-777',
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as any;

    const services = {
      payments: {
        getIntent: async () => intent,
        getCryptoPayoutAttempt: async () => processingAttempt,
        updateCryptoPayoutAttempt: async (input: {
          status: string;
          providerReference?: string | null;
          metadata?: Record<string, unknown> | null;
        }) => {
          storedStatus = input.status;
          return {
            ...processingAttempt,
            status: input.status,
            providerReference:
              input.providerReference ?? processingAttempt.providerReference,
            metadata: input.metadata ?? processingAttempt.metadata,
          };
        },
        completeIntent: async (input: {
          publicId: string;
          status: string;
          providerReference?: string | null;
        }) => ({
          intent: {
            ...intent,
            status: input.status,
            providerReference: input.providerReference ?? null,
          },
          walletEntryId: null,
        }),
      },
      providers: {
        payments: {
          executeWithdrawal: async (input: {
            providerMetadata: Record<string, unknown> | null;
          }) => {
            executeWithdrawalCalls += 1;
            receivedPayoutId =
              (input.providerMetadata as Record<string, unknown> | null)?.payoutId ?? null;

            return {
              ok: true,
              value: {
                providerReference: 'NP-EXISTING-PAYOUT-777',
                status: 'processing' as const,
                redirectUrl: null,
                expiresAt: null,
                raw: {
                  payout_id: 'NP-EXISTING-PAYOUT-777',
                },
              },
            };
          },
        },
      },
      jobs: {
        enqueue: async () => ({ id: 'reconcile-job-2' }),
      },
    } as unknown as Services;

    const ctx = {
      services,
      log: {
        error: () => undefined,
        info: () => undefined,
        warn: () => undefined,
        debug: () => undefined,
      },
    } as unknown as WorkerContext;

    await reconcile(intent.publicId, ctx);

    expect(executeWithdrawalCalls).toBe(1);
    expect(receivedPayoutId).toBe('NP-EXISTING-PAYOUT-777');
    expect(storedStatus).toBe('processing');
  });

});
