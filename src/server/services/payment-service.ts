/**
 * PAYMENT SERVICE.
 *
 * With no provider configured the platform never fabricates a successful deposit:
 * `createDeposit`/`createWithdrawal` throw PAYMENT_PROVIDER_DISABLED, the methods
 * catalogue still renders (marked unavailable), and admin manual review flows through
 * the database functions. Everything is idempotent on the intent's public id.
 */
import type { Services } from './container';
import type { Currency, PaymentIntent, PaymentMethod, UUID } from '@/lib/types';
import { ApiError } from '@/lib/errors';
import { createLogger } from '@/server/logger';
import { serverEnv } from '@/server/env';
import { hashSignal } from '@/server/utils/hash';
import { createPayment, getMinAmount } from '@/server/providers/nowpayments/client';
import { activateVoucher, createVoucher } from '@/server/providers/uwallet/client';
import {
  assertVoucherRateStillCurrent, getUwalletVoucherIrrPerUsd, voucherWithdrawalDebit,
} from '@/server/providers/uwallet/voucher-fx';
import { verifyUwalletVoucherQuote } from '@/server/providers/uwallet/voucher-quote';

const log = createLogger({ component: 'payment-service' });

export class PaymentService {
  constructor(private readonly services: Services) {}

  async methods(direction?: 'deposit' | 'withdrawal', currency?: Currency): Promise<PaymentMethod[]> {
    const env = serverEnv();
    const providerEnabled = env.paymentProviderEnabled;
    let methods: PaymentMethod[] = [];
    try {
      methods = await this.services.payments.listMethods({ direction, currency });
    } catch (error) {
      log.warn('payment methods unavailable', { error: (error as Error).message });
    }
    return methods.map((m) => {
      if (m.provider === 'uwallet' && m.kind === 'voucher') {
        const coin =
          m.id === 'voucher_uvoucher'
            ? env.uwalletUvoucherCoin
            : m.id === 'voucher_hotvoucher'
              ? env.uwalletHotvoucherCoin
              : '';

        if (!env.uwalletToken) {
          return {
            ...m,
            isAvailable: false,
            unavailableReason: 'UWALLET_NOT_CONFIGURED',
          };
        }

        if (!coin) {
          return {
            ...m,
            isAvailable: false,
            unavailableReason: 'UWALLET_COIN_NOT_CONFIGURED',
          };
        }

        return {
          ...m,
          isAvailable: m.isAvailable,
          unavailableReason: m.unavailableReason,
        };
      }

      return {
        ...m,
        isAvailable: m.isAvailable && providerEnabled,
        unavailableReason: providerEnabled ? m.unavailableReason : 'PAYMENT_PROVIDER_DISABLED',
      };
    });
  }

