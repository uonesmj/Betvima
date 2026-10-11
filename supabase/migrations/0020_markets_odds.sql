-- ============================================================================
-- 0020 - MARKETS, SELECTIONS, ODDS + ODDS HISTORY
-- Current odds live on the selection row (single source for betting);
-- every change is appended to nova.odds_history (immutable audit + movement).
-- ============================================================================

create table if not exists nova.markets (
  id                uuid primary key default gen_random_uuid(),
  match_id          uuid not null references nova.matches (id) on delete cascade,
  key               text not null,
  type              text not null,
  name              text not null,
  name_fa           text,
  status            market_status not null default 'open',
  specifier         text,
  period            text,
  display_order     int not null default 100,
  is_live           boolean not null default false,
  provider          text,
  provider_market_id text,
  suspended_reason  text,
  suspended_at      timestamptz,
  settled_at        timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (match_id, key)
);
create index if not exists markets_match_idx on nova.markets (match_id, display_order);
create index if not exists markets_status_idx on nova.markets (status, is_live);
drop trigger if exists markets_updated_at on nova.markets;
create trigger markets_updated_at before update on nova.markets for each row execute function nova.set_updated_at();

create table if not exists nova.selections (
  id                uuid primary key default gen_random_uuid(),
  market_id         uuid not null references nova.markets (id) on delete cascade,
  match_id          uuid not null references nova.matches (id) on delete cascade,
  code              text not null,
  name              text not null,
  name_fa           text,
  line              text,
  participant_type  text not null default 'NEUTRAL' check (participant_type in ('HOME','AWAY','DRAW','NEUTRAL','PLAYER','OTHER')),
  status            selection_status not null default 'open',
  odds_scaled       bigint check (odds_scaled is null or odds_scaled >= 10100),
  previous_odds_scaled bigint,
  odds_version      int not null default 0,
  odds_updated_at   timestamptz,
  provider          text,
  provider_selection_id text,
  provider_timestamp timestamptz,
  is_live           boolean not null default false,
  anomaly_codes     text[] not null default '{}',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (market_id, code)
);
create index if not exists selections_market_idx on nova.selections (market_id, status);
create index if not exists selections_match_idx on nova.selections (match_id);
drop trigger if exists selections_updated_at on nova.selections;
create trigger selections_updated_at before update on nova.selections for each row execute function nova.set_updated_at();

create table if not exists nova.odds_history (
  id                  bigserial primary key,
  selection_id        uuid not null references nova.selections (id) on delete cascade,
  provider            text not null,
  odds_scaled         bigint not null check (odds_scaled >= 10100),
  previous_odds_scaled bigint,
  odds_version        int not null,
  status              selection_status not null,
  is_live             boolean not null default false,
  provider_timestamp  timestamptz not null,
  ingested_at         timestamptz not null default now(),
  anomalies           text[] not null default '{}',
  rejected            boolean not null default false,
  reject_reason       text,
  ingest_key          text not null,
  unique (selection_id, ingest_key)
);
create index if not exists odds_history_selection_idx on nova.odds_history (selection_id, ingested_at desc);
create index if not exists odds_history_rejected_idx on nova.odds_history (rejected, ingested_at desc);

-- Immutable after insert (rule 17): an odds record is a fact, not a mutable row.
drop trigger if exists odds_history_immutable on nova.odds_history;
create trigger odds_history_immutable before update or delete on nova.odds_history
  for each row execute function nova.prevent_mutation();

comment on table nova.odds_history is
  'Append-only odds audit trail. Rejections are recorded with rejected=true + reason; suspicious ticks never reach nova.selections.';

/** Publish an odds tick: the ONLY write path allowed to change current odds. */
create or replace function nova.publish_odds_tick(
  p_selection_id uuid,
  p_odds_scaled bigint,
  p_provider text,
  p_provider_timestamp timestamptz,
  p_is_live boolean,
  p_ingest_key text,
  p_anomalies text[] default '{}',
  p_reject boolean default false,
  p_reject_reason text default null,
  p_suspend boolean default false
) returns jsonb
language plpgsql
security definer
set search_path = nova, public
as $$
declare
  v_sel nova.selections%rowtype;
  v_inserted boolean := false;
  v_new_version int;
begin
  select * into v_sel from nova.selections where id = p_selection_id for update;
  if not found then
    raise exception 'SELECTION_NOT_FOUND: %', p_selection_id using errcode = 'P0002';
  end if;

  if exists (select 1 from nova.odds_history where selection_id = p_selection_id and ingest_key = p_ingest_key) then
    return jsonb_build_object('accepted', false, 'duplicate', true, 'odds_version', v_sel.odds_version);
  end if;

  if p_reject then
    insert into nova.odds_history (selection_id, provider, odds_scaled, previous_odds_scaled, odds_version,
      status, is_live, provider_timestamp, anomalies, rejected, reject_reason, ingest_key)
    values (p_selection_id, p_provider, greatest(coalesce(p_odds_scaled, 10100), 10100), v_sel.odds_scaled, v_sel.odds_version,
      v_sel.status, p_is_live, p_provider_timestamp, p_anomalies, true, p_reject_reason, p_ingest_key);
    return jsonb_build_object('accepted', false, 'rejected', true, 'reason', p_reject_reason, 'odds_version', v_sel.odds_version);
  end if;

  v_new_version := v_sel.odds_version + 1;
  insert into nova.odds_history (selection_id, provider, odds_scaled, previous_odds_scaled, odds_version,
    status, is_live, provider_timestamp, anomalies, rejected, ingest_key)
  values (p_selection_id, p_provider, p_odds_scaled, v_sel.odds_scaled, v_new_version,
    case when p_suspend then 'suspended'::selection_status else v_sel.status end, p_is_live, p_provider_timestamp,
    p_anomalies, false, p_ingest_key);

  update nova.selections
     set odds_scaled = p_odds_scaled,
         previous_odds_scaled = v_sel.odds_scaled,
         odds_version = v_new_version,
         odds_updated_at = now(),
         provider = p_provider,
         provider_timestamp = p_provider_timestamp,
         is_live = p_is_live,
         anomaly_codes = p_anomalies,
         status = case when p_suspend then 'suspended'::selection_status else status end
   where id = p_selection_id;
  v_inserted := true;

  return jsonb_build_object('accepted', true, 'duplicate', false, 'odds_version', v_new_version, 'updated', v_inserted);
end $$;

revoke all on function nova.publish_odds_tick(uuid, bigint, text, timestamptz, boolean, text, text[], boolean, text, boolean) from public;
grant execute on function nova.publish_odds_tick(uuid, bigint, text, timestamptz, boolean, text, text[], boolean, text, boolean) to service_role;

/** Stale-odds sweep: suspends selections whose feed has gone quiet (never silently keeps them open). */
create or replace function nova.suspend_stale_selections(
  p_live_max_age_seconds int default 12,
  p_prematch_max_age_seconds int default 45
) returns int
language plpgsql
security definer
set search_path = nova, public
as $$
declare v_count int;
begin
  with stale as (
    update nova.selections s
       set status = 'suspended', anomaly_codes = array_append(s.anomaly_codes, 'STALE_ODDS')
     where s.status = 'open'
       and s.odds_updated_at is not null
       and s.odds_updated_at < now() - make_interval(secs => case when s.is_live then p_live_max_age_seconds else p_prematch_max_age_seconds end)
       and not ('STALE_ODDS' = any(s.anomaly_codes))
    returning 1
  )
  select count(*) into v_count from stale;
  return v_count;
end $$;
