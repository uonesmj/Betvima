-- ============================================================================
-- 0153 - SETTLEMENT JOB OWNERSHIP HARDENING
--
-- A settlement worker may only complete/retry a job that it currently owns.
-- ============================================================================

create or replace function nova.complete_settlement_job(
  p_job_id uuid,
  p_worker_id text,
  p_status nova.settlement_job_status,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = nova, public
as $$
declare
  v_status nova.settlement_job_status;
begin
  select status
    into v_status
    from nova.settlement_jobs
   where id = p_job_id
     and locked_by = p_worker_id
   for update;

  if not found then
    raise exception 'SETTLEMENT_JOB_NOT_OWNED'
      using errcode = '42501';
  end if;

  if v_status <> 'processing' then
    raise exception 'SETTLEMENT_JOB_NOT_PROCESSING'
      using errcode = '55000';
  end if;

  update nova.settlement_jobs
     set status = p_status,
         processed_at = case
           when p_status in ('done', 'skipped', 'manual_review')
           then now()
           else processed_at
         end,
         last_error = case
           when p_error is null then last_error
           else p_error
         end,
         locked_by = null,
         locked_at = null
   where id = p_job_id
     and locked_by = p_worker_id
     and status = 'processing';
end;
$$;

comment on function nova.complete_settlement_job(
  uuid,
  text,
  nova.settlement_job_status,
  text
) is
  'Completes a settlement job only when the caller owns its active processing lease.';
