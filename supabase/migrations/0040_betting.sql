-- ============================================================================
-- 0040 - BETS, LEGS, SETTLEMENTS, RISK, AUDIT, OPERATIONS
-- ============================================================================

create table if not exists nova.bets (
  id                        uuid primary key default gen_random_uuid(),
  public_id                 text not null unique,
  user_id                   uuid not null references nova.profiles (id) on delete restrict,
  type                      bet_type not null,
  status                    bet_status not null default 'accepted',
  stake_minor               bigint not null check (stake_minor > 0),
  currency                  text not null,
  potential_payout_minor    bigint not null check (potential_payout_minor >= 0),
  payout_minor              bigint,
  combined_odds_num         numeric not null,
  combined_odds_den         numeric not null,
  combined_odds_scaled      bigint not null,
  placement_idempotency_key text not null,
  campaign                  text,
  device                    text,
  affiliate_id              uuid,
  attribution_id            uuid,
  settlement_attempts       int not null default 0,
  result_revision           int not null default 0,
  requested_snapshot        jsonb not null default '{}'::jsonb,
  accepted_odds_change      boolean not null default false,
  client_ip_hash            text,
  user_agent                text,
  placed_at                 timestamptz not null default now(),
  settled_at                timestamptz,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  unique (user_id, placement_idempotency_key)
);
create index if not exists bets_user_idx on nova.bets (user_id, placed_at desc);
create index if not exists bets_status_idx on nova.bets (status, placed_at desc);
create index if not exists bets_settlement_queue_idx on nova.bets (status) where status in ('accepted','partially_settled','manual_review');
drop trigger if exists bets_updated_at on nova.bets;
create trigger bets_updated_at before update on nova.bets for each row execute function nova.set_updated_at();

-- Historical financial columns on a bet are protected: only the settlement
-- functions may move a bet to a terminal state (enforced in nova.settle_bet).
create table if not exists nova.bet_legs (
  id                 uuid primary key default gen_random_uuid(),
  bet_id             uuid not null references nova.bets (id) on delete cascade,
  match_id           uuid not null references nova.matches (id),
  market_id          uuid not null references nova.markets (id),
  selection_id       uuid not null references nova.selections (id),
  odds_at_placement  bigint not null check (odds_at_placement >= 10100),
  accepted_odds      bigint not null check (accepted_odds >= 10100),
  odds_version_seen  int not null,
  status             bet_leg_status not null default 'pending',
  grade_reason       text,
  void_reason        text,
  score_snapshot     text,
  result_revision    int,
  settled_at         timestamptz,
  selection_name     text not null,
  market_name        text not null,
  match_label        text not null,
  created_at         timestamptz not null default now(),
  unique (bet_id, selection_id)
);
create index if not exists bet_legs_bet_idx on nova.bet_legs (bet_id);
create index if not exists bet_legs_selection_idx on nova.bet_legs (selection_id, status);
create index if not exists bet_legs_match_idx on nova.bet_legs (match_id, status);

comment on column nova.bet_legs.odds_at_placement is
  'Authoritative odds captured server-side at placement. Client-supplied odds are never stored here (rule 24).';

-- ------------------------------------------------------------- settlements
create table if not exists nova.bet_settlements (
  id                  uuid primary key default gen_random_uuid(),
  bet_id              uuid not null references nova.bets (id) on delete cascade,
  revision            int not null,
  kind                text not null default 'settlement' check (kind in ('settlement','reversal','adjustment')),
  status_before       bet_status not null,
  status_after        bet_status not null,
  payout_minor        bigint not null,
  currency            text not null,
  stake_minor         bigint not null,
  net_user_result_minor bigint not null,
  graded_legs         jsonb not null default '[]'::jsonb,
  wallet_transaction_id uuid references nova.wallet_transactions (id),
  reversal_of         uuid references nova.bet_settlements (id),
  reversed_by         uuid references nova.bet_settlements (id),
  settled_by          text not null,
  operator_id         uuid references nova.profiles (id),
  correlation_id      text,
  notes               text,
  created_at          timestamptz not null default now(),
  unique (bet_id, revision, kind)
);
create index if not exists bet_settlements_bet_idx on nova.bet_settlements (bet_id, revision desc);

/**
 * Settlement rows are append-only. The ONLY permitted mutation is writing the
 * `reversed_by` pointer exactly once (linking a reversal), and only when every
 * financial column is byte-identical. Deletes are never allowed.
 */
