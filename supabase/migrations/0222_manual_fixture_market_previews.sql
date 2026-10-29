-- Manual fixture markets: audited, read-only price previews. Never accepted by the betting ledger.
-- No foreign key into nova.matches/markets/selections: prevents accidental money wagering.
create table if not exists nova.manual_fixture_markets (
 id uuid primary key default gen_random_uuid(),
 fixture_id uuid not null references nova.manual_fixtures(id) on delete cascade,
 market_key text not null check (market_key ~ '^[a-z][a-z0-9_-]{1,63}$'),
 title text not null check (char_length(title) between 2 and 120),
 line numeric(7,2),
 selections jsonb not null check (jsonb_typeof(selections)='array'
  and jsonb_array_length(selections) between 2 and 6),
 status text not null default 'draft' check (status in ('draft','visible','suspended')),
 version integer not null default 1 check (version >= 1),
 created_by uuid not null,
 updated_by uuid not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique (fixture_id, market_key)
);
create index if not exists idx_manual_fixture_markets_visible
 on nova.manual_fixture_markets(fixture_id,status,updated_at desc);
alter table nova.manual_fixture_markets enable row level security;
revoke all on nova.manual_fixture_markets from anon, authenticated;
comment on table nova.manual_fixture_markets is
 'Administrative price previews only. Never valid for real-money quote, bet or settlement.';
