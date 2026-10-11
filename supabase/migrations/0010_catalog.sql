-- ============================================================================
-- 0010 - USERS, SPORTS CATALOGUE, MATCHES, RESULTS
-- Provider identifiers are always separate from internal ids (spec §8).
-- ============================================================================

-- ------------------------------------------------------------------- profiles
create table if not exists nova.profiles (
  id                  uuid primary key default gen_random_uuid(),
  public_id           text not null unique,
  email               text,
  email_hash          text,
  phone               text,
  phone_hash          text,
  display_name        text,
  role                user_role not null default 'user',
  status              account_status not null default 'active',
  preferred_locale    text not null default 'fa' check (preferred_locale in ('fa','en')),
  preferred_currency  text not null default 'IRT',
  timezone            text not null default 'Asia/Tehran',
  email_verified      boolean not null default false,
  age_verified        boolean not null default false,
  kyc_status          kyc_status not null default 'not_started',
  jurisdiction        text,
  is_affiliate        boolean not null default false,
  last_login_at       timestamptz,
  restriction_note    text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists profiles_role_idx on nova.profiles (role);
create index if not exists profiles_email_hash_idx on nova.profiles (email_hash);
create index if not exists profiles_status_idx on nova.profiles (status);
drop trigger if exists profiles_updated_at on nova.profiles;
create trigger profiles_updated_at before update on nova.profiles for each row execute function nova.set_updated_at();

-- referential link to auth.users only when the Supabase-style table is present
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_schema = 'nova' and table_name = 'profiles' and constraint_name = 'profiles_auth_fk'
  ) then
    alter table nova.profiles add constraint profiles_auth_fk foreign key (id) references auth.users (id) on delete cascade;
  end if;
end $$;

-- ---------------------------------------------------------------- user sessions
create table if not exists nova.user_sessions (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references nova.profiles (id) on delete cascade,
  session_token_hash  text not null unique,
  ip_hash             text,
  user_agent          text,
  device_label        text,
  created_at          timestamptz not null default now(),
  last_seen_at        timestamptz not null default now(),
  expires_at          timestamptz not null,
  revoked_at          timestamptz,
  revoked_reason      text
);
create index if not exists user_sessions_user_idx on nova.user_sessions (user_id, expires_at desc);

-- ------------------------------------------------------------- user restrictions
create table if not exists nova.user_restrictions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references nova.profiles (id) on delete cascade,
  kind          text not null check (kind in ('deposit_limit','stake_limit','loss_limit','cooling_off','self_exclusion','account_restriction','session_limit','time_reminder')),
  value_minor   bigint,
  currency      text,
  period        text check (period in ('daily','weekly','monthly')),
  reason        text,
  created_by    uuid references nova.profiles (id),
  created_at    timestamptz not null default now(),
  effective_from timestamptz not null default now(),
  effective_to  timestamptz,
  is_active     boolean not null default true
);
create index if not exists user_restrictions_active_idx on nova.user_restrictions (user_id, is_active, kind);

-- ---------------------------------------------------------------- geo / sports
create table if not exists nova.countries (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique check (code ~ '^[A-Z0-9-]{2,8}$'),
  name_en     text not null,
  name_fa     text,
  flag_emoji  text,
  is_blocked  boolean not null default false,
  created_at  timestamptz not null default now()
);

