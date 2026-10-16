-- Pending ONLY. Apply AFTER casino receipt/round migrations 0208-0210,
-- in an isolated, fully restored staging database. Never auto-migrate Production.
-- The operator casino wallet's native currency is anchored before game launch.
-- Provider sends USD cents; BetVima always posts the original bound currency.
create table if not exists nova.softaggregator_player_wallet_bindings (
  user_id uuid primary key references nova.profiles(id) on delete restrict,
  wallet_currency text not null check (wallet_currency in ('USD', 'IRT', 'IRR')),
  created_at timestamptz not null default now()
);

-- Reuse the no-update/no-delete trigger function installed in 0209.
create trigger sa_player_wallet_binding_immutable
  before update or delete on nova.softaggregator_player_wallet_bindings
  for each row execute function nova.reject_casino_financial_ledger_rewrite();

alter table nova.softaggregator_player_wallet_bindings enable row level security;
revoke all on nova.softaggregator_player_wallet_bindings from public, anon, authenticated;
grant select, insert on nova.softaggregator_player_wallet_bindings to service_role;

comment on table nova.softaggregator_player_wallet_bindings is
  'Immutable native wallet currency chosen before first real-money game launch; never change across rounds or profile preference edits.';