  async createDeposit(input: {
    userId: UUID;
    amountMinor: bigint;
    currency: Currency;
    methodId: string;
    idempotencyKey: string;
    ip: string | null;
    asset?: string;
    network?: string;
    voucherCode?: string;
  }): Promise<PaymentIntent> {
    if (
      input.methodId === 'voucher_uvoucher' ||
      input.methodId === 'voucher_hotvoucher'
    ) {
      return this.createVoucherDeposit(input);
    }

    this.assertProvider('deposits');

    const env = serverEnv();
    const profile = await this.services.users.getProfile(input.userId);
    const targetWalletCurrency = profile?.preferredCurrency ?? input.currency;
    const paymentCurrency: Currency =
      input.methodId === 'crypto_usdt' ? 'USD' : input.currency;

    const intent = await this.services.payments.createIntent({
      userId: input.userId,
      direction: 'deposit',
      amountMinor: input.amountMinor.toString(),
      currency: paymentCurrency,
      methodId: input.methodId,
      idempotencyKey: input.idempotencyKey,
      providerMetadata: {
        payCurrency: input.asset ?? null,
        network: input.network ?? null,
        targetWalletCurrency,
      },
    });

    if (intent.status === 'succeeded' || intent.status === 'pending') {
      return intent;
    }

    if (env.paymentProvider !== 'nowpayments') {
      return intent;
    }

    try {
      const appUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || '';
      if (!appUrl) {
        throw new ApiError('INTERNAL_ERROR', 'Public application URL is not configured');
      }

      const asset = input.asset?.trim().toUpperCase();
      const network = input.network?.trim().toLowerCase() ?? '';
      if (!asset) {
        throw new ApiError('BAD_REQUEST', 'Crypto payment currency is required');
      }

      const networkCurrencyMap: Record<string, Record<string, string>> = {
        USDT: {
          'tron (trc-20)': 'usdttrc20',
          'ethereum (erc-20)': 'usdterc20',
          'bnb smart chain (bep-20)': 'usdtbsc',
          'solana': 'usdtsol',
        },
        USDC: {
          'ethereum (erc-20)': 'usdc',
          'bnb smart chain (bep-20)': 'usdcbsc',
          'solana': 'usdcsol',
        },
        BTC: { 'bitcoin': 'btc' },
        ETH: { 'ethereum (erc-20)': 'eth' },
        TRX: { 'tron (trc-20)': 'trx' },
        XRP: { 'xrp ledger': 'xrp' },
        ADA: { 'cardano': 'ada' },
        DOGE: { 'dogecoin': 'doge' },
        SOL: { 'solana': 'sol' },
        LTC: { 'litecoin': 'ltc' },
        BNB: { 'bnb smart chain (bep-20)': 'bnbbsc' },
      };

      const payCurrency = networkCurrencyMap[asset]?.[network];
      if (!payCurrency) {
        throw new ApiError('BAD_REQUEST', `Unsupported crypto asset or network: ${asset}${network ? ` / ${input.network}` : ''}`);
      }

      const minimum = await getMinAmount({
        currencyFrom: 'usd',
        currencyTo: payCurrency,
        fiatEquivalent: 'usd',
      });
      const minimumUsd = Number(minimum.fiat_equivalent ?? minimum.min_amount);
      if (!Number.isFinite(minimumUsd) || minimumUsd <= 0) {
        throw new ApiError('INTERNAL_ERROR', 'NOWPayments minimum amount unavailable');
      }
      const priceAmount = Number(input.amountMinor) / 100;
      if (!Number.isFinite(priceAmount) || priceAmount <= 0) {
        throw new ApiError('BAD_REQUEST', 'Invalid payment amount');
      }
      if (priceAmount < minimumUsd) {
        throw new ApiError(
          'BAD_REQUEST',
          `Minimum crypto deposit is $${minimumUsd.toFixed(2)} for ${payCurrency}`,
        );
      }

      const payment = await createPayment({
        priceAmount: priceAmount,
        priceCurrency: 'usd',
        payCurrency: payCurrency,
        ipnCallbackUrl: `${appUrl.replace(/\/$/, '')}/api/v1/payments/nowpayments/ipn`,
        orderId: intent.publicId,
        orderDescription: `NOVA deposit ${intent.publicId}`,
      });

      const updated = await this.services.payments.completeIntent({
        publicId: intent.publicId,
        status: 'pending',
        providerReference: String(payment.payment_id ?? ''),
        raw: payment as unknown as Record<string, unknown>,
      });

      return updated.intent;
    } catch (error) {
      log.error('NOWPayments deposit creation failed', {
        publicId: intent.publicId,
        error: error instanceof Error ? error.message : String(error),
      });

      await this.services.payments.completeIntent({
        publicId: intent.publicId,
        status: 'failed',
        failureCode: 'PROVIDER_CREATE_FAILED',
        failureMessage: error instanceof Error ? error.message : 'Provider payment creation failed',
      });

      throw error;
    }
  }

