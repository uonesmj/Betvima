import type { Currency, ISODateString, UUID } from './common';

export type BonusStatus = 'active' | 'locked' | 'won' | 'lost' | 'expired' | 'cancelled';

export interface BonusGrant {
  id: UUID;
  userId: UUID;
  promotionId: UUID | null;
  promotionKey: string | null;
  title: string;
  description: string | null;
  currency: Currency;
  amountMinor: bigint;
  remainingAmountMinor: bigint;
  status: BonusStatus;
  grantedAt: ISODateString;
  expiresAt: ISODateString;
  lockedAt: ISODateString | null;
  usedAt: ISODateString | null;
  betId: UUID | null;
  depositPaymentTransactionId: UUID;
}

export interface BonusSummary {
  total: number;
  active: number;
  locked: number;
  won: number;
  lost: number;
  expired: number;
  cancelled: number;
  activeAmountMinor: bigint;
  lockedAmountMinor: bigint;
}

export interface BonusPromotionSummary {
  id: UUID;
  code: string;
  type: string;
  title: string;
  description: string | null;
  percentageBps: number;
  minDepositMinor: bigint | null;
  maxBonusMinor: bigint | null;
  isActive: boolean;
}

export interface BonusListResult {
  items: BonusGrant[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  summary: BonusSummary;
  promotion: BonusPromotionSummary | null;
}
