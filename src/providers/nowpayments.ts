import type { PaymentMethod, UUID } from '@/lib/types';
import { serverEnv } from '@/server/env';
import { createHmac } from 'node:crypto';

function generateNowPaymentsTotp(secret: string): string {
  const normalized = secret.trim().replace(/\s+/g, '').toUpperCase();
  if (!normalized) throw new Error('NOWPAYMENTS_PAYOUT_2FA_SECRET is empty.');
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const clean = normalized.replace(/=+$/g, '');
  let bits = '';
  for (const char of clean) {
    const value = alphabet.indexOf(char);
    if (value < 0) throw new Error('NOWPAYMENTS_PAYOUT_2FA_SECRET is not valid Base32.');
    bits += value.toString(2).padStart(5, '0');
  }
  const byteLength = Math.floor(bits.length / 8);
  const key = Buffer.alloc(byteLength);
  for (let i = 0; i < byteLength; i++) {
    key[i] = Number.parseInt(bits.slice(i * 8, i * 8 + 8), 2);
  }
  const counter = Math.floor(Date.now() / 1000 / 30);
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac('sha1', key).update(message).digest();
  const offset = (digest[digest.length - 1] ?? 0) & 0x0f;
  const binary =
    (((digest[offset] ?? 0) & 0x7f) * 0x1000000) +
    ((digest[offset + 1] ?? 0) * 0x10000) +
    ((digest[offset + 2] ?? 0) * 0x100) +
    (digest[offset + 3] ?? 0);
  return String(binary % 1_000_000).padStart(6, '0');
}
import type { PaymentProviderAdapter, ProviderPaymentIntent, ProviderResult, ProviderStatus } from '@/lib/ports/providers';
import {
  authenticateMassPayouts,
  getMassPayoutBalance,
  validateMassPayoutAddress,
  getMassPayoutStatus,
  getEstimate,
  createMassPayout,
  verifyMassPayout,
} from '@/server/providers/nowpayments/client';

const requiredEnv = [
  'PAYMENT_PROVIDER',
  'PAYMENT_PROVIDER_BASE_URL',
  'PAYMENT_PROVIDER_API_KEY',
  'NOWPAYMENTS_PAYOUT_EMAIL',
  'NOWPAYMENTS_PAYOUT_PASSWORD',
  'NOWPAYMENTS_PAYOUT_2FA_SECRET',
];

export class NowPaymentsProvider implements PaymentProviderAdapter {
  readonly name = 'nowpayments';
  readonly configured = true;

  async health(): Promise<ProviderStatus> {
    try {
      const { token } = await authenticateMassPayouts();
      const balance = await getMassPayoutBalance(token);

      return {
        provider: this.name,
        category: 'payments',
        configured: true,
        enabled: true,
        reachable: true,
        lastError: null,
        lastSuccessAt: new Date().toISOString(),
        requiredEnv,
        notes: `NOWPayments Mass Payout API reachable. Balance currencies: ${Object.keys(balance).length}`,
      };
    } catch (error) {
      return {
        provider: this.name,
        category: 'payments',
        configured: true,
        enabled: false,
        reachable: false,
        lastError: error instanceof Error ? error.message : String(error),
        lastSuccessAt: null,
        requiredEnv,
        notes: 'NOWPayments Mass Payout integration is configured but not currently reachable.',
      };
    }
  }

  async listMethods(input: {
    direction: 'deposit' | 'withdrawal';
    currency: string;
    amountMinor?: bigint;
  }): Promise<ProviderResult<PaymentMethod[]>> {
    void input;
    return {
      ok: true,
      value: [],
      retryable: false,
    };
  }

  async createDeposit(input: {
    intentId: UUID;
    publicId: string;
    amountMinor: bigint;
    currency: string;
    methodId: string;
    userId: UUID;
    returnUrl: string | null;
    idempotencyKey: string;
  }): Promise<ProviderResult<ProviderPaymentIntent>> {
    return {
      ok: false,
      value: null,
      errorCode: 'USE_PAYMENT_SERVICE',
      errorMessage: `Deposit ${input.publicId} uses the existing NOWPayments deposit flow.`,
      retryable: false,
    };
  }

