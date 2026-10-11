create table if not exists nova.bet_slip_shares (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  created_by uuid references nova.profiles(id) on delete set null,
  slip_type text not null check (slip_type in ('SINGLE','MULTIPLE','SERIES')),
  currency text not null check (currency in ('IRT','IRR','USD','EUR','GBP')),
  selections jsonb not null check (jsonb_typeof(selections) = 'array'),
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

create index if not exists bet_slip_shares_code_idx
  on nova.bet_slip_shares (code);

create index if not exists bet_slip_shares_created_by_idx
  on nova.bet_slip_shares (created_by, created_at desc);

comment on table nova.bet_slip_shares is
  'Shareable bet-slip snapshots. Financial bets are never stored here. Current odds are resolved again when a code is loaded.';
