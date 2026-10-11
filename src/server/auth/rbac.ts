/**
 * Role -> permission map (spec §46). The database is the last line of defence
 * (`nova.is_admin()` / `nova.require_admin()`); this map decides what the UI and API
 * expose, and every admin route re-checks the permission server-side.
 */
import type { AdminPermission, UserRole } from '@/lib/types';

export const ROLE_LABELS: Record<UserRole, string> = {
  user: 'Player', affiliate: 'Affiliate', support: 'Support agent', trader: 'Odds trader',
  risk_manager: 'Risk manager', finance: 'Finance', settlement_manager: 'Settlement manager',
  affiliate_manager: 'Affiliate manager', admin: 'Administrator', super_admin: 'Super administrator',
};

const PLAYER: AdminPermission[] = [];
const AFFILIATE_ONLY: AdminPermission[] = ['dashboard.view'];
const SUPPORT: AdminPermission[] = [
  'dashboard.view', 'users.view', 'users.notes', 'bets.view', 'wallet.view', 'payments.view', 'affiliates.view', 'reports.view',
  'support.view', 'support.reply', 'support.assign', 'support.manage',
];
const ODDS_TRADER: AdminPermission[] = [
  'dashboard.view', 'odds.view', 'odds.edit', 'markets.suspend', 'matches.manage', 'bets.view', 'reports.view',
];
const RISK_MANAGER: AdminPermission[] = [
  'dashboard.view', 'users.view', 'users.edit', 'users.password_reset', 'users.status', 'bets.view', 'bets.settle', 'bets.regrade', 'bets.void',
  'risk.view', 'risk.edit', 'limits.edit', 'reports.view', 'bets.reverse', 'affiliates.view', 'affiliates.fraud',
];
const FINANCE: AdminPermission[] = [
  'dashboard.view', 'users.view', 'users.password_reset', 'wallet.view', 'wallet.adjust', 'wallet.approve_adjustment', 'payments.view',
  'payments.approve', 'payments.reject', 'payments.refund', 'affiliates.view', 'affiliates.payout', 'reports.view',
  'reports.export', 'reconciliation.run',
];
const ADMIN: AdminPermission[] = [
  'dashboard.view', 'users.view', 'users.edit', 'users.password_reset', 'users.status', 'users.kyc', 'users.notes',
  'bets.view', 'bets.settle', 'bets.regrade', 'bets.reverse', 'bets.void',
  'odds.view', 'odds.edit', 'markets.suspend', 'matches.manage',
  'wallet.view', 'payments.view', 'payments.approve', 'payments.reject', 'payments.refund',
  'affiliates.view', 'affiliates.edit', 'affiliates.approve', 'affiliates.payout', 'affiliates.fraud',
  'risk.view', 'risk.edit', 'limits.edit', 'bonus.manage', 'promo.manage',
  'reports.view', 'reports.export', 'reconciliation.run',
  'admin.view', 'admin.create', 'admin.roles', 'admin.audit',
  'support.view', 'support.reply', 'support.assign', 'support.manage',
  'settings.view', 'settings.edit', 'killswitch.toggle',
];
const SUPER_ADMIN: AdminPermission[] = [
  ...ADMIN, 'maintenance.toggle', 'wallet.adjust', 'wallet.approve_adjustment',
];

const AFFILIATE_MANAGER: AdminPermission[] = [
  'dashboard.view', 'affiliates.view', 'affiliates.edit', 'affiliates.approve', 'affiliates.payout',
  'affiliates.fraud', 'users.view', 'reports.view', 'reports.export',
];
const SETTLEMENT_MANAGER: AdminPermission[] = [
  'dashboard.view', 'bets.view', 'bets.settle', 'bets.regrade', 'bets.reverse', 'bets.void',
  'odds.view', 'matches.manage', 'reports.view', 'reconciliation.run', 'affiliates.view',
];

export const ROLE_PERMISSIONS: Record<UserRole, AdminPermission[]> = {
  user: PLAYER, affiliate: AFFILIATE_ONLY, support: SUPPORT, trader: ODDS_TRADER,
  risk_manager: RISK_MANAGER, finance: FINANCE, settlement_manager: SETTLEMENT_MANAGER,
  affiliate_manager: AFFILIATE_MANAGER, admin: ADMIN, super_admin: SUPER_ADMIN,
};

/** Must stay identical to `nova.admin_roles()` in the database. */
export const ADMIN_ROLES: UserRole[] = ['support', 'finance', 'risk_manager', 'settlement_manager', 'trader', 'affiliate_manager', 'admin', 'super_admin'];

export function permissionsForRole(role: UserRole): AdminPermission[] {
  return ROLE_PERMISSIONS[role] ?? PLAYER;
}

export function roleHasPermission(role: UserRole, permission: AdminPermission): boolean {
  return permissionsForRole(role).includes(permission);
}

export function isAdminRole(role: string): boolean {
  return ADMIN_ROLES.includes(role as UserRole);
}