  async createWithdrawal(input: { userId: UUID; amountMinor: bigint; currency: Currency; methodId: string; destination: string; idempotencyKey: string; ip: string | null;
providerMetadata?: Record<string, unknown> | null;
voucherQuote?: { rateIrrPerUsd: string; quotedAt: string; requestedWalletAmountMinor: string; signature: string } }): Promise<PaymentIntent> {
    if (
      input.methodId === 'voucher_uvoucher' ||
      input.methodId === 'voucher_hotvoucher'
    ) {
      return this.createVoucherWithdrawal(input);
    }
    this.assertProvider('withdrawals');
    const intent = await this.services.payments.createIntent({
      userId: input.userId,
      direction: 'withdrawal',
      amountMinor: input.amountMinor.toString(),
      currency: input.currency,
      methodId: input.methodId,
      idempotencyKey: input.idempotencyKey,
      destination: { account: input.destination },
      providerMetadata: input.providerMetadata ?? null,
    });

    if (['succeeded', 'failed', 'cancelled', 'refunded',
'reversed'].includes(intent.status)) {
      return intent;
    }

    // Crypto withdrawals are automatically approved after the server-side
    // balance hold succeeds. The existing reviewWithdrawal() path is reused
    // so the audited state transition and idempotent payout job remain intact.
    if (intent.status === 'initiated') {
      return this.services.payments.reviewWithdrawal({
        publicId: intent.publicId,
        decision: 'approve',
        actorId: input.userId,
        reason: 'Automatic crypto withdrawal approval',
      });
    }

    // Existing non-terminal intents are returned unchanged. In particular,
    // retries must not create a second payout job or duplicate a provider payout.
    return intent;
  }
  private async createVoucherWithdrawal(input: {
    userId: UUID;
    amountMinor: bigint;
    currency: Currency;
    methodId: string;
    destination: string;
    idempotencyKey: string;
    ip: string | null;
    providerMetadata?: Record<string, unknown> | null;
    voucherQuote?: { rateIrrPerUsd: string; quotedAt: string; requestedWalletAmountMinor: string; signature: string };
  }): Promise<PaymentIntent> {
    const env = serverEnv();

    if (input.currency !== 'USD') {
      throw new ApiError('BAD_REQUEST', 'Voucher withdrawals must use USD');
    }

    if (!env.uwalletToken) {
      throw new ApiError('PAYMENT_PROVIDER_DISABLED', 'uWallet is not configured');
    }

    if (!this.services.providers.email.configured) {
      throw new ApiError(
        'PAYMENT_PROVIDER_DISABLED',
        'Voucher email provider is not configured',
      );
    }

    // Vouchers are bearer instruments: never issue one while delivery is
    // offline. Enqueueing an email is not proof it can actually be sent.
    const delivery = await this.services.db.queryOne<{ ready: boolean }>(
      `select exists (
         select 1 from nova.worker_heartbeats
          where worker = 'notification'
            and last_seen_at >= now() - interval '75 seconds'
       ) as ready`,
    );
    if (!delivery?.ready) {
      throw new ApiError(
        'PAYMENT_PROVIDER_DISABLED',
        'Voucher email delivery is currently unavailable; no voucher was issued',
      );
    }

    const coin =
      input.methodId === 'voucher_uvoucher'
        ? env.uwalletUvoucherCoin
        : input.methodId === 'voucher_hotvoucher'
          ? env.uwalletHotvoucherCoin
          : '';

    if (!coin) {
      throw new ApiError('BAD_REQUEST', 'Voucher currency is not configured');
    }

    const email = input.destination.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      throw new ApiError('BAD_REQUEST', 'Voucher email is required');
    }

    if (input.amountMinor <= 0n) {
      throw new ApiError('BAD_REQUEST', 'Invalid voucher withdrawal amount');
    }

    const profile = await this.services.users.getProfile(input.userId);
    const targetWalletCurrency = profile?.preferredCurrency ?? 'IRT';
    let voucherFx: Record<string, unknown> | null = null;
    let lockedRate: string | null = null;

    if (targetWalletCurrency === 'IRT' || targetWalletCurrency === 'IRR') {
      const quote = input.voucherQuote;
      const quotedAt = Date.parse(quote?.quotedAt ?? '');
      if (!quote || !Number.isFinite(quotedAt) ||
          quotedAt > Date.now() + 5_000 || Date.now() - quotedAt > 60_000 ||
          !/^\d{1,19}$/.test(quote.requestedWalletAmountMinor)) {
        throw new ApiError('BAD_REQUEST', 'Refresh the uWallet voucher rate before withdrawal');
      }
      verifyUwalletVoucherQuote(input.userId, quote.rateIrrPerUsd, quote.quotedAt, quote.signature);
      const currentRate = await getUwalletVoucherIrrPerUsd();
      assertVoucherRateStillCurrent(quote.rateIrrPerUsd, currentRate);
      const requestedWalletAmountMinor = BigInt(quote.requestedWalletAmountMinor);
      const computed = voucherWithdrawalDebit(
        requestedWalletAmountMinor, targetWalletCurrency, quote.rateIrrPerUsd,
      );
      if (computed.usdMinor !== input.amountMinor || computed.walletMinor <= 0n) {
        throw new ApiError('BAD_REQUEST', 'uWallet voucher quote does not match requested amount');
      }
      lockedRate = quote.rateIrrPerUsd;
      voucherFx = {
        source: 'uwallet', quoteType: 'UUSD_TO_HOTVOUCHER_REFERENCE',
        rateIrrPerUsd: lockedRate, quotedAt: quote.quotedAt,
        walletCurrency: targetWalletCurrency,
        walletDebitMinor: computed.walletMinor.toString(),
        requestedWalletAmountMinor: requestedWalletAmountMinor.toString(),
        usdMinor: computed.usdMinor.toString(),
      };
    }

