-- ============================================================================
-- 0152 - WORKER JOB OWNERSHIP HARDENING
--
-- A worker may only complete/retry a job that it currently owns.
-- This prevents one worker from completing another worker's processing job.
-- ============================================================================

drop function if exists nova.complete_job(uuid, text, text);

create or replace function nova.complete_job(
  p_job_id uuid,
  p_worker_id text,
  p_status text,
  p_error text default null,
  p_retry_in_ms int default null
)
returns void
language plpgsql
security definer
set search_path = nova, public
as $$
declare
  v_attempts int;
  v_max int;
  v_status job_status;
begin
  select status, attempts, max_attempts
    into v_status, v_attempts, v_max
    from nova.job_queue
   where id = p_job_id
     and locked_by = p_worker_id
   for update;

  if not found then
    raise exception 'JOB_NOT_OWNED'
      using errcode = '42501';
  end if;

  if v_status <> 'processing' then
    raise exception 'JOB_NOT_PROCESSING'
      using errcode = '55000';
  end if;

  if p_status = 'succeeded' then

    update nova.job_queue
       set status = 'succeeded',
           finished_at = now(),
           last_error = null,
           locked_by = null,
           locked_at = null
     where id = p_job_id
       and locked_by = p_worker_id
       and status = 'processing';

  elsif p_status = 'failed' and v_attempts < v_max then

    update nova.job_queue
       set status = 'failed',
           last_error = p_error,
           locked_by = null,
           locked_at = null,
           run_after = now() +
             make_interval(
               secs => greatest(
                 1,
                 ceil(
                   coalesce(
                     p_retry_in_ms,
                     least(3600000, power(2, v_attempts) * 5 * 1000)
                   ) / 1000.0
                 )::int
               )
             )
     where id = p_job_id
       and locked_by = p_worker_id
       and status = 'processing';

  else

    update nova.job_queue
       set status = 'dead_letter',
           last_error = p_error,
           finished_at = now(),
           locked_by = null,
           locked_at = null
     where id = p_job_id
       and locked_by = p_worker_id
       and status = 'processing';

  end if;

end $$;

comment on function nova.complete_job(uuid, text, text, text, int) is
  'Completes a job only when the caller owns its active processing lease.';
