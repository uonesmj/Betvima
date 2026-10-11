create index if not exists worker_locks_expires_at_idx
  on nova.worker_locks (expires_at);

create or replace function nova.acquire_worker_lock(
  p_key text,
  p_worker_id text,
  p_ttl_seconds int default 120
)
returns boolean
language plpgsql
security definer
set search_path = nova, public
as $$
declare
  v_now timestamptz := now();
  v_expires timestamptz := v_now + make_interval(secs => greatest(1, p_ttl_seconds));
begin
  insert into nova.worker_locks (
    lock_key,
    worker_id,
    acquired_at,
    expires_at
  )
  values (
    p_key,
    p_worker_id,
    v_now,
    v_expires
  )
  on conflict (lock_key) do update
    set worker_id = excluded.worker_id,
        acquired_at = excluded.acquired_at,
        expires_at = excluded.expires_at
  where nova.worker_locks.worker_id = excluded.worker_id
     or nova.worker_locks.expires_at < v_now;

  return exists (
    select 1
      from nova.worker_locks
     where lock_key = p_key
       and worker_id = p_worker_id
       and expires_at > v_now
  );
end
$$;

create or replace function nova.release_worker_lock(
  p_key text,
  p_worker_id text
)
returns void
language sql
security definer
set search_path = nova, public
as $$
  delete from nova.worker_locks
   where lock_key = p_key
     and worker_id = p_worker_id;
$$;
