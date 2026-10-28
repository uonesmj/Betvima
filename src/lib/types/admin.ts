import type { AdminPermission, UserRole } from './auth';
import type { Currency, ISODateString, UUID } from './common';

export interface AuditLogEntry {
  id: UUID; actorId: UUID | null; actorEmail: string | null; actorRole: UserRole | null;
  action: string; entityType: string; entityId: string | null;
  before: Record<string, unknown> | null; after: Record<string, unknown> | null;
  reason: string | null; ipHash: string | null; userAgentHash: string | null;
  correlationId: string | null; createdAt: ISODateString;
}
export interface AdminUserSummary {
  id: UUID; publicId: string; email: string | null; phone: string | null; username: string | null;
  status: string; role: UserRole; kycStatus: string; balanceSummary: { currency: Currency; balanceMinor: bigint }[];
  /** Admin reporting projection: aggregated account balance expressed in USD cents. */
  usdBalanceMinor: bigint | null;
  /** Null signals that at least one non-USD, nonzero amount has no verified quote. */
  totalStakeMinor: bigint | null; totalPayoutMinor: bigint | null; netResultMinor: bigint | null; openBets: number;
  affiliateId: UUID | null; riskScore: number | null; registeredAt: ISODateString; lastLoginAt: ISODateString | null;
}
export interface AdminRole { key: UserRole; label: string; permissions: AdminPermission[]; isSystem: boolean; userCount: number }
export interface RiskRule {
  id: UUID; key: string; scope: 'GLOBAL' | 'SPORT' | 'LEAGUE' | 'USER' | 'AFFILIATE'; scopeRef: string | null;
  isEnabled: boolean; thresholdMinor: bigint | null; thresholdCount: number | null; thresholdBps: number | null;
  action: 'WARN' | 'LIMIT' | 'REVIEW' | 'REJECT'; priority: number; params: Record<string, unknown>; updatedAt: ISODateString; updatedBy: UUID | null;
}
export interface SystemSetting {
  key: string; value: unknown; valueType: 'string' | 'number' | 'boolean' | 'json' | 'money' | 'duration';
  scope: 'GLOBAL' | 'APPLICATION'; category: string; label: string; description: string | null;
  isSecret: boolean; isEditable: boolean; updatedAt: ISODateString; updatedBy: UUID | null;
}
export interface KillSwitchState {
  key: string; isActive: boolean; reason: string | null; activatedBy: UUID | null; activatedAt: ISODateString | null; expiresAt: ISODateString | null;
}
export interface DashboardMetrics {
  generatedAt: ISODateString; window: string;
  users: { total: number; active24h: number; new24h: number; verified: number };
  betting: { bets24h: number; stake24hMinor: bigint; payout24hMinor: bigint; ggr24hMinor: bigint; openBets: number; openLiabilityMinor: bigint; avgStakeMinor: bigint; marginPct: number };
  wallet: { deposits24hMinor: bigint; withdrawals24hMinor: bigint; totalLiabilityMinor: bigint; pendingWithdrawals: number };
  affiliate: { activeAffiliates: number; commission24hMinor: bigint; payableMinor: bigint; pendingPayouts: number; pendingPayoutAmountMinor: bigint };
  risk: { flaggedUsers: number; manualReviewBets: number; failedWebhooks24h: number; settlementBacklog: number };
  providers: { sports: string; payments: string; lastOddsSyncAt: ISODateString | null; lastSettlementAt: ISODateString | null };
}
export interface AdminAdjustmentRequest {
  id: UUID; userId: UUID; currency: Currency; amountMinor: bigint; direction: 'credit' | 'debit';
  type: string; reason: string; status: 'pending' | 'approved' | 'rejected' | 'applied';
  requestedBy: UUID; requestedAt: ISODateString; approvedBy: UUID | null; approvedAt: ISODateString | null;
  decisionReason: string | null; walletEntryId: UUID | null; userEmail?: string | null;
}
