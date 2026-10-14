-- The hosted BetVima Supabase PostgreSQL supports pg_cron.
-- Install the scheduler extension only where available. A disposable PostgreSQL
-- test container may not provide it; the financial SQL engine tests remain valid.
-- This migration installs no jobs and never credits money.
do $$
begin
  if exists (select 1 from pg_available_extensions where name='pg_cron') then
    execute 'create extension if not exists pg_cron with schema pg_catalog';
  else
    raise notice 'pg_cron not available; use reviewed external Monday systemd timer';
  end if;
end $$;
