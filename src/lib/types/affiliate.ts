import type { Bps, Currency, ISODateString, UUID } from './common';

export type CommissionModel = (typeof import('@/lib/db-enums').COMMISSION_MODEL)[number];
export type AffiliateStatus = (typeof import('@/lib/db-enums').AFFILIATE_STATUS)[number];
export type AttributionStatus = (typeof import('@/lib/db-enums').ATTRIBUTION_STATUS)[number];
export type AffiliateLedgerType = (typeof import('@/lib/db-enums').AFFILIATE_LEDGER_TYPE)[number];
export type AffiliateLedgerStatus = (typeof import('@/lib/db-enums').AFFILIATE_LEDGER_STATUS)[number];
export type PayoutStatus = (typeof import('@/lib/db-enums').AFFILIATE_PAYOUT_STATUS)[number];
export type AffiliateWalletAsset = 'USDT_TRC20' | 'TRX' | 'DOGE';
export type CommissionScope = 'GLOBAL' | 'SPORT' | 'GROUP' | 'AFFILIATE' | 'CAMPAIGN';

export interface Affiliate {
  id: UUID; publicId: string; userId: UUID | null; code: string; status: AffiliateStatus;
  displayName: string; email: string | null; phone: string | null;
  parentAffiliateId: UUID | null; depth: number; path: string | null;
  commissionModel: CommissionModel; commissionRateBps: Bps; parentOverrideBps: Bps;
  currency: Currency; minPayoutMinor: bigint; settlementTimezone: string; settlementDay: number; settlementHour: number; settlementMinute: number;
  payableMinor: bigint; carryForwardMinor: bigint; suppressedMinor: bigint;
  lifetimeCommissionMinor: bigint; lifetimePaidMinor: bigint; lifetimeDepositsMinor: bigint;
  tier: string | null; riskScore: number; isFraudFlagged: boolean;
  approvedAt: ISODateString | null; approvedBy: UUID | null;
  createdAt: ISODateString; updatedAt: ISODateString;
}
export interface AffiliateLedgerEntry {
  id: UUID; affiliateId: UUID; currency: Currency; type: AffiliateLedgerType; amountMinor: bigint;
  balanceAfterMinor: bigint; sourceUserId: UUID | null; betId: UUID | null; settlementId: UUID | null;
  payoutId: UUID | null; periodStart: ISODateString | null; periodEnd: ISODateString | null;
  description: string | null; idempotencyKey: string; createdAt: ISODateString;
}
export interface AffiliateCommissionResult {
  affiliateId: UUID; model: CommissionModel; appliedBps: Bps; sourceAmountMinor: bigint;
  commissionMinor: bigint; parentCommissionMinor: bigint; suppressedMinor: bigint;
  payableBeforeMinor: bigint; payableAfterMinor: bigint; floorsApplied: string[];
}
export interface AttributionRecord {
  id: UUID; userId: UUID; affiliateId: UUID; code: string; campaign: string | null; clickId: string | null;
  status: AttributionStatus; rejectionReason: string | null; signals: string[];
  confirmedAt: ISODateString | null; lockedAt: ISODateString | null; createdAt: ISODateString;
}
export interface ReferralClick {
  id: UUID; affiliateId: UUID; code: string; campaign: string | null; landingUrl: string | null;
  ipHash: string | null; userAgentHash: string | null; deviceFingerprint: string | null;
  referer: string | null; isBot: boolean; createdAt: ISODateString;
}
export interface AffiliatePayout {
  id: UUID; publicId: string; affiliateId: UUID; status: PayoutStatus; currency: Currency;
  amountMinor: bigint; payableAtRequestMinor: bigint; method: string | null; destinationMasked: string | null;
  payoutAsset: AffiliateWalletAsset | null; destinationAddress: string | null;
  periodStart: ISODateString | null; periodEnd: ISODateString | null;
  requestedBy: UUID | null; requestedAt: ISODateString | null; approvedBy: UUID | null; approvedAt: ISODateString | null;
  paidBy: UUID | null; paidAt: ISODateString | null; rejectedBy: UUID | null; rejectedAt: ISODateString | null;
  rejectionReason: string | null; providerReference: string | null; evidenceUrl: string | null;
  idempotencyKey: string; createdAt: ISODateString; updatedAt: ISODateString;
}
export interface AffiliateStats {
  affiliateId: UUID; periodStart: ISODateString; periodEnd: ISODateString;
  pendingCount: number; activeCount: number; totalReferredUsers: number;
  clicks: number; registrations: number; firstDeposits: number; withdrawals: number; activeUsers: number;
  totalDepositMinor: bigint;
  totalWithdrawalMinor: bigint; playerNetResultMinor: bigint; panelShareMinor: bigint;
  wageredMinor: bigint; netRevenueMinor: bigint; commissionMinor: bigint; payableMinor: bigint;
  carryForwardMinor: bigint; suppressedMinor: bigint; paidMinor: bigint; currency: Currency;
}
export interface AffiliateHierarchyNode { affiliateId: UUID; code: string; displayName: string; depth: number; children: AffiliateHierarchyNode[] }
export interface FraudSignalResult { affiliateId: UUID; riskScore: number; signals: string[]; blocked: boolean; reviewRequired: boolean }
