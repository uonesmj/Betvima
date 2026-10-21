-- Administrative manual-fixture catalogue, deliberately disconnected from wager pricing.
-- Only trusted server connections can read/write this private schema table.
create table if not exists nova.manual_fixtures (
  id uuid primary key default gen_random_uuid(),
  sport text not null check (sport in ('football','basketball','tennis','volleyball','hockey','handball')),
  league text not null check (length(trim(league)) between 2 and 100),
  home text not null check (length(trim(home)) between 2 and 100),
  away text not null check (length(trim(away)) between 2 and 100),
  scheduled_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled','cancelled')),
  created_by uuid not null references nova.profiles(id),
  created_at timestamptz not null default now(),
  constraint manual_fixture_different_teams check (lower(trim(home)) <> lower(trim(away)))
);
create index if not exists idx_manual_fixtures_upcoming on nova.manual_fixtures (sport, scheduled_at) where status='scheduled';
alter table nova.manual_fixtures enable row level security;
revoke all on nova.manual_fixtures from PUBLIC, anon, authenticated;
comment on table nova.manual_fixtures is 'Operator-entered read-only fixtures; cannot place wagers without a separately approved pricing/settlement integration.';