  async createWithdrawal(input: {
    intentId: UUID;
    publicId: string;
    amountMinor: bigint;
    currency: string;
    methodId: string;
    userId: UUID;
    destination: Record<string, unknown> | null;
    idempotencyKey: string;
  }): Promise<ProviderResult<ProviderPaymentIntent>> {
    void input;

    return {
      ok: false,
      value: null,
      errorCode: 'CRYPTO_PAYOUT_NOT_ACTIVATED',
      errorMessage: 'NOWPayments crypto payout execution is intentionally disabled.',
      retryable: false,
    };
  }

  async verifyAndParseWebhook(): Promise<ProviderResult<{
    eventId: string;
    eventType: string;
    providerReference: string | null;
    status: string;
    amountMinor: bigint | null;
    currency: string | null;
    payload: Record<string, unknown>;
  }>> {
    return {
      ok: false,
      value: null,
      errorCode: 'USE_NOWPAYMENTS_IPN_HANDLER',
      errorMessage: 'NOWPayments IPN is handled by the existing dedicated IPN route.',
      retryable: false,
    };
  }

  async refund(): Promise<ProviderResult<{
    providerReference: string;
    status: 'succeeded' | 'failed';
    raw?: Record<string, unknown>;
  }>> {
    return {
      ok: false,
      value: null,
      errorCode: 'REFUND_NOT_IMPLEMENTED',
      errorMessage: 'NOWPayments payout refund is not implemented.',
      retryable: false,
    };
  }

  async payoutStatus(providerReference: string): Promise<ProviderResult<{
    status: string;
    raw?: Record<string, unknown>;
  }>> {
    try {
      const { token } = await authenticateMassPayouts();
      const raw = await getMassPayoutStatus(token, providerReference);

      return {
        ok: true,
        value: {
          status: typeof raw.status === 'string' ? raw.status : 'unknown',
          raw,
        },
      };
    } catch (error) {
      return {
        ok: false,
        value: null,
        errorCode: 'NOWPAYMENTS_PAYOUT_STATUS_FAILED',
        errorMessage: error instanceof Error ? error.message : String(error),
        retryable: true,
      };
    }
  }

