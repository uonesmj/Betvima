# Payments

## Adapter architecture

```ts
interface PaymentProviderAdapter {          // src/lib/ports/providers.ts
  readonly name: string;
  readonly configured: boolean;
  health(): Promise<ProviderStatus>;
  listMethods(input): Promise<ProviderResult<PaymentMethod[]>>;
  createDeposit(input): Promise<ProviderResult<ProviderPaymentIntent>>;
  createWithdrawal(input): Promise<ProviderResult<ProviderPaymentIntent>>;
  verifyAndParseWebhook(input): Promise<ProviderResult<WebhookEvent>>;
  refund(input): Promise<ProviderResult<RefundResult>>;
  payoutStatus(providerReference): Promise<ProviderResult<{ status: string }>>;
}
```

Two implementations ship today:

* `NullPaymentsProvider` (`src/providers/null-providers.ts`) — every call returns
  `{ ok: false, errorCode: 'NOT_CONFIGURED' }`. This is what runs when `PAYMENT_PROVIDER=disabled`.
* `PAYMENT_PROVIDER=http` (+ `PAYMENT_PROVIDER_BASE_URL`, `PAYMENT_PROVIDER_MERCHANT_ID`,
  `PAYMENT_PROVIDER_API_KEY`, `PAYMENT_WEBHOOK_SECRET`) selects the HTTP adapter shape; the
  concrete vendor mapping is the only code that must be written to go live
  (see [EXTERNAL_PROVIDERS.md](EXTERNAL_PROVIDERS.md)).

Because the registry reports `configured: false`, the platform refuses money movement instead of
pretending it happened:

* `POST /api/v1/wallet/deposit` → `503 PROVIDER_NOT_CONFIGURED`
* `POST /api/v1/wallet/withdraw` → `503 PROVIDER_NOT_CONFIGURED`
* `GET /api/v1/payments/methods` → methods are listed with `available: false` and a reason

## Deposit flow (when a provider is configured)

```
POST /api/v1/wallet/deposit
  → risk + limit checks (daily deposit limit, restrictions, KYC where required)
  → nova.payment_transactions row (status initiated, unique idempotency key)
  → provider.createDeposit(...)  → redirect url / requires_action
  → customer completes payment at the provider
  → POST /api/v1/webhooks/[provider]   (signature verified, tolerance window enforced)
      → nova.webhook_receipts (duplicate detection by event id)
      → completeIntent(status) → credit_wallet('deposit') through post_wallet_entry
  → balance visible to the customer, entry in the statement
```

The deposit is only credited on a **verified** provider event. An unverified or replayed webhook is
recorded and rejected; `webhook_receipts.processed` makes retries idempotent.

## Withdrawal flow

```
POST /api/v1/wallet/withdraw
  → KYC/limits/velocity checks, operation switch WITHDRAWALS must be on
  → intent created (pending) + funds HELD (withdrawal_hold) — balance cannot be spent twice
  → operator review in /admin/payments (approve | reject; reject releases the hold)
  → provider.createWithdrawal(...) → provider_reference stored
  → completion (webhook or operator "mark paid") → withdrawal, hold released
  → failure → automatic hold release + failure reason recorded, customer notified
```

Held funds are visible as `heldMinor` in `/api/v1/wallet`, so a customer can never withdraw a
balance that is already committed to a pending payout.

## Refunds

`POST /api/v1/admin/payments/[id]/refund` requires `payments.refund`, calls
`provider.refund(...)`, then reverses the wallet credit with a `reversal` entry linked to the
original (`reversal_of`). Refunds are idempotent and refuse to refund more than was captured; a
refund of an already-refunded intent returns `PAYMENT_ALREADY_REFUNDED`.

## Webhooks

* Verified with the provider secret and a timestamp tolerance
  (`PAYMENT_WEBHOOK_TOLERANCE_SECONDS`, default 300 s).
* Unknown providers return an error envelope; nothing is stored unverified.
* Receipts are kept in `nova.webhook_receipts` with `signature_valid`, `processed`, `received_at`,
  `processed_at` and the raw payload, so a disputed event can be replayed by an operator.
* Failures are counted in the dashboard metric `risk.failedWebhooks24h`.

## What is deliberately absent

No card storage, no PAN/CVV ever touches the platform (redirect/PSP-hosted flows only), no
"simulated success" path anywhere in the codebase. `grep -R "SIMULATED\|fake.*success" src` returns
nothing, and `scripts/scan-service-role-exposure.sh` plus the preflight script fail the build if
such a path is introduced.
