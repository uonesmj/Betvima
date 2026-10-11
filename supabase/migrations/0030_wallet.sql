-- ============================================================================
-- 0030 - WALLET + IMMUTABLE LEDGER + PAYMENT TRANSACTIONS
-- The balance on nova.wallets is a CACHE. The authority is
-- SUM(nova.wallet_transactions.amount_minor) for posted rows - reconciled
-- continuously by nova.reconcile_financial_period (spec §15, §78).
-- ============================================================================

create table if not exists nova.wallets (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references nova.profiles (id) on delete cascade,
  currency       text not null default 'IRT' check (currency in ('IRT','IRR','EUR','USD','USDT')),
  balance_minor  bigint not null default 0,
  locked_minor   bigint not null default 0 check (locked_minor >= 0),
  version        bigint not null default 0,
  is_frozen      boolean not null default false,
  frozen_reason  text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (user_id, currency)
);
drop trigger if exists wallets_updated_at on nova.wallets;
create trigger wallets_updated_at before update on nova.wallets for each row execute function nova.set_updated_at();

create table if not exists nova.wallet_transactions (
  id                    uuid primary key default gen_random_uuid(),
  wallet_id             uuid not null references nova.wallets (id) on delete restrict,
  user_id               uuid not null references nova.profiles (id) on delete restrict,
  type                  wallet_tx_type not null,
  amount_minor          bigint not null,                     -- signed: credit > 0, debit < 0
  balance_after_minor   bigint not null,
  currency              text not null,
  status                wallet_tx_status not null default 'posted',
  reference             text,
  bet_id                uuid,
  payment_transaction_id uuid,
  reversal_of           uuid references nova.wallet_transactions (id),
  idempotency_key       text not null,
  reason                text,
  actor_id              uuid references nova.profiles (id),
  metadata              jsonb not null default '{}'::jsonb,
  created_at            timestamptz not null default now(),
  unique (wallet_id, idempotency_key)
);
create index if not exists wallet_tx_user_idx on nova.wallet_transactions (user_id, created_at desc);
create index if not exists wallet_tx_type_idx on nova.wallet_transactions (type, created_at desc);
create index if not exists wallet_tx_bet_idx on nova.wallet_transactions (bet_id) where bet_id is not null;
create index if not exists wallet_tx_reversal_idx on nova.wallet_transactions (reversal_of) where reversal_of is not null;

-- Append-only: financial history is never updated or deleted (rule 17).
drop trigger if exists wallet_tx_immutable on nova.wallet_transactions;
create trigger wallet_tx_immutable before update or delete on nova.wallet_transactions
  for each row execute function nova.prevent_mutation();
drop trigger if exists wallet_tx_nonzero on nova.wallet_transactions;
create trigger wallet_tx_nonzero before insert on nova.wallet_transactions
  for each row execute function nova.assert_nonzero_amount();

comment on table nova.wallet_transactions is
  'IMMUTABLE wallet ledger. Corrections are new rows (reversal/adjustment) that reference the original entry.';

-- Reporting view (spec names both wallet_transactions and wallet_ledger).
create or replace view nova.wallet_ledger as
select
  t.id, t.user_id, t.wallet_id, t.currency, t.type, t.status,
  t.amount_minor, t.balance_after_minor, t.reference, t.bet_id,
  t.payment_transaction_id, t.reversal_of, t.idempotency_key, t.reason,
  t.created_at,
  sum(t.amount_minor) over (partition by t.wallet_id order by t.created_at, t.id) as running_balance_minor
from nova.wallet_transactions t
where t.status = 'posted';

-- ------------------------------------------------------------ payment records
create table if not exists nova.payment_transactions (
  id                  uuid primary key default gen_random_uuid(),
  public_id           text not null unique,
  user_id             uuid not null references nova.profiles (id) on delete restrict,
  type                payment_tx_type not null,
  provider            text not null,
  provider_reference  text,
  provider_event_id   text,
  status              payment_tx_status not null default 'initiated',
  amount_minor        bigint not null check (amount_minor > 0),
  fee_minor           bigint not null default 0,
  currency            text not null,
  idempotency_key     text not null,
  wallet_transaction_id uuid references nova.wallet_transactions (id),
  destination_masked  text,
  failure_reason      text,
  raw_request         jsonb not null default '{}'::jsonb,
  raw_callback        jsonb,
  signature_verified  boolean not null default false,
  replay_checked_at   timestamptz,
  initiated_at        timestamptz not null default now(),
  completed_at        timestamptz,
  expires_at          timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (user_id, idempotency_key)
);
create unique index if not exists payment_tx_provider_ref_unique
  on nova.payment_transactions (provider, provider_reference)
  where provider_reference is not null;
create unique index if not exists payment_tx_provider_event_unique
  on nova.payment_transactions (provider, provider_event_id)
  where provider_event_id is not null;
create index if not exists payment_tx_status_idx on nova.payment_transactions (type, status, created_at desc);
drop trigger if exists payment_tx_updated_at on nova.payment_transactions;
create trigger payment_tx_updated_at before update on nova.payment_transactions for each row execute function nova.set_updated_at();

-- Replay protection ledger for verified provider webhooks.
create table if not exists nova.webhook_receipts (
  id                uuid primary key default gen_random_uuid(),
  provider          text not null,
  provider_event_id text not null,
  signature         text,
  payload_hash      text not null,
  received_at       timestamptz not null default now(),
  processed         boolean not null default false,
  processing_result text,
  unique (provider, provider_event_id)
);
create index if not exists webhook_receipts_received_idx on nova.webhook_receipts (provider, received_at desc);
