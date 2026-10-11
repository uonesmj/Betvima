/**
 * MIRROR OF THE AUTHORITATIVE POSTGRES ENUMS (migration 0001 + 0110 + 0120).
 *
 * The database is the source of truth for these names. TypeScript mirrors them 1:1 so a
 * typo becomes a compile error instead of a runtime failure, and `ENUM_MIRROR` records
 * the exact values for the traceability docs and for deployment verification.
 */
export const USER_ROLE = ['user', 'affiliate', 'support', 'finance', 'risk_manager', 'settlement_manager', 'trader', 'affiliate_manager', 'admin', 'super_admin'] as const;
export const ACCOUNT_STATUS = ['active', 'restricted', 'suspended', 'closed', 'self_excluded'] as const;
export const KYC_STATUS = ['not_started', 'pending', 'verified', 'rejected', 'expired'] as const;
export const MATCH_STATUS = ['scheduled', 'live', 'paused', 'finished', 'postponed', 'cancelled', 'abandoned', 'interrupted', 'rescheduled'] as const;
export const MARKET_STATUS = ['open', 'suspended', 'closed', 'settled', 'void', 'manual_review'] as const;
export const SELECTION_STATUS = ['open', 'suspended', 'closed', 'settled', 'void'] as const;
export const BET_TYPE = ['SINGLE', 'MULTIPLE'] as const;
export const BET_STATUS = ['pending', 'accepted', 'cashed_out', 'settled', 'partially_settled', 'void', 'cancelled', 'refunded', 'manual_review', 'rejected'] as const;
export const BET_LEG_STATUS = ['pending', 'won', 'lost', 'void', 'half_won', 'half_lost', 'pending_review', 'refunded'] as const;
export const WALLET_TX_TYPE = ['deposit', 'withdrawal', 'bet_debit', 'bet_refund', 'win_credit', 'void_refund', 'bonus', 'adjustment', 'reversal', 'withdrawal_hold', 'withdrawal_release', 'affiliate_payout', 'cashout'] as const;
export const WALLET_TX_STATUS = ['pending', 'posted', 'reversed', 'failed', 'cancelled'] as const;
export const PAYMENT_TX_TYPE = ['deposit', 'withdrawal'] as const;
export const PAYMENT_TX_STATUS = ['initiated', 'pending', 'requires_action', 'succeeded', 'failed', 'cancelled', 'expired', 'refunded', 'reversed'] as const;
export const SETTLEMENT_JOB_STATUS = ['queued', 'processing', 'done', 'failed', 'manual_review', 'skipped'] as const;
export const COMMISSION_MODEL = ['PROFIT_LOSS_35', 'NON_NEGATIVE_35', 'CPA', 'HYBRID'] as const;
export const AFFILIATE_STATUS = ['pending', 'approved', 'suspended', 'blocked', 'closed'] as const;
export const AFFILIATE_LEDGER_TYPE = ['user_loss_commission', 'user_win_debit', 'reversal', 'adjustment', 'settlement', 'payout', 'carry_forward', 'carry_forward_release'] as const;
export const AFFILIATE_LEDGER_STATUS = ['pending', 'available', 'settled', 'paid', 'void'] as const;
export const ATTRIBUTION_STATUS = ['pending', 'confirmed', 'rejected', 'locked', 'review'] as const;
export const AFFILIATE_PAYOUT_STATUS = ['pending', 'eligible', 'approved', 'processing', 'paid', 'failed', 'cancelled', 'manual_review', 'rejected'] as const;
export const NOTIFICATION_TYPE = ['bet_accepted', 'bet_won', 'bet_lost', 'bet_void', 'bet_cashout', 'odds_change', 'deposit', 'withdrawal', 'security_alert', 'affiliate_commission', 'affiliate_settlement', 'affiliate_payout', 'system', 'promotion'] as const;
export const JOB_STATUS = ['queued', 'processing', 'succeeded', 'failed', 'dead_letter'] as const;
export const RECONCILIATION_STATUS = ['ok', 'mismatch', 'manual_review', 'resolved'] as const;
export const ADMIN_ROLES_DB = ['support', 'finance', 'risk_manager', 'settlement_manager', 'trader', 'affiliate_manager', 'admin', 'super_admin'] as const;

/** Maps the app's notification event keys onto the authoritative `notification_type` enum. */
export const NOTIFICATION_TYPE_BY_EVENT: Record<string, (typeof NOTIFICATION_TYPE)[number]> = {
  'auth.welcome': 'system', 'auth.verify_email': 'system', 'auth.verify_phone': 'system',
  'auth.password_reset': 'security_alert', 'auth.new_device': 'security_alert', 'auth.login_alert': 'security_alert',
  'bet.placed': 'bet_accepted', 'bet.odds_change': 'odds_change', 'bet.settled': 'bet_accepted',
  'bet.won': 'bet_won', 'bet.lost': 'bet_lost', 'bet.void': 'bet_void', 'bet.cashout': 'bet_cashout',
  'wallet.deposit_confirmed': 'deposit', 'wallet.deposit_failed': 'deposit',
  'wallet.withdrawal_requested': 'withdrawal', 'wallet.withdrawal_approved': 'withdrawal',
  'wallet.withdrawal_paid': 'withdrawal', 'wallet.withdrawal_rejected': 'withdrawal',
  'wallet.low_balance': 'system', 'wallet.limit_warning': 'system',
  'affiliate.approved': 'affiliate_settlement', 'affiliate.referred_user': 'affiliate_commission',
  'affiliate.commission_earned': 'affiliate_commission', 'affiliate.settlement_completed': 'affiliate_settlement',
  'affiliate.payout_paid': 'affiliate_payout', 'affiliate.payout_rejected': 'affiliate_payout',
  'affiliate.fraud_review': 'security_alert', 'account.status_changed': 'security_alert',
  'account.kyc_required': 'system', 'system.maintenance': 'system', 'promo.generic': 'promotion',
};

export const ADMIN_ROLES: readonly string[] = ADMIN_ROLES_DB;
export const isAdminRoleName = (role: string): boolean => ADMIN_ROLES_DB.includes(role as never);
