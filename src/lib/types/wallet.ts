import type { Currency, ISODateString, UUID } from './common';

/** Mirrors the authoritative Postgres enum `nova.wallet_tx_type` 1:1. */
export type WalletLedgerType =
  | 'deposit' | 'withdrawal' | 'withdrawal_hold' | 'withdrawal_release' | 'bet_debit' | 'bet_refund'
  | 'win_credit' | 'void_refund' | 'bonus' | 'adjustment' | 'reversal' | 'affiliate_payout' | 'cashout';
export type WalletLedgerDirection = 'credit' | 'debit';
export type WalletLedgerStatus = 'posted' | 'pending' | 'reversed' | 'failed';
export type WalletStatus = 'active' | 'frozen' | 'closed';

export interface Wallet {
  id: UUID; userId: UUID; currency: Currency; status: WalletStatus;
  balanceMinor: bigint; availableMinor: bigint; heldMinor: bigint; bonusMinor: bigint;
  lifetimeDepositMinor: bigint; lifetimeWithdrawalMinor: bigint; lifetimeStakeMinor: bigint; lifetimePayoutMinor: bigint;
  version: number; createdAt: ISODateString; updatedAt: ISODateString;
}
export interface WalletEntry {
  id: UUID; walletId: UUID; userId: UUID; currency: Currency; type: WalletLedgerType; direction: WalletLedgerDirection;
  amountMinor: bigint; balanceAfterMinor: bigint; status: WalletLedgerStatus;
  referenceType: string | null; referenceId: string | null; betId: UUID | null; paymentId: UUID | null;
  description: string | null; metadata: Record<string, unknown> | null;
  idempotencyKey: string; reversesEntryId: UUID | null; reversedByEntryId: UUID | null;
  createdAt: ISODateString; createdBy: UUID | null;
}
export interface WalletStatement {
  wallet: Wallet; entries: WalletEntry[]; totals: { creditMinor: bigint; debitMinor: bigint; netMinor: bigint };
  page: number; pageSize: number; hasMore: boolean;
}
export interface WalletTransactionPreview {
  type: WalletLedgerType; direction: WalletLedgerDirection; amountMinor: bigint;
  balanceBeforeMinor: bigint; balanceAfterMinor: bigint; allowed: boolean; reasonCode?: string;
}
