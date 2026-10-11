-- ============================================================================
-- 0156 - SETTLEMENT JOB LEASE RENEWAL
--
-- Extends a settlement job lease only while the caller still owns a
-- processing job. Ownership is checked atomically in the UPDATE predicate.
-- ============================================================================

create or replace function nova.renew_settlement_job_lease(
  p_job_id uuid,
  p_worker_id text,
  p_lease_seconds int default 300
)
returns boolean
language plpgsql
security definer
set search_path = nova, public
as $$
begin
  if p_lease_seconds < 1 then
    raise exception 'INVALID_LEASE_SECONDS'
      using errcode = '22023';
  end if;

  update nova.settlement_jobs
     set locked_at = now()
   where id = p_job_id
     and locked_by = p_worker_id
     and status = 'processing';

  return found;
end;
$$;

comment on function nova.renew_settlement_job_lease(uuid, text, int) is
  'Renews a processing settlement job lease only for its current owner.';