create table if not exists nova.sports (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique,
  name_en        text not null,
  name_fa        text,
  icon           text,
  display_order  int not null default 100,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
drop trigger if exists sports_updated_at on nova.sports;
create trigger sports_updated_at before update on nova.sports for each row execute function nova.set_updated_at();

create table if not exists nova.leagues (
  id          uuid primary key default gen_random_uuid(),
  sport_id    uuid not null references nova.sports (id) on delete cascade,
  country_id  uuid references nova.countries (id),
  slug        text not null,
  name        text not null,
  name_fa     text,
  tier        int,
  logo        text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (sport_id, slug)
);
drop trigger if exists leagues_updated_at on nova.leagues;
create trigger leagues_updated_at before update on nova.leagues for each row execute function nova.set_updated_at();
create index if not exists leagues_sport_idx on nova.leagues (sport_id, is_active);

create table if not exists nova.seasons (
  id          uuid primary key default gen_random_uuid(),
  league_id   uuid not null references nova.leagues (id) on delete cascade,
  name        text not null,
  starts_at   date,
  ends_at     date,
  is_current  boolean not null default false,
  unique (league_id, name)
);

create table if not exists nova.teams (
  id          uuid primary key default gen_random_uuid(),
  sport_id    uuid not null references nova.sports (id) on delete cascade,
  country_id  uuid references nova.countries (id),
  slug        text not null,
  name        text not null,
  name_fa     text,
  short_name  text,
  logo        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (sport_id, slug)
);
drop trigger if exists teams_updated_at on nova.teams;
create trigger teams_updated_at before update on nova.teams for each row execute function nova.set_updated_at();
create index if not exists teams_name_trgm_idx on nova.teams using gin (name gin_trgm_ops);

create table if not exists nova.players (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid references nova.teams (id) on delete set null,
  sport_id    uuid not null references nova.sports (id) on delete cascade,
  name        text not null,
  name_fa     text,
  position    text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------- provider map
create table if not exists nova.provider_entities (
  id                uuid primary key default gen_random_uuid(),
  provider          text not null,
  entity_type       text not null check (entity_type in ('sport','country','league','season','team','player','match','market','selection','result')),
  provider_id       text not null,
  internal_id       uuid not null,
  payload_hash      text,
  first_seen_at     timestamptz not null default now(),
  last_seen_at      timestamptz not null default now(),
  unique (provider, entity_type, provider_id)
);
create index if not exists provider_entities_internal_idx on nova.provider_entities (internal_id);

-- ------------------------------------------------------------------- matches
create table if not exists nova.matches (
  id                  uuid primary key default gen_random_uuid(),
  sport_id            uuid not null references nova.sports (id),
  league_id           uuid not null references nova.leagues (id),
  season_id           uuid references nova.seasons (id),
  home_team_id        uuid not null references nova.teams (id),
  away_team_id        uuid not null references nova.teams (id),
  status              match_status not null default 'scheduled',
  clock               text,
  minute              int check (minute is null or (minute >= 0 and minute <= 130)),
  period              text,
  home_score          int check (home_score is null or home_score >= 0),
  away_score          int check (away_score is null or away_score >= 0),
  scheduled_at        timestamptz not null,
  started_at          timestamptz,
  finished_at         timestamptz,
  venue               text,
  has_live_stream     boolean not null default false,
  result_revision     int not null default 0,
  provider            text,
  provider_id         text,
  provider_updated_at timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  check (home_team_id <> away_team_id)
);
create unique index if not exists matches_provider_unique on nova.matches (provider, provider_id) where provider is not null and provider_id is not null;
create index if not exists matches_status_scheduled_idx on nova.matches (status, scheduled_at);
create index if not exists matches_league_idx on nova.matches (league_id, scheduled_at);
create index if not exists matches_sport_idx on nova.matches (sport_id, status, scheduled_at);
drop trigger if exists matches_updated_at on nova.matches;
create trigger matches_updated_at before update on nova.matches for each row execute function nova.set_updated_at();

create table if not exists nova.match_periods (
  id          uuid primary key default gen_random_uuid(),
  match_id    uuid not null references nova.matches (id) on delete cascade,
  period      text not null,
  home_score  int,
  away_score  int,
  started_at  timestamptz,
  ended_at    timestamptz,
  unique (match_id, period)
);

create table if not exists nova.match_events (
  id                uuid primary key default gen_random_uuid(),
  match_id          uuid not null references nova.matches (id) on delete cascade,
  provider_event_id text,
  type              text not null,
  minute            int,
  period            text,
  team_id           uuid references nova.teams (id),
  player_name       text,
  detail            text,
  occurred_at       timestamptz not null default now(),
  created_at        timestamptz not null default now()
);
create unique index if not exists match_events_provider_unique on nova.match_events (match_id, provider_event_id) where provider_event_id is not null;
create index if not exists match_events_match_idx on nova.match_events (match_id, minute);

create table if not exists nova.match_stats (
  match_id      uuid primary key references nova.matches (id) on delete cascade,
  payload       jsonb not null default '{}'::jsonb,
  provider      text,
  updated_at    timestamptz not null default now()
);

-- ------------------------------------------------------------------- results
create table if not exists nova.match_results (
  id                uuid primary key default gen_random_uuid(),
  match_id          uuid not null references nova.matches (id) on delete cascade,
  revision          int not null default 1,
  status            text not null check (status in ('finished','cancelled','abandoned','postponed','interrupted','corrected')),
  home_score        int,
  away_score        int,
  home_half_score   int,
  away_half_score   int,
  home_corners      int,
  away_corners      int,
  home_cards        int,
  away_cards        int,
  extra_time        boolean not null default false,
  penalties         boolean not null default false,
  penalty_home      int,
  penalty_away      int,
  provider          text not null,
  provider_result_id text,
  authoritative     boolean not null default false,
  observed_at       timestamptz not null default now(),
  created_by        uuid references nova.profiles (id),
  created_at        timestamptz not null default now(),
  unique (match_id, revision)
);
create index if not exists match_results_match_idx on nova.match_results (match_id, revision desc);

-- latest authoritative result per match (used by the settlement engine)
create or replace view nova.current_match_results as
select distinct on (match_id) *
from nova.match_results
order by match_id, revision desc;

comment on view nova.current_match_results is 'Authoritative, latest-revision match result per match.';

-- ------------------------------------------------------------------- favorites
create table if not exists nova.favorites (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references nova.profiles (id) on delete cascade,
  entity_type text not null check (entity_type in ('match','team','league','sport')),
  entity_id   uuid not null,
  created_at  timestamptz not null default now(),
  unique (user_id, entity_type, entity_id)
);
create index if not exists favorites_user_idx on nova.favorites (user_id, entity_type);
