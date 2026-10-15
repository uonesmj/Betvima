-- SoftAggregator callback receipts. No existing wallet or betting table is modified.
-- Deploy only after backup and database migration safety checks pass.
create table if not exists nova.softaggregator_callback_receipts (
  call_id text primary key,
  identity_hash char(64) not null,
  user_id uuid not null references nova.profiles(id) on delete restrict,
  action text not null check (action in ('debit', 'credit')),
  amount_minor bigint not null check (amount_minor > 0),
  response_error smallint not null check (response_error in (0, 1, 2)),
  response_balance_minor bigint not null,
  ledger_transaction_id uuid references nova.wallet_transactions(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index if not exists sa_receipts_user_time_idx on nova.softaggregator_callback_receipts(user_id, created_at desc);
alter table nova.softaggregator_callback_receipts enable row level security;
revoke all on nova.softaggregator_callback_receipts from public, anon, authenticated;
grant select, insert on nova.softaggregator_callback_receipts to service_role;
comment on table nova.softaggregator_callback_receipts is
  'Append-only callback deduplication records. Financial movements use nova.post_wallet_entry only.';
