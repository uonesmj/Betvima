-- Missing LIVE_BETTING configuration must never allow live wager placement.
-- Preserve the existing default for other operation keys.
create or replace function nova.operation_enabled(p_key text) returns boolean
language sql stable
security definer
set search_path = nova, public
as $$
  select coalesce(
           (select enabled from nova.system_operations where key = p_key),
           p_key <> 'LIVE_BETTING'
         )
     and coalesce((select enabled from nova.system_operations where key = 'GLOBAL'), true)
$$;