create or replace function nova.guard_bet_settlement_mutation() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'IMMUTABLE_RECORD: bet_settlements cannot be deleted' using errcode = '42501';
  end if;
  if old.reversed_by is not null then
    raise exception 'IMMUTABLE_RECORD: settlement already reversed' using errcode = '42501';
  end if;
  if new.reversed_by is null then
    raise exception 'IMMUTABLE_RECORD: no permitted update for bet_settlements' using errcode = '42501';
  end if;
  if new.id <> old.id or new.bet_id <> old.bet_id or new.revision <> old.revision or new.kind <> old.kind
     or new.payout_minor <> old.payout_minor or new.net_user_result_minor <> old.net_user_result_minor
     or new.status_after <> old.status_after or new.stake_minor <> old.stake_minor
     or new.graded_legs <> old.graded_legs or new.wallet_transaction_id is distinct from old.wallet_transaction_id
     or new.created_at <> old.created_at then
    raise exception 'IMMUTABLE_RECORD: financial columns of bet_settlements cannot change' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists bet_settlements_immutable on nova.bet_settlements;
create trigger bet_settlements_immutable before update or delete on nova.bet_settlements
  for each row execute function nova.guard_bet_settlement_mutation();

create table if not exists nova.settlement_events (
  id             bigserial primary key,
  bet_id         uuid references nova.bets (id) on delete cascade,
  match_id       uuid references nova.matches (id) on delete cascade,
  event          text not null,
  detail         jsonb not null default '{}'::jsonb,
  actor          text,
  correlation_id text,
  created_at     timestamptz not null default now()
);
create index if not exists settlement_events_bet_idx on nova.settlement_events (bet_id, created_at desc);

create table if not exists nova.settlement_jobs (
  id            uuid primary key default gen_random_uuid(),
  bet_id        uuid not null references nova.bets (id) on delete cascade,
  match_id      uuid references nova.matches (id) on delete cascade,
  user_id       uuid not null references nova.profiles (id) on delete cascade,
  status        settlement_job_status not null default 'queued',
  reason        text,
  attempts      int not null default 0,
  last_error    text,
  locked_by     text,
  locked_at     timestamptz,
  run_after     timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  processed_at  timestamptz,
  unique (bet_id, reason)
);
create index if not exists settlement_jobs_claim_idx on nova.settlement_jobs (status, run_after) where status in ('queued','failed');

