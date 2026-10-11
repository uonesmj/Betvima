-- 0196: persistent logo cache for the logo pipeline (positive + negative entries).
--
-- The logo worker resolves REAL team/league badges from free sources (ESPN,
-- TheSportsDB) and stores them here so workers and the web tier never hammer
-- the upstream APIs. A NULL logo_url is a *confirmed miss* (negative cache):
-- no real badge exists for that name, so callers must not retry until expiry.
-- Only verified http(s) image URLs are ever stored here — never placeholders.

create table if not exists nova.logo_cache (
  id          uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('team', 'league')),
  sport       text not null,
  name_key    text not null,
  name        text not null,
  logo_url    text,
  source      text,
  verified_at timestamptz,
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (entity_type, sport, name_key)
);

create index if not exists logo_cache_lookup_idx
  on nova.logo_cache (entity_type, sport, name_key);

drop trigger if exists logo_cache_updated_at on nova.logo_cache;
create trigger logo_cache_updated_at
  before update on nova.logo_cache
  for each row execute function nova.set_updated_at();