    const usdAmount = this.minorToDecimal(input.amountMinor);
    let amount = usdAmount;
    let voucherProviderAmount: string | null = null;
    let voucherProviderRate: string | null = null;

    if (input.methodId === 'voucher_hotvoucher') {
      const rate = lockedRate ?? await getUwalletVoucherIrrPerUsd();
      const hotVoucherUnits = this.usdMinorToHotVoucher(input.amountMinor, rate);

      if (hotVoucherUnits <= 0n) {
        throw new ApiError('BAD_REQUEST', 'HotVoucher withdrawal amount is invalid');
      }

      amount = hotVoucherUnits.toString();
      voucherProviderAmount = amount;
      voucherProviderRate = rate;
    }

    if (input.amountMinor < 150n) {
      throw new ApiError('BAD_REQUEST', 'Minimum voucher withdrawal is $1.50');
    }

    if (targetWalletCurrency !== 'IRT' && targetWalletCurrency !== 'IRR' && !(targetWalletCurrency === 'USD' && (input.methodId === 'voucher_uvoucher' || input.methodId === 'voucher_hotvoucher'))) {
      throw new ApiError(
        'BAD_REQUEST',
        `Voucher withdrawals require an IRT or IRR wallet (got ${targetWalletCurrency})`,
      );
    }

    const intent = await this.services.payments.createIntent({
      userId: input.userId,
      direction: 'withdrawal',
      amountMinor: input.amountMinor.toString(),
      currency: 'USD',
      methodId: input.methodId,
      idempotencyKey: input.idempotencyKey,
      destination: { account: email },
      providerMetadata: {
        ...(input.providerMetadata ?? {}),
        voucherCoin: coin,
        targetWalletCurrency,
        ...(voucherFx ? { voucherFx } : {}),
        ...(voucherProviderAmount
          ? {
              voucherProviderAmount,
              voucherProviderRate,
              voucherProviderUnit: 'HotVoucher',
              voucherSettlementCurrency: 'USD',
            }
          : {}),
      },
    });

    if (['succeeded', 'failed', 'cancelled', 'refunded', 'reversed'].includes(intent.status)) {
      return intent;
    }

    const dedupeKey = `uvoucher-withdrawal-email:${intent.publicId}`;
    const notificationDedupeKey = `${dedupeKey}:email`;

    const existingNotification =
      await this.services.notifications.findByDedupeKey(notificationDedupeKey);

    const existingTransactionId = String(
      existingNotification?.data?.transactionId ?? '',
    ).trim();

    if (existingTransactionId) {
      const updated = await this.services.payments.completeIntent({
        publicId: intent.publicId,
        status: 'succeeded',
        providerReference: existingTransactionId,
        raw: {
          uWalletTransactionId: existingTransactionId,
        },
      });
      return updated.intent;
    }

    // One irreversible provider create per idempotency key. A concurrent
    // retry must NOT mint a second bearer voucher when the first is in flight.
    if (intent.status !== 'initiated') return intent;
    const claimed = await this.services.db.queryOne<{ id: string }>(
      `update nova.payment_transactions
          set status = 'pending', updated_at = now()
        where id = $1 and status = 'initiated'
        returning id`,
      [intent.id],
    );
    if (!claimed) return intent;

    let voucherCreated = false;
    let transactionId = '';

