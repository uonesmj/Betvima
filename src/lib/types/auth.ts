import type { Currency, ISODateString, UUID } from './common';

export type UserRole = (typeof import('@/lib/db-enums').USER_ROLE)[number];
export type AccountStatus = (typeof import('@/lib/db-enums').ACCOUNT_STATUS)[number];
export type KycStatus = (typeof import('@/lib/db-enums').KYC_STATUS)[number];
export type AdminPermission =
  | 'dashboard.view' | 'users.view' | 'users.edit' | 'users.password_reset' | 'users.status' | 'users.kyc' | 'users.notes'
  | 'bets.view' | 'bets.settle' | 'bets.regrade' | 'bets.reverse' | 'bets.void'
  | 'odds.view' | 'odds.edit' | 'markets.suspend' | 'matches.manage'
  | 'wallet.view' | 'wallet.adjust' | 'wallet.approve_adjustment'
  | 'payments.view' | 'payments.approve' | 'payments.reject' | 'payments.refund'
  | 'affiliates.view' | 'affiliates.edit' | 'affiliates.approve' | 'affiliates.payout' | 'affiliates.fraud'
  | 'risk.view' | 'risk.edit' | 'limits.edit' | 'bonus.manage' | 'promo.manage'
  | 'reports.view' | 'reports.export' | 'reconciliation.run'
  | 'admin.view' | 'admin.create' | 'admin.roles' | 'admin.audit'
  | 'settings.view' | 'settings.edit' | 'killswitch.toggle' | 'maintenance.toggle'
  | 'support.view' | 'support.reply' | 'support.assign' | 'support.manage';

export interface UserProfile {
  id: UUID; publicId: string; numericId: number; email: string | null; phone: string | null; username: string | null;
  fullName: string | null; preferredLocale: 'en'; preferredCurrency: Currency; timezone: string;
  status: AccountStatus; kycStatus: KycStatus; role: UserRole; permissions: AdminPermission[];
  isEmailVerified: boolean; isPhoneVerified: boolean; twoFactorEnabled: boolean;
  limits: UserLimits; affiliateId: UUID | null; registeredAt: ISODateString; lastLoginAt: ISODateString | null;
  suspendedReason: string | null; selfExcludedUntil: ISODateString | null;
}
export interface UserLimits {
  maxStakePerBetMinor: bigint | null; maxStakePerDayMinor: bigint | null; maxPayoutPerBetMinor: bigint | null;
  maxOpenBets: number | null; lossLimitDailyMinor: bigint | null; lossLimitWeeklyMinor: bigint | null;
  depositLimitDailyMinor: bigint | null; depositLimitWeeklyMinor: bigint | null; sessionLimitMinutes: number | null;
}
export interface SessionUser {
  id: UUID; email: string | null; role: UserRole; status: AccountStatus; permissions: AdminPermission[];
  locale: 'en'; currency: Currency; affiliateId: UUID | null; isAdmin: boolean;
}
export interface AuthResult { user: SessionUser; accessToken: string; refreshToken: string; expiresAt: ISODateString }
export type MfaMethod = 'totp' | 'sms' | 'email';
export interface LoginAttemptRecord { email?: string; ip: string; success: boolean; at: Date; reason?: string }
