-- Pending financial migration: NOT part of active production migrations.
-- Apply after 0208, to a dedicated test database first.
-- The original 0208 receipt migration remains unchanged.

create table if not exists nova.softaggregator_round_fx (
  user_id uuid not null references nova.profiles(id) on delete restrict,
  round_id text not null check (length(round_id) between 1 and 240),
  game_id text not null check (length(game_id) between 1 and 240),
  wallet_currency text not null check (wallet_currency in ('USD','IRT','IRR')),
  rate_irt_per_usd numeric(20,8),
  rate_source text not null check (rate_source in ('native_usd','arzhaam')),
  rate_observed_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (user_id, round_id, game_id),
  constraint casino_fx_rate_consistency check (
    (wallet_currency = 'USD' and rate_irt_per_usd is null and rate_source = 'native_usd')
    or
    (wallet_currency in ('IRT','IRR') and rate_irt_per_usd > 0
      and rate_source = 'arzhaam' and rate_observed_at is not null)
  )
);

alter table nova.softaggregator_callback_receipts
  add column if not exists wallet_currency text;
alter table nova.softaggregator_callback_receipts
  add column if not exists wallet_amount_minor bigint;
alter table nova.softaggregator_callback_receipts
  add column if not exists round_id text;
alter table nova.softaggregator_callback_receipts
  add column if not exists game_id text;
alter table nova.softaggregator_callback_receipts
  add column if not exists rollback boolean not null default false;
alter table nova.softaggregator_callback_receipts
  add column if not exists original_debit_call_id text;
-- A rollback may refer only to an existing callback receipt. Its target is
-- checked as a successful original debit by the transaction processor.
alter table nova.softaggregator_callback_receipts
  add constraint sa_original_debit_receipt_fk
  foreign key (original_debit_call_id)
  references nova.softaggregator_callback_receipts(call_id) on delete restrict;

-- Successful rollbacks must record the specific original debit; rejected
-- rollbacks remain unlinked so a retry does not consume an original debit.
alter table nova.softaggregator_callback_receipts
  add constraint sa_successful_rollback_has_original
  check (not (rollback and action = 'credit' and response_error = 0)
         or original_debit_call_id is not null);

-- Exchange rates and settled receipts are immutable audit facts; even a
-- privileged runtime role may only append, never rewrite historic rounds.
create or replace function nova.reject_casino_financial_ledger_rewrite()
returns trigger language plpgsql as $
begin
  raise exception 'CASINO_FINANCIAL_AUDIT_IMMUTABLE' using errcode = '42501';
end;
$;
create trigger sa_fx_round_immutable
  before update or delete on nova.softaggregator_round_fx
  for each row execute function nova.reject_casino_financial_ledger_rewrite();
create trigger sa_receipt_immutable
  before update or delete on nova.softaggregator_callback_receipts
  for each row execute function nova.reject_casino_financial_ledger_rewrite();

create unique index if not exists sa_unique_reversed_debit
  on nova.softaggregator_callback_receipts (original_debit_call_id)
  where original_debit_call_id is not null;
create index if not exists sa_receipts_round_debits
  on nova.softaggregator_callback_receipts (user_id, round_id, game_id, action, amount_minor)
  where response_error = 0;

alter table nova.softaggregator_round_fx enable row level security;
revoke all on nova.softaggregator_round_fx from public, anon, authenticated;
grant select, insert on nova.softaggregator_round_fx to service_role;
comment on table nova.softaggregator_round_fx is
  'Immutable currency and FX snapshot for each supplier game round; no live-money rollout without receipt and callback tests.';
