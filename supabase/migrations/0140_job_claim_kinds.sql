-- =====================================================================
-- 0140: claim_jobs() must filter by job kind INSIDE the lock.
--
-- Previously a worker claimed rows first and filtered by kind in application code.
-- Any claimed-but-unmatched row stayed locked to that worker until the lock TTL
-- expired, which stalled those jobs. The kind filter now participates in the
-- `for update skip locked` selection, so a worker can only ever lock jobs it can run.
--
-- Signature note: the old 4-argument function is dropped explicitly, otherwise the new
-- 5-argument version (with defaults) would overload it and positional calls would be
-- ambiguous.
-- =====================================================================
drop function if exists nova.claim_jobs(text, text, int, int);

create or replace function nova.claim_jobs(
  p_queue text,
  p_worker_id text,
  p_limit int,
  p_lock_ttl_seconds int default 300,
  p_kinds text[] default null
)
returns setof nova.job_queue
language plpgsql security definer set search_path = nova, public as $$
begin
  return query
  with claimed as (
    select id from nova.job_queue
     where queue = p_queue
       and (p_kinds is null or cardinality(p_kinds) = 0 or job_key = any(p_kinds))
       and run_after <= now()
       and (status = 'queued' or (status = 'failed' and attempts < max_attempts)
            or (status = 'processing' and locked_at < now() - make_interval(secs => p_lock_ttl_seconds)))
     order by run_after
     limit p_limit
     for update skip locked
  )
  update nova.job_queue q
     set status = 'processing', locked_by = p_worker_id, locked_at = now(), attempts = q.attempts + 1
    from claimed c
   where q.id = c.id
  returning q.*;
end $$;

comment on function nova.claim_jobs(text, text, int, int, text[]) is
  'Atomically claims due jobs for a worker. Optional p_kinds restricts the claim to the job kinds the worker actually handles, so nothing is locked by a worker that cannot run it.';
