import type { ISODateString, UUID } from './common';

export type NotificationChannel = 'in_app' | 'email' | 'sms' | 'push';
export type NotificationStatus = 'queued' | 'sending' | 'sent' | 'failed' | 'suppressed' | 'read';
/** Mirrors the authoritative `notification_type` enum. */
export type NotificationType = (typeof import('@/lib/db-enums').NOTIFICATION_TYPE)[number];
export type NotificationEventKey =
  | 'auth.welcome' | 'auth.verify_email' | 'auth.verify_phone' | 'auth.password_reset' | 'auth.new_device' | 'auth.login_alert'
  | 'bet.placed' | 'bet.odds_change' | 'bet.settled' | 'bet.won' | 'bet.lost' | 'bet.void'
  | 'wallet.deposit_confirmed' | 'wallet.deposit_failed' | 'wallet.withdrawal_requested' | 'wallet.withdrawal_approved'
  | 'wallet.withdrawal_paid' | 'wallet.withdrawal_rejected' | 'wallet.low_balance' | 'wallet.limit_warning'
  | 'affiliate.approved' | 'affiliate.referred_user' | 'affiliate.commission_earned' | 'affiliate.settlement_completed'
  | 'affiliate.payout_paid' | 'affiliate.payout_rejected' | 'affiliate.fraud_review'
  | 'account.status_changed' | 'account.kyc_required' | 'system.maintenance' | 'promo.generic';
export interface NotificationRecord {
  id: UUID; userId: UUID; eventKey: NotificationEventKey; channel: NotificationChannel; status: NotificationStatus;
  title: string; body: string; data: Record<string, unknown> | null; locale: 'en';
  attempts: number; lastError: string | null; providerMessageId: string | null;
  scheduledAt: ISODateString; sentAt: ISODateString | null; readAt: ISODateString | null; createdAt: ISODateString;
}
export interface NotificationTemplate {
  eventKey: NotificationEventKey; channel: NotificationChannel; locale: 'en';
  subject: string | null; body: string; isEnabled: boolean; updatedAt: ISODateString;
}
export interface NotificationPreference {
  userId: UUID; eventKey: NotificationEventKey; inApp: boolean; email: boolean; sms: boolean; push: boolean;
}