-- ---------------------------------------------------------------- risk rules
create table if not exists nova.risk_rules (
  id            uuid primary key default gen_random_uuid(),
  scope         text not null check (scope in ('global','sport','league','match','market','user','affiliate')),
  scope_ref     text,
  kind          text not null check (kind in ('min_stake','max_stake','max_payout','max_exposure','max_daily_stake','max_daily_payout','max_live_stake','account_restriction','velocity')),
  value_minor   bigint not null,
  currency      text,
  is_live       boolean,
  action        risk_decision not null default 'REJECT' check (action in ('LIMIT','REJECT','MANUAL_REVIEW')),
  priority      int not null default 100,
  is_active     boolean not null default true,
  reason        text,
  created_by    uuid references nova.profiles (id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists risk_rules_lookup_idx on nova.risk_rules (scope, kind, is_active);
drop trigger if exists risk_rules_updated_at on nova.risk_rules;
create trigger risk_rules_updated_at before update on nova.risk_rules for each row execute function nova.set_updated_at();

create table if not exists nova.risk_decisions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references nova.profiles (id) on delete cascade,
  decision          risk_decision not null,
  reasons           text[] not null default '{}',
  stake_minor       bigint,
  payout_minor      bigint,
  currency          text,
  match_id          uuid,
  market_ids        uuid[],
  rule_ids          uuid[],
  is_live           boolean not null default false,
  bet_id            uuid references nova.bets (id),
  correlation_id    text,
  created_at        timestamptz not null default now()
);
create index if not exists risk_decisions_user_idx on nova.risk_decisions (user_id, created_at desc);
create index if not exists risk_decisions_decision_idx on nova.risk_decisions (decision, created_at desc);

-- ---------------------------------------------------------------- audit log
create table if not exists nova.audit_logs (
  id             bigserial primary key,
  actor_id       uuid references nova.profiles (id) on delete set null,
  actor_role     text,
  action         text not null,
  target_type    text not null,
  target_id      text,
  before_state   jsonb,
  after_state    jsonb,
  reason         text,
  correlation_id text,
  ip_hash        text,
  user_agent     text,
  metadata       jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now()
);
create index if not exists audit_logs_actor_idx on nova.audit_logs (actor_id, created_at desc);
create index if not exists audit_logs_action_idx on nova.audit_logs (action, created_at desc);
create index if not exists audit_logs_target_idx on nova.audit_logs (target_type, target_id, created_at desc);
create index if not exists audit_logs_correlation_idx on nova.audit_logs (correlation_id);

drop trigger if exists audit_logs_immutable on nova.audit_logs;
create trigger audit_logs_immutable before update or delete on nova.audit_logs
  for each row execute function nova.prevent_mutation();

/** Central audit writer. Every privileged/financial action funnels through here. */
create or replace function nova.audit_event(
  p_actor_id uuid,
  p_action text,
  p_target_type text,
  p_target_id text,
  p_before jsonb default null,
  p_after jsonb default null,
  p_reason text default null,
  p_correlation_id text default null,
  p_metadata jsonb default '{}'::jsonb
) returns bigint
language plpgsql
security definer
set search_path = nova, public
as $$
declare v_id bigint;
begin
  insert into nova.audit_logs (actor_id, actor_role, action, target_type, target_id, before_state, after_state, reason, correlation_id, metadata)
  values (
    p_actor_id,
    (select p.role::text from nova.profiles p where p.id = p_actor_id),
    p_action, p_target_type, p_target_id, p_before, p_after, p_reason, p_correlation_id, p_metadata
  )
  returning id into v_id;
  return v_id;
end $$;

-- ---------------------------------------------------------------- operations
create table if not exists nova.system_settings (
  key         text primary key,
  value       jsonb not null,
  description text,
  is_public   boolean not null default false,
  updated_by  uuid references nova.profiles (id),
  updated_at  timestamptz not null default now()
);

create table if not exists nova.feature_flags (
  key         text primary key,
  enabled     boolean not null default false,
  description text,
  is_public   boolean not null default true,
  updated_by  uuid references nova.profiles (id),
  updated_at  timestamptz not null default now()
);

/** Emergency kill switches. Server-side enforced in every money path. */
create table if not exists nova.system_operations (
  key         text primary key,
  enabled     boolean not null default true,   -- true = operation allowed
  reason      text,
  updated_by  uuid references nova.profiles (id),
  updated_at  timestamptz not null default now()
);

create or replace function nova.operation_enabled(p_key text) returns boolean
language sql stable
security definer
set search_path = nova, public
as $$
  select coalesce((select enabled from nova.system_operations where key = p_key), true)
     and coalesce((select enabled from nova.system_operations where key = 'GLOBAL'), true)
$$;

create or replace function nova.maintenance_mode() returns boolean
language sql stable
security definer
set search_path = nova, public
as $$ select coalesce((select enabled from nova.system_operations where key = 'MAINTENANCE_MODE'), false) $$;

create or replace function nova.set_operation(p_key text, p_enabled boolean, p_actor uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = nova, public
as $$
declare v_before boolean;
begin
  perform nova.require_admin();
  select enabled into v_before from nova.system_operations where key = p_key;
  if p_key = 'MAINTENANCE_MODE' then
    raise notice 'maintenance flag toggled';
  end if;
  insert into nova.system_operations (key, enabled, reason, updated_by)
  values (p_key, p_enabled, p_reason, p_actor)
  on conflict (key) do update set enabled = excluded.enabled, reason = excluded.reason, updated_by = excluded.updated_by, updated_at = now();
  perform nova.audit_event(p_actor, 'system.operation.change', 'system_operation', p_key,
    jsonb_build_object('enabled', v_before), jsonb_build_object('enabled', p_enabled), p_reason, null);
end $$;

create table if not exists nova.provider_health (
  provider            text not null,
  kind                text not null check (kind in ('sports','payment','notification')),
  status              text not null default 'unknown' check (status in ('healthy','degraded','unhealthy','disabled','unknown')),
  last_success_at     timestamptz,
  last_error_at       timestamptz,
  last_error          text,
  consecutive_failures int not null default 0,
  latency_ms          int,
  metadata            jsonb not null default '{}'::jsonb,
  updated_at          timestamptz not null default now(),
  primary key (provider, kind)
);

create table if not exists nova.worker_runs (
  id              uuid primary key default gen_random_uuid(),
  worker          text not null,
  job_key         text not null,
  status          text not null check (status in ('running','succeeded','failed','skipped','dead_letter')),
  attempt         int not null default 1,
  items_processed int not null default 0,
  started_at      timestamptz not null default now(),
  finished_at     timestamptz,
  duration_ms     int,
  error           text,
  metadata        jsonb not null default '{}'::jsonb
);
create index if not exists worker_runs_worker_idx on nova.worker_runs (worker, started_at desc);

create table if not exists nova.worker_heartbeats (
  worker_id     text primary key,
  worker        text not null,
  hostname      text,
  pid           int,
  version       text,
  started_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  metadata      jsonb not null default '{}'::jsonb
);

create table if not exists nova.worker_locks (
  lock_key    text primary key,
  worker_id   text not null,
  acquired_at timestamptz not null default now(),
  expires_at  timestamptz not null,
  metadata    jsonb not null default '{}'::jsonb
);

/** Advisory lock helper for workers (no overlapping sync jobs - spec §9). */
create or replace function nova.acquire_worker_lock(p_key text, p_worker_id text, p_ttl_seconds int default 120)
returns boolean
language plpgsql
security definer
set search_path = nova, public
as $$
declare v_acquired boolean := false;
begin
  delete from nova.worker_locks where expires_at < now();
  begin
    insert into nova.worker_locks (lock_key, worker_id, expires_at)
    values (p_key, p_worker_id, now() + make_interval(secs => p_ttl_seconds));
    v_acquired := true;
  exception when unique_violation then
    update nova.worker_locks
       set worker_id = p_worker_id, acquired_at = now(), expires_at = now() + make_interval(secs => p_ttl_seconds)
     where lock_key = p_key and worker_id = p_worker_id;
    v_acquired := found;
  end;
  return v_acquired;
end $$;

create or replace function nova.release_worker_lock(p_key text, p_worker_id text) returns void
language sql security definer set search_path = nova, public as $$
  delete from nova.worker_locks where lock_key = p_key and worker_id = p_worker_id;
$$;

-- Generic durable queue (retries, backoff, dead-letter visibility - spec §66).
create table if not exists nova.job_queue (
  id             uuid primary key default gen_random_uuid(),
  queue          text not null,
  job_key        text not null,
  payload        jsonb not null default '{}'::jsonb,
  status         job_status not null default 'queued',
  attempts       int not null default 0,
  max_attempts   int not null default 5,
  idempotency_key text not null,
  run_after      timestamptz not null default now(),
  locked_by      text,
  locked_at      timestamptz,
  last_error     text,
  created_at     timestamptz not null default now(),
  finished_at    timestamptz,
  unique (queue, idempotency_key)
);
create index if not exists job_queue_claim_idx on nova.job_queue (queue, status, run_after) where status in ('queued','failed');
create index if not exists job_queue_dead_idx on nova.job_queue (queue, status) where status = 'dead_letter';

create or replace function nova.enqueue_job(
  p_queue text, p_job_key text, p_payload jsonb, p_idempotency_key text,
  p_run_at timestamptz default now(), p_max_attempts int default 5
) returns jsonb
language plpgsql security definer set search_path = nova, public as $$
declare v_id uuid; v_dup boolean := false;
begin
  insert into nova.job_queue (queue, job_key, payload, idempotency_key, run_after, max_attempts)
  values (p_queue, p_job_key, p_payload, p_idempotency_key, coalesce(p_run_at, now()), p_max_attempts)
  on conflict (queue, idempotency_key) do nothing
  returning id into v_id;
  if v_id is null then
    select id into v_id from nova.job_queue where queue = p_queue and idempotency_key = p_idempotency_key;
    v_dup := true;
  end if;
  return jsonb_build_object('id', v_id, 'duplicate', v_dup);
end $$;

create or replace function nova.claim_jobs(p_queue text, p_worker_id text, p_limit int, p_lock_ttl_seconds int default 300)
returns setof nova.job_queue
language plpgsql security definer set search_path = nova, public as $$
begin
  return query
  with claimed as (
    select id from nova.job_queue
     where queue = p_queue
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

create or replace function nova.complete_job(p_job_id uuid, p_status text, p_error text default null)
returns void
language plpgsql security definer set search_path = nova, public as $$
declare v_attempts int; v_max int;
begin
  select attempts, max_attempts into v_attempts, v_max from nova.job_queue where id = p_job_id;
  if p_status = 'succeeded' then
    update nova.job_queue set status = 'succeeded', finished_at = now(), last_error = null where id = p_job_id;
  elsif p_status = 'failed' and v_attempts < v_max then
    update nova.job_queue
       set status = 'failed', last_error = p_error, locked_by = null,
           run_after = now() + make_interval(secs => least(3600, (power(2, v_attempts)::int * 5)))
     where id = p_job_id;
  else
    update nova.job_queue set status = 'dead_letter', last_error = p_error, finished_at = now() where id = p_job_id;
  end if;
end $$;

-- ---------------------------------------------------------- idempotency + rate limit
create table if not exists nova.idempotency_keys (
  scope         text not null,
  key           text not null,
  user_id       uuid,
  request_hash  text,
  response      jsonb,
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null default now() + interval '24 hours',
  primary key (scope, key)
);

create table if not exists nova.rate_limit_buckets (
  bucket        text not null,
  window_start  timestamptz not null,
  hits          int not null default 0,
  primary key (bucket, window_start)
);
create index if not exists rate_limit_window_idx on nova.rate_limit_buckets (window_start);

/** Fixed-window distributed rate limiter. Returns true when the request is allowed. */
create or replace function nova.check_rate_limit(p_bucket text, p_limit int, p_window_seconds int)
returns boolean
language plpgsql security definer set search_path = nova, public as $$
declare
  v_window timestamptz;
  v_hits int;
begin
  v_window := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  insert into nova.rate_limit_buckets (bucket, window_start, hits)
  values (p_bucket, v_window, 1)
  on conflict (bucket, window_start) do update set hits = nova.rate_limit_buckets.hits + 1
  returning hits into v_hits;
  return v_hits <= p_limit;
end $$;

delete from nova.rate_limit_buckets where window_start < now() - interval '1 day';

-- ---------------------------------------------------------------- notifications
create table if not exists nova.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references nova.profiles (id) on delete cascade,
  type        notification_type not null,
  title       text not null,
  body        text not null,
  link_path   text,
  data        jsonb not null default '{}'::jsonb,
  channel     text not null default 'in_app' check (channel in ('in_app','email','sms','push')),
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists notifications_user_idx on nova.notifications (user_id, created_at desc);
create index if not exists notifications_unread_idx on nova.notifications (user_id) where read_at is null;

create table if not exists nova.notification_deliveries (
  id                 uuid primary key default gen_random_uuid(),
  notification_id    uuid not null references nova.notifications (id) on delete cascade,
  channel            text not null check (channel in ('email','sms','push')),
  provider           text not null,
  status             text not null default 'pending' check (status in ('pending','sent','failed','skipped_disabled','not_applicable')),
  attempts           int not null default 0,
  provider_message_id text,
  error              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (notification_id, channel, provider)
);

-- ---------------------------------------------------------------- promotions
create table if not exists nova.promotions (
  id                 uuid primary key default gen_random_uuid(),
  slug               text not null unique,
  title              text not null,
  title_fa           text,
  description        text,
  type               text not null check (type in ('bonus','free_bet','cashback','odds_boost','loyalty')),
  currency           text,
  amount_minor       bigint,
  percentage_bps     int,
  wagering_multiplier numeric,
  min_deposit_minor  bigint,
  max_bonus_minor    bigint,
  starts_at          timestamptz,
  ends_at            timestamptz,
  is_active          boolean not null default false,
  requires_flag      text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
drop trigger if exists promotions_updated_at on nova.promotions;
create trigger promotions_updated_at before update on nova.promotions for each row execute function nova.set_updated_at();

create table if not exists nova.user_promotions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references nova.profiles (id) on delete cascade,
  promotion_id   uuid not null references nova.promotions (id) on delete cascade,
  status         text not null default 'granted' check (status in ('granted','active','completed','expired','cancelled')),
  wagering_progress_minor bigint not null default 0,
  granted_at     timestamptz not null default now(),
  expires_at     timestamptz,
  unique (user_id, promotion_id)
);

create table if not exists nova.bonus_ledger (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references nova.profiles (id) on delete cascade,
  promotion_id   uuid references nova.promotions (id),
  type           text not null check (type in ('grant','wagering','forfeit','expiry','conversion','reversal')),
  amount_minor   bigint not null,
  currency       text not null,
  wagering_remaining_minor bigint,
  idempotency_key text not null unique,
  reason         text,
  created_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------- reconciliation
create table if not exists nova.reconciliation_records (
  id                uuid primary key default gen_random_uuid(),
  period_start      timestamptz not null,
  period_end        timestamptz not null,
  check_key         text not null,
  expected_minor    bigint not null,
  actual_minor      bigint not null,
  difference_minor  bigint not null,
  status            reconciliation_status not null default 'ok',
  details           jsonb not null default '{}'::jsonb,
  affected_entities jsonb not null default '[]'::jsonb,
  created_at        timestamptz not null default now(),
  resolved_at       timestamptz,
  resolved_by       uuid references nova.profiles (id),
  resolution_note   text,
  unique (period_start, period_end, check_key)
);
create index if not exists reconciliation_status_idx on nova.reconciliation_records (status, created_at desc);
