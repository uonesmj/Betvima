import type { Currency, ISODateString, UUID } from './common';

export type PaymentDirection = 'deposit' | 'withdrawal';
export type PaymentStatus = (typeof import('@/lib/db-enums').PAYMENT_TX_STATUS)[number];
export type PaymentMethodKind = 'card' | 'bank_transfer' | 'wallet' | 'crypto' | 'cash' | 'voucher';
export interface PaymentMethod {
  id: string; provider: string; kind: PaymentMethodKind; direction: PaymentDirection;
  nameEn: string; nameFa: string; icon: string | null;
  minAmountMinor: bigint; maxAmountMinor: bigint; currencies: Currency[];
  feeBps: number; fixedFeeMinor: bigint; estimatedSeconds: number | null;
  isAvailable: boolean; unavailableReason?: string;
}
export interface PaymentIntent {
  id: UUID; publicId: string; userId: UUID; direction: PaymentDirection; status: PaymentStatus;
  currency: Currency; amountMinor: bigint; feeMinor: bigint; netAmountMinor: bigint;
  provider: string; methodId: string | null; providerReference: string | null;
  redirectUrl: string | null;
  providerMetadata?: Record<string, unknown> | null; failureCode: string | null; failureMessage: string | null;
  expiresAt: ISODateString | null; createdAt: ISODateString; completedAt: ISODateString | null;
  reviewReason: string | null; idempotencyKey: string;
}
export interface PaymentWebhookEvent {
  provider: string; eventId: string; eventType: string; signature: string; timestamp: number;
  payload: Record<string, unknown>; raw: string;
}
export interface DepositLimitsCheck { allowed: boolean; reasonCode?: string; dailyRemainingMinor: bigint; weeklyRemainingMinor: bigint }
