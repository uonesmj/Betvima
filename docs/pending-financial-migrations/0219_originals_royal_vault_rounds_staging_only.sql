-- PENDING FINANCIAL MIGRATION. DO NOT APPLY TO PRODUCTION.
-- Reviewed only after an isolated restore rehearsal, a current restorable
-- backup, a signed approval and independent game/RNG/operational authorization.
-- This table is NOT exposed to PostgREST/anon/authenticated.
create table nova.originals_rounds (
  round_id uuid primary key,
  user_id uuid not null references nova.profiles(id) on delete restrict,
  client_request_id uuid not null,
  game_id text not null default 'royal-vault' check (game_id='royal-vault'),
  math_version text not null check (math_version='rv-demo-1'),
  wallet_currency text not null check (wallet_currency='USD'),
  stake_minor bigint not null check (stake_minor between 10 and 2000 and stake_minor % 5 = 0),
  payout_minor bigint not null check (payout_minor >= 0),
  balance_after_minor bigint not null check (balance_after_minor >= 0),
  result_grid jsonb not null check (jsonb_typeof(result_grid)='array' and jsonb_array_length(result_grid)=5),
  result_line_wins jsonb not null check (jsonb_typeof(result_line_wins)='array'),
  debit_transaction_id uuid not null unique references nova.wallet_transactions(id) on delete restrict,
  credit_transaction_id uuid unique references nova.wallet_transactions(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint originals_request_unique unique(user_id,client_request_id),
  constraint originals_payout_receipt_check check (
    (payout_minor=0 and credit_transaction_id is null) or
    (payout_minor>0 and credit_transaction_id is not null)
  )
);
create index originals_round_user_history_idx
  on nova.originals_rounds(user_id, created_at desc);
alter table nova.originals_rounds enable row level security;
alter table nova.originals_rounds force row level security;
revoke all on nova.originals_rounds from public, anon, authenticated;
grant select, insert on nova.originals_rounds to service_role;
create function nova.reject_originals_round_rewrite()
returns trigger language plpgsql security invoker
set search_path=pg_catalog,nova
as $originals_immutable$
begin
  raise exception 'ORIGINALS_ROUND_IMMUTABLE' using errcode='42501';
end;
$originals_immutable$;
create trigger originals_rounds_immutable
  before update or delete on nova.originals_rounds
  for each row execute function nova.reject_originals_round_rewrite();

-- Receipt integrity is enforced at the database layer, not only by TS tests.
create function nova.check_originals_ledger_pair()
returns trigger language plpgsql security invoker set search_path=pg_catalog,nova
as $originals_guard$
declare
  debit nova.wallet_transactions%rowtype;
  credit nova.wallet_transactions%rowtype;
  expected_reference text;
begin
  expected_reference := 'originals:' || new.round_id::text;
  select * into debit from nova.wallet_transactions where id=new.debit_transaction_id;
  if not found
     or debit.user_id <> new.user_id
     or debit.currency <> new.wallet_currency
     or debit.type::text <> 'bet_debit'
     or debit.status::text <> 'posted'
     or debit.amount_minor <> -new.stake_minor
     or debit.reference is distinct from expected_reference
     or debit.idempotency_key is distinct from ('originals:debit:' || new.round_id::text)
  then
    raise exception 'ORIGINALS_DEBIT_MISMATCH' using errcode='23514';
  end if;
  if new.payout_minor > 0 then
    select * into credit from nova.wallet_transactions where id=new.credit_transaction_id;
    if not found
       or credit.user_id <> new.user_id
       or credit.currency <> new.wallet_currency
       or credit.type::text <> 'win_credit'
       or credit.status::text <> 'posted'
       or credit.amount_minor <> new.payout_minor
       or credit.reference is distinct from expected_reference
       or credit.idempotency_key is distinct from ('originals:credit:' || new.round_id::text)
    then
      raise exception 'ORIGINALS_CREDIT_MISMATCH' using errcode='23514';
    end if;
    if credit.balance_after_minor <> new.balance_after_minor then
      raise exception 'ORIGINALS_CREDIT_BALANCE_MISMATCH' using errcode='23514';
    end if;
  elsif debit.balance_after_minor <> new.balance_after_minor then
    raise exception 'ORIGINALS_DEBIT_BALANCE_MISMATCH' using errcode='23514';
  end if;
  return new;
end;
$originals_guard$;
create trigger originals_pair_integrity
  before insert on nova.originals_rounds
  for each row execute function nova.check_originals_ledger_pair();

comment on table nova.originals_rounds is
  'PENDING ONLY. Append-only, idempotent Royal Vault USD round financial evidence. Production go-live requires regulatory and financial release gate.';