    try {
      const result = await createVoucher({
        coin,
        amount,
      });

      transactionId = String(result.transactionId ?? '').trim();
      const code = String(result.code ?? '').trim();
      voucherCreated = Boolean(transactionId || code);

      if (!transactionId || !code) {
        throw new ApiError(
          'INTERNAL_ERROR',
          'uWallet did not return a voucher transaction and code',
        );
      }

      const queued = await this.services.notifications.enqueue({
        userId: input.userId,
        eventKey: 'wallet.withdrawal_paid',
        channels: ['email'],
        title: 'Your uVoucher withdrawal voucher',
        body: [
          'Your uVoucher withdrawal has been created.',
          '',
          `Amount: $${usdAmount}`,
          `Voucher code: ${code}`,
          '',
          'Use this voucher code to redeem your uVoucher.',
        ].join('\n'),
        data: {
          voucherCoin: coin,
          transactionId,
          amount: usdAmount,
          providerAmount: voucherProviderAmount ?? amount,
          providerRate: voucherProviderRate,
          destinationEmail: email,
        },
        locale: 'en',
        dedupeKey,
      });

      let providerReference = transactionId;

      if (!queued.queued) {
        const concurrent =
          await this.services.notifications.findByDedupeKey(notificationDedupeKey);

        const recovered = String(
          concurrent?.data?.transactionId ?? '',
        ).trim();

        if (!recovered) {
          throw new ApiError(
            'INTERNAL_ERROR',
            'Voucher email could not be queued',
          );
        }

        providerReference = recovered;
      }

      const updated = await this.services.payments.completeIntent({
        publicId: intent.publicId,
        status: 'succeeded',
        providerReference,
        raw: {
          uWalletTransactionId: providerReference,
        },
      });

      return updated.intent;
    } catch (error) {
      /*
       * Before a voucher exists, failure releases the withdrawal hold.
       * After uWallet has created a voucher, never mark the intent failed:
       * doing so would release the user's funds while the voucher could
       * still exist. The intent remains held until the email can be queued
       * or the same idempotent request is retried.
       */
      // Only a definitive provider rejection can release the reserved funds.
      // A transport timeout or 5xx response may mean the voucher was issued.
      const definiteRejection = error instanceof Error &&
        /^uWallet request failed \((?:400|401|403|404|422)\)/.test(error.message);
      if (!voucherCreated && (error instanceof ApiError || definiteRejection)) {
        await this.services.payments.completeIntent({
          publicId: intent.publicId,
          status: 'failed',
          failureCode: error instanceof ApiError ? error.code : 'UWALLET_REJECTED',
          failureMessage: error instanceof ApiError ? error.message : 'Voucher provider rejected issuance',
          raw: { error: error instanceof ApiError ? error.code : 'UWALLET_REJECTED' },
        }).catch(() => undefined);
      } else {
        // Remote timeouts are ambiguous: issuing might already have succeeded.
        // Keep the funds held for reconciliation, NEVER release them and
        // allow a second voucher to be issued on an idempotent retry.
        log.error('uVoucher withdrawal requires delivery/provider reconciliation', {
          publicId: intent.publicId,
          transactionId,
          errorCode: error instanceof ApiError ? error.code : 'REMOTE_DELIVERY_UNCERTAIN',
        });
      }

      throw error;
    }
  }

  /**
   * Provider webhooks. Signature verification happens in the provider adapter; when no
   * adapter exists the receipt is recorded as unprocessable instead of being trusted.
   */
  async handleWebhook(input: { provider: string; rawBody: string; headers: Record<string, string>; ip: string | null }) {
    const env = serverEnv();
    const receipt = await this.services.payments.recordWebhook({
      provider: input.provider, eventId: signEventId(input.rawBody, input.headers), eventType: input.headers['x-event-type'] ?? 'unknown',
      signatureValid: false, payload: safeJson(input.rawBody), raw: input.rawBody.slice(0, 20_000), ip: input.ip ? hashSignal(input.ip) : null,
    });
    if (receipt.isDuplicate) return { status: 'duplicate' as const, receiptId: receipt.receiptId };
    if (!env.paymentProviderEnabled) {
      throw new ApiError('PAYMENT_PROVIDER_DISABLED', 'No payment provider is configured; the webhook was recorded but not applied');
    }
    return { status: receipt.processed ? 'processed' as const : 'recorded' as const, receiptId: receipt.receiptId };
  }

  private async createVoucherDeposit(input: {
    userId: UUID;
    amountMinor: bigint;
    currency: Currency;
    methodId: string;
    idempotencyKey: string;
    ip: string | null;
    asset?: string;
    network?: string;
    voucherCode?: string;
  }): Promise<PaymentIntent> {
    const env = serverEnv();

    if (input.currency !== 'USD') {
      throw new ApiError('BAD_REQUEST', 'Voucher deposits must use USD');
    }

    const code = input.voucherCode?.trim();
    if (!code) {
      throw new ApiError('BAD_REQUEST', 'Voucher code is required');
    }

    const coin =
      input.methodId === 'voucher_uvoucher'
        ? env.uwalletUvoucherCoin
        : input.methodId === 'voucher_hotvoucher'
          ? env.uwalletHotvoucherCoin
          : '';

    if (!env.uwalletToken) {
      throw new ApiError('PAYMENT_PROVIDER_DISABLED', 'uWallet is not configured');
    }

    if (!coin) {
      throw new ApiError('BAD_REQUEST', 'Voucher currency is not configured');
    }

    const profile = await this.services.users.getProfile(input.userId);
    const targetWalletCurrency = profile?.preferredCurrency ?? input.currency;
    // Pin the provider FX rate before irreversible voucher redemption.
    const voucherFx =
      targetWalletCurrency === 'IRT' || targetWalletCurrency === 'IRR'
        ? { source: 'uwallet', quoteType: 'UUSD_TO_HOTVOUCHER_REFERENCE',
            rateIrrPerUsd: await getUwalletVoucherIrrPerUsd(),
            quotedAt: new Date().toISOString() }
        : null;

    const intent = await this.services.payments.createIntent({
      userId: input.userId,
      direction: 'deposit',
      amountMinor: input.amountMinor.toString(),
      currency: 'USD',
      methodId: input.methodId,
      idempotencyKey: input.idempotencyKey,
      providerMetadata: {
        voucherCoin: coin,
        targetWalletCurrency,
        ...(voucherFx ? { voucherFx } : {}),
      },
    });

    if (intent.status === 'succeeded' || intent.status === 'pending') {
      // A pending payment with providerReference is reconciled by the worker.
      // A pending payment without one needs operator review, not code reuse.
      return intent;
    }

    let providerAccepted = false;
    try {
      const activation = await activateVoucher({
        coin,
        code,
      });
      providerAccepted = true;

      const status = String(activation.status ?? '').trim().toLowerCase();
      const transactionId = String(activation.transactionId ?? '').trim();

      if (!transactionId) {
        throw new ApiError('BAD_REQUEST', 'uWallet did not return a transaction ID');
      }

      // The voucher has been consumed at the provider. Persist its reference
      // BEFORE any conversion/ledger work, so errors never mark it "failed"
      // and risk a second redemption.
      await this.services.payments.completeIntent({
        publicId: intent.publicId,
        status: 'pending',
        providerReference: transactionId,
        raw: activation as unknown as Record<string, unknown>,
      });

      if (['confirm', 'confirmed', 'success', 'succeeded', 'completed'].includes(status)) {
        let settledAmountMinor: bigint;
        let voucherSettlement: Record<string, unknown> = {
          voucherCoin: coin,
          providerReceive: activation.receive ?? null,
        };

        if (input.methodId === 'voucher_hotvoucher') {
          const receiveUnits = this.providerInteger(
            activation.receive,
            'HotVoucher receive',
          );
          const rate = voucherFx?.rateIrrPerUsd ?? await this.getHotVoucherUnitsPerUsd();
          settledAmountMinor = this.hotVoucherToUsdMinor(
            receiveUnits,
            rate,
          );

          if (settledAmountMinor <= 0n) {
            throw new ApiError(
              'BAD_REQUEST',
              'HotVoucher amount is below the minimum USD value',
            );
          }

          voucherSettlement = {
            ...voucherSettlement,
            providerRate: rate,
            providerReceiveUnits: receiveUnits.toString(),
            settledUsdMinor: settledAmountMinor.toString(),
            conversion: 'HotVoucher -> USD',
          };
        } else {
          const receiveMinor = this.decimalToMinor(activation.receive);
          settledAmountMinor = receiveMinor;

          if (settledAmountMinor <= 0n) {
            throw new ApiError(
              'BAD_REQUEST',
              'U-Voucher amount is invalid',
            );
          }

          voucherSettlement = {
            ...voucherSettlement,
            providerReceiveUnits: receiveMinor.toString(),
            settledUsdMinor: receiveMinor.toString(),
            conversion: 'UUSD -> USD',
          };
        }

        await this.services.payments.updateIntentAmount({
          publicId: intent.publicId,
          amountMinor: settledAmountMinor.toString(),
          providerMetadata: voucherSettlement,
        });

        const updated = await this.services.paymentsService.settleVoucherTransaction({
          publicId: intent.publicId,
          providerReference: transactionId,
          transaction: {
            ...(activation as unknown as Record<string, unknown>),
            status: activation.status,
            receive: activation.receive,
            coin,
          },
        });
        return updated;
      }

      if (['reject', 'rejected', 'failed', 'failure', 'cancelled', 'canceled'].includes(status)) {
        const updated = await this.services.payments.completeIntent({
          publicId: intent.publicId,
          status: 'failed',
          providerReference: transactionId,
          raw: activation as unknown as Record<string, unknown>,
        });

        return updated.intent;
      }

      const updated = await this.services.payments.completeIntent({
        publicId: intent.publicId,
        status: 'pending',
        providerReference: transactionId,
        raw: activation as unknown as Record<string, unknown>,
      });

      return updated.intent;
    } catch (error) {
      // A provider request may have succeeded despite a network timeout.
      // Once a transaction reference is known, leave the payment pending for
      // reconciliation instead of incorrectly failing a redeemed voucher.
      const persisted = await this.services.payments.getIntent({ publicId: intent.publicId });
      const rejected = error instanceof Error &&
        /^uWallet request failed \((?:400|401|403|404|422)\)/.test(error.message);
      if (!persisted?.providerReference && !providerAccepted && rejected) {
        await this.services.payments.completeIntent({
          publicId: intent.publicId,
          status: 'failed',
          raw: { error: 'UWALLET_REJECTED' },
        }).catch(() => undefined);
      } else if (!persisted?.providerReference && providerAccepted) {
        // The provider may already have consumed a bearer code without a
        // usable transaction reference. Do not mark it failed or allow an
        // idempotent retry to attempt a second redemption automatically.
        await this.services.payments.completeIntent({
          publicId: intent.publicId,
          status: 'pending',
          raw: { reconciliation: 'provider_accepted_without_reference' },
        }).catch(() => undefined);
      }

      throw error;
    }
  }

  async settleVoucherTransaction(input: {
    publicId: string;
    transaction: {
      status?: string;
      receive?: number | string;
      amount?: number | string;
      coin?: string;
      [key: string]: unknown;
    };
    providerReference?: string;
  }): Promise<PaymentIntent> {
    const intent = await this.services.payments.getIntent({
      publicId: input.publicId,
    });
    if (!intent) {
      throw new ApiError('PAYMENT_INTENT_NOT_FOUND');
    }

    if (
      intent.methodId !== 'voucher_uvoucher' &&
      intent.methodId !== 'voucher_hotvoucher'
    ) {
      throw new ApiError('BAD_REQUEST', 'Payment intent is not a voucher payment');
    }

    const status = String(input.transaction.status ?? '').trim().toLowerCase();

    if (
      status === 'reject' ||
      status === 'rejected' ||
      status === 'failed'
    ) {
      const updated = await this.services.payments.completeIntent({
        publicId: intent.publicId,
        status: 'failed',
        providerReference: input.providerReference ?? intent.providerReference,
        raw: input.transaction as Record<string, unknown>,
      });
      return updated.intent;
    }

    if (
      status !== 'confirm' &&
      status !== 'confirmed' &&
      status !== 'success' &&
      status !== 'succeeded' &&
      status !== 'completed'
    ) {
      const updated = await this.services.payments.completeIntent({
        publicId: intent.publicId,
        status: 'pending',
        providerReference: input.providerReference ?? intent.providerReference,
        raw: input.transaction as Record<string, unknown>,
      });
      return updated.intent;
    }

    const metadata =
      intent.providerMetadata &&
      typeof intent.providerMetadata === 'object'
        ? intent.providerMetadata
        : {};
    const needsFiatVoucherFx =
      metadata.targetWalletCurrency === 'IRT' || metadata.targetWalletCurrency === 'IRR';
    const voucherFx =
      needsFiatVoucherFx && !(metadata.voucherFx && typeof metadata.voucherFx === 'object')
        ? { source: 'uwallet', quoteType: 'UUSD_TO_HOTVOUCHER_REFERENCE',
            rateIrrPerUsd: await getUwalletVoucherIrrPerUsd(),
            quotedAt: new Date().toISOString() }
        : null;

    if (intent.methodId === 'voucher_hotvoucher') {
      const receiveUnits = this.providerInteger(
        input.transaction.receive,
        'HotVoucher receive',
      );
      const storedRate =
        typeof metadata.providerRate === 'string'
          ? metadata.providerRate
          : null;
      const snapshotRate = typeof (metadata.voucherFx as Record<string, unknown> | undefined)?.rateIrrPerUsd === 'string'
        ? (metadata.voucherFx as { rateIrrPerUsd: string }).rateIrrPerUsd
        : null;
      const rate = storedRate ?? snapshotRate ?? await this.getHotVoucherUnitsPerUsd();
      const settledAmountMinor = this.hotVoucherToUsdMinor(
        receiveUnits,
        rate,
      );

      if (settledAmountMinor <= 0n) {
        throw new ApiError(
          'BAD_REQUEST',
          'HotVoucher amount is below the minimum USD value',
        );
      }

      await this.services.payments.updateIntentAmount({
        publicId: intent.publicId,
        amountMinor: settledAmountMinor.toString(),
        providerMetadata: {
          ...metadata,
          ...(voucherFx ? { voucherFx } : {}),
          voucherCoin:
            input.transaction.coin ??
            metadata.voucherCoin ??
            serverEnv().uwalletHotvoucherCoin,
          providerReceive:
            input.transaction.receive ?? null,
          providerReceiveUnits: receiveUnits.toString(),
          providerRate: rate,
          settledUsdMinor: settledAmountMinor.toString(),
          conversion: 'HotVoucher -> USD',
        },
      });
    } else {
      const receiveMinor = this.decimalToMinor(input.transaction.receive);

      await this.services.payments.updateIntentAmount({
        publicId: intent.publicId,
        amountMinor: receiveMinor.toString(),
        providerMetadata: {
          ...metadata,
          ...(voucherFx ? { voucherFx } : {}),
          voucherCoin:
            input.transaction.coin ??
            metadata.voucherCoin ??
            serverEnv().uwalletUvoucherCoin,
          providerReceive:
            input.transaction.receive ?? null,
          providerReceiveUnits: receiveMinor.toString(),
          settledUsdMinor: receiveMinor.toString(),
          conversion: 'UUSD -> USD',
        },
      });
    }
    const updated = await this.services.payments.completeIntent({
      publicId: intent.publicId,
      status: 'succeeded',
      providerReference: input.providerReference ?? intent.providerReference,
      raw: input.transaction as Record<string, unknown>,
    });

    return updated.intent;
  }

  private providerInteger(value: number | string | undefined, label: string): bigint {
    const text = typeof value === 'string' ? value.trim() : String(value ?? '');
    // Never round HotVoucher units. Provider values must be exact integers.
    if (!/^[1-9]\d*$/.test(text)) {
      throw new ApiError('BAD_REQUEST', `${label} is invalid`);
    }
    return BigInt(text);
  }

  private async getHotVoucherUnitsPerUsd(): Promise<string> {
    return getUwalletVoucherIrrPerUsd();
  }

  private hotVoucherToUsdMinor(units: bigint, rate: string): bigint {
    const [wholeRaw = '0', fraction = ''] = rate.split('.');
    const whole = wholeRaw || '0';
    const rateScaled =
      BigInt(whole) * 100000000n +
      BigInt(fraction.padEnd(8, '0').slice(0, 8));

    if (rateScaled <= 0n) {
      throw new ApiError('BAD_REQUEST', 'Invalid HotVoucher rate');
    }

    return (units * 100n * 100000000n + rateScaled / 2n) / rateScaled;
  }

  private usdMinorToHotVoucher(unitsMinor: bigint, rate: string): bigint {
    const [wholeRaw = '0', fraction = ''] = rate.split('.');
    const whole = wholeRaw || '0';
    const rateScaled =
      BigInt(whole) * 100000000n +
      BigInt(fraction.padEnd(8, '0').slice(0, 8));

    if (rateScaled <= 0n) {
      throw new ApiError('BAD_REQUEST', 'Invalid HotVoucher rate');
    }

    return (unitsMinor * rateScaled + 5000000000n) / 10000000000n;
  }

  private minorToDecimal(value: bigint): string {
    const whole = value / 100n;
    const fraction = (value % 100n).toString().padStart(2, '0');
    return `${whole.toString()}.${fraction}`;
  }
  private decimalToMinor(value: number | string | undefined): bigint {
    // uWallet may serialize decimals as JSON numbers or strings. Avoid
    // floating-point conversion for provider-supplied decimal strings.
    const raw = typeof value === 'number' && Number.isFinite(value)
      ? value.toFixed(2)
      : typeof value === 'string' ? value.trim() : '';
    if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) {
      throw new ApiError('BAD_REQUEST', 'uWallet returned an invalid voucher amount');
    }
    const [whole, fraction = ''] = raw.split('.');
    return BigInt(whole!) * 100n + BigInt(fraction.padEnd(2, '0'));
  }

  private assertProvider(kind: 'deposits' | 'withdrawals'): void {
    const env = serverEnv();
    if (!env.paymentProviderEnabled) {
      throw new ApiError('PAYMENT_PROVIDER_DISABLED', `No payment provider is configured: ${kind} are disabled. Configure PAYMENT_PROVIDER + PAYMENT_PROVIDER_API_KEY to enable them.`);
    }
  }
}

function safeJson(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : { value: parsed };
  } catch {
    return { unparsed: raw.slice(0, 2000) };
  }
}

const signEventId = (raw: string, headers: Record<string, string>): string =>
  headers['x-event-id'] ?? headers['x-request-id'] ?? hashSignal(raw).slice(0, 32);