  async executeWithdrawal(input: {
    intentId: UUID;
    publicId: string;
    amountMinor: bigint;
    currency: string;
    methodId: string;
    userId: UUID;
    destination: Record<string, unknown> | null;
    providerMetadata: Record<string, unknown> | null;
    idempotencyKey: string;
  }): Promise<ProviderResult<ProviderPaymentIntent>> {
    try {
      const metadata = input.providerMetadata ?? {};
      const destination = String(
        metadata.destination ?? input.destination?.account ?? '',
      ).trim();
      const payoutCurrency = String(metadata.payoutCurrency ?? '').trim().toLowerCase();
      const existingPayoutId = String(
        metadata.payoutId ?? metadata.batchWithdrawalId ?? '',
      ).trim();

      if (!destination) {
        return {
          ok: false,
          value: null,
          errorCode: 'INVALID_PAYOUT_DESTINATION',
          errorMessage: 'Crypto payout destination is missing.',
          retryable: false,
        };
      }

      if (!payoutCurrency) {
        return {
          ok: false,
          value: null,
          errorCode: 'INVALID_PAYOUT_CURRENCY',
          errorMessage: 'Crypto payout currency is missing.',
          retryable: false,
        };
      }

      const { token } = await authenticateMassPayouts();

      if (!existingPayoutId) {
        try {
          await validateMassPayoutAddress({
            token,
            address: destination,
            currency: payoutCurrency,
          });
        } catch (validationError) {
          const message = validationError instanceof Error
            ? validationError.message
            : String(validationError);
          if (!message.includes('NOWPAYMENTS_404')) {
            throw validationError;
          }
        }

        const payoutUsdAmountMinorRaw =
          metadata.payoutUsdAmountMinor ??
          (metadata.fx && typeof metadata.fx === 'object'
            ? (metadata.fx as Record<string, unknown>).paymentAmountMinor
            : null);
        const payoutUsdAmountMinor = BigInt(String(payoutUsdAmountMinorRaw ?? '0'));
        const usdAmount = Number(payoutUsdAmountMinor) / 100;
        if (!Number.isFinite(usdAmount) || usdAmount <= 0) {
          return {
            ok: false,
            value: null,
            errorCode: 'INVALID_PAYOUT_AMOUNT',
            errorMessage: 'Withdrawal amount is invalid.',
            retryable: false,
          };
        }

        const estimate = await getEstimate({
          amount: usdAmount,
          currencyFrom: 'usd',
          currencyTo: payoutCurrency,
        });

        const cryptoAmount = Number(estimate.estimated_amount);
        if (!Number.isFinite(cryptoAmount) || cryptoAmount <= 0) {
          return {
            ok: false,
            value: null,
            errorCode: 'PAYOUT_ESTIMATE_INVALID',
            errorMessage: 'NOWPayments returned an invalid crypto payout estimate.',
            retryable: true,
          };
        }

        const balance = await getMassPayoutBalance(token);
        const balanceValue = balance[payoutCurrency];

        if (balanceValue !== undefined) {
          const available =
            typeof balanceValue === 'number'
              ? balanceValue
              : typeof balanceValue === 'string'
                ? Number(balanceValue)
                : Number(
                    (balanceValue as Record<string, unknown>)?.amount ??
                    (balanceValue as Record<string, unknown>)?.balance ??
                    NaN,
                  );

          if (Number.isFinite(available) && available < cryptoAmount) {
            return {
              ok: false,
              value: null,
              errorCode: 'NOWPAYMENTS_INSUFFICIENT_BALANCE',
              errorMessage: `Insufficient NOWPayments ${payoutCurrency} balance.`,
              retryable: false,
            };
          }
        }

        const created = await createMassPayout(token, {
          withdrawals: [{
            address: destination,
            currency: payoutCurrency,
            amount: cryptoAmount,
          }],
        });

        const payoutId = String(
          created.id ?? created.batch_withdrawal_id ?? '',
        ).trim();

        if (!payoutId) {
          return {
            ok: false,
            value: null,
            errorCode: 'NOWPAYMENTS_PAYOUT_ID_MISSING',
            errorMessage: 'NOWPayments created a payout but returned no payout ID.',
            retryable: false,
          };
        }

        try {
          const verificationCode = generateNowPaymentsTotp(
            serverEnv().nowPaymentsPayout2faSecret,
          );

          await verifyMassPayout(token, payoutId, verificationCode);
        } catch (verifyError) {
          const verifyMessage = verifyError instanceof Error
            ? verifyError.message
            : String(verifyError);
          let statusAfterVerifyFailure: Record<string, unknown> = {};
          try {
            statusAfterVerifyFailure = await getMassPayoutStatus(
              token,
              payoutId,
            );
          } catch {
            statusAfterVerifyFailure = {};
          }
          const providerStatusAfterVerifyFailure = String(
            statusAfterVerifyFailure.status ?? '',
          ).toLowerCase();
          const statusAfterVerifyFailureMapped =
            ['finished', 'succeeded', 'completed'].includes(
              providerStatusAfterVerifyFailure,
            )
              ? 'succeeded'
              : ['failed', 'rejected', 'cancelled', 'canceled'].includes(
                  providerStatusAfterVerifyFailure,
                )
                ? 'failed'
                : 'processing';

          return {
            ok: true,
            value: {
              providerReference: payoutId,
              status: statusAfterVerifyFailureMapped,
              redirectUrl: null,
              expiresAt: null,
              raw: {
                ...created,
                ...statusAfterVerifyFailure,
                payout_id: payoutId,
                estimated_crypto_amount: cryptoAmount,
                payout_currency: payoutCurrency,
                verify_error: verifyMessage,
                verify_status_check: true,
              },
            },
            retryable: false,
          };
        }

        const statusRaw = await getMassPayoutStatus(token, payoutId);
        const providerStatus = String(statusRaw.status ?? '').toLowerCase();

        const status =
          ['finished', 'succeeded', 'completed'].includes(providerStatus)
            ? 'succeeded'
            : ['failed', 'rejected', 'cancelled', 'canceled'].includes(providerStatus)
              ? 'failed'
              : 'processing';

        return {
          ok: true,
          value: {
            providerReference: payoutId,
            status,
            redirectUrl: null,
            expiresAt: null,
            raw: {
              ...created,
              ...statusRaw,
              payout_id: payoutId,
              estimated_crypto_amount: cryptoAmount,
              payout_currency: payoutCurrency,
            },
          },
          retryable: false,
        };
      }

      const current = await getMassPayoutStatus(token, existingPayoutId);
      let statusRaw = current;
      let providerStatus = String(
        current.status ??
        (Array.isArray((current as { withdrawals?: unknown[] }).withdrawals) &&
        (current as { withdrawals?: Array<{ status?: unknown }> }).withdrawals?.length
          ? (current as { withdrawals: Array<{ status?: unknown }> }).withdrawals[0]?.status
          : ''),
      ).toLowerCase();

      if (['creating', 'waiting', 'pending', 'requires_action'].includes(providerStatus)) {
        try {
          const verificationCode = generateNowPaymentsTotp(
            serverEnv().nowPaymentsPayout2faSecret,
          );

          statusRaw = await verifyMassPayout(
            token,
            existingPayoutId,
            verificationCode,
          );

          providerStatus = String(
            statusRaw.status ?? providerStatus,
          ).toLowerCase();
        } catch (verifyError) {
          const verifyMessage = verifyError instanceof Error
            ? verifyError.message
            : String(verifyError);
          statusRaw = await getMassPayoutStatus(
            token,
            existingPayoutId,
          );

          providerStatus = String(
            statusRaw.status ?? providerStatus,
          ).toLowerCase();

          statusRaw = {
            ...statusRaw,
            payout_id: existingPayoutId,
            verify_error: verifyMessage,
            verify_status_check: true,
          };
        }
      }

      const status =
        ['finished', 'succeeded', 'completed'].includes(providerStatus)
          ? 'succeeded'
          : ['failed', 'rejected', 'cancelled', 'canceled'].includes(providerStatus)
            ? 'failed'
            : 'processing';

      return {
        ok: true,
        value: {
          providerReference: existingPayoutId,
          status,
          redirectUrl: null,
          expiresAt: null,
          raw: {
            ...statusRaw,
            payout_id: existingPayoutId,
          },
        },
        retryable: false,
      };
    } catch (error) {
      return {
        ok: false,
        value: null,
        errorCode: 'NOWPAYMENTS_PAYOUT_EXECUTION_FAILED',
        errorMessage: error instanceof Error ? error.message : String(error),
        retryable: true,
      };
    }
  }
  async validateDestination(
    address: string,
    currency: string,
  ): Promise<ProviderResult<Record<string, unknown>>> {
    try {
      const { token } = await authenticateMassPayouts();
      const value = await validateMassPayoutAddress({
        token,
        address,
        currency,
      });

      return {
        ok: true,
        value,
        retryable: false,
      };
    } catch (error) {
      return {
        ok: false,
        value: null,
        errorCode: 'NOWPAYMENTS_ADDRESS_VALIDATION_FAILED',
        errorMessage: error instanceof Error ? error.message : String(error),
        retryable: false,
      };
    }
  }
}
