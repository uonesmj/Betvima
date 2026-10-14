-- 0197: lookup index for the logo worker's negative-cache filter.
--
-- The sweep selects teams/leagues with no logo while excluding names that are
-- already recorded as confirmed misses (`logo_cache.logo_url is null`). That
-- filter joins on the original name, so it needs its own index: the existing
-- unique key is (entity_type, sport, name_key) and cannot serve a lookup by
-- the raw name.

create index if not exists logo_cache_name_lookup_idx
  on nova.logo_cache (entity_type, sport, name);
