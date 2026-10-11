-- ============================================================================
-- 0120 - ADDITIVE AUDIT COLUMNS
-- Small, purely additive columns that let the application record *who* did what
-- without introducing any new write path for money. All are nullable, so existing
-- rows and all previously verified behaviour are unchanged.
-- ============================================================================

alter table nova.payment_transactions add column if not exists method text;
create index if not exists payment_tx_method_idx on nova.payment_transactions (method) where method is not null;

alter table nova.webhook_receipts add column if not exists event_type text;
alter table nova.webhook_receipts add column if not exists ip_hash text;

-- Maker/checker evidence for affiliate payouts (who paid, who rejected, and when).
alter table nova.affiliate_payouts add column if not exists paid_by uuid references nova.profiles(id);
alter table nova.affiliate_payouts add column if not exists rejected_by uuid references nova.profiles(id);
alter table nova.affiliate_payouts add column if not exists rejected_at timestamptz;

-- Human-readable reason on affiliate ledger rows (commission reversals, adjustments, holds).
alter table nova.affiliate_ledger add column if not exists reason text;
