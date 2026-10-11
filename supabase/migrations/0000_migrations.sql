-- =====================================================================
-- 0000: migration bookkeeping table.
--
-- `scripts/db-migrate.sh` records every applied migration here (filename + SHA-256 checksum +
-- duration) and refuses to re-apply a file whose checksum changed, so a deployed migration is
-- immutable. The table is defined in SQL as well (not only in the shell script) so that a
-- database built directly from `supabase/migrations` - CI, the SQL test suite, a restore
-- rehearsal - has exactly the same shape as a database built by the migration runner.
--
-- It is infrastructure: RLS is enabled in migration 0150 with no policy, i.e. service role only.
-- =====================================================================
create schema if not exists nova;

create table if not exists nova.migrations (
  filename text primary key,
  checksum text not null,
  applied_at timestamptz not null default now(),
  duration_ms int,
  baseline boolean not null default false
);

comment on table nova.migrations is
  'Applied migrations with checksums. Written by scripts/db-migrate.sh; never edited by hand.';
