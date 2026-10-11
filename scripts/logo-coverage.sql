-- Logo coverage report — run in the Supabase SQL editor or with psql.
-- Answers: how many teams/leagues exist in total, and how many carry a REAL logo.

-- 1) Totals
select
  'teams'   as entity,
  count(*)::int                                               as total,
  count(*) filter (where logo is not null and logo <> '')::int as with_logo,
  count(*) filter (where logo is null or logo = '')::int       as missing
from nova.teams
union all
select
  'leagues' as entity,
  count(*)::int,
  count(*) filter (where logo is not null and logo <> '')::int,
  count(*) filter (where logo is null or logo = '')::int
from nova.leagues;

-- 2) Per sport
select
  s.slug as sport,
  count(*)::int                                                as teams,
  count(*) filter (where t.logo is not null and t.logo <> '')::int as with_logo,
  round(100.0 * count(*) filter (where t.logo is not null and t.logo <> '') / greatest(count(*), 1), 1) as coverage_pct
from nova.teams t
join nova.sports s on s.id = t.sport_id
group by s.slug
order by teams desc;

-- 3) Leagues missing a logo (top 30 by match volume)
select l.slug, l.name, s.slug as sport, count(m.id)::int as matches
from nova.leagues l
join nova.sports s on s.id = l.sport_id
left join nova.matches m on m.league_id = l.id
where l.logo is null or l.logo = ''
group by l.slug, l.name, s.slug
order by matches desc
limit 30;

-- 4) Cache state (how many names resolved vs confirmed misses)
select
  entity_type,
  count(*)::int                                              as names_cached,
  count(*) filter (where logo_url is not null)::int           as resolved,
  count(*) filter (where logo_url is null)::int               as confirmed_misses,
  count(*) filter (where expires_at < now())::int             as expired
from nova.logo_cache
group by entity_type;
