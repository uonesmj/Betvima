-- 0183 - prevent stale provider observations from overwriting current odds
-- Stale observations are retained in odds_history for audit, but must not
-- advance selection freshness or replace the current bettable odds.

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
as $function$
declare
  v_sel nova.selections%rowtype;
  v_inserted boolean := false;
  v_new_version int;
  v_stale boolean := 'STALE_TIMESTAMP' = any(coalesce(p_anomalies, '{}'::text[]));
begin
  select *
    into v_sel
    from nova.selections
   where id = p_selection_id
   for update;

  if not found then
    raise exception 'SELECTION_NOT_FOUND: %', p_selection_id using errcode = 'P0002';
  end if;

  if exists (
    select 1
      from nova.odds_history
     where selection_id = p_selection_id
       and ingest_key = p_ingest_key
  ) then
    return jsonb_build_object(
      'accepted', false,
      'duplicate', true,
      'odds_version', v_sel.odds_version
    );
  end if;

  if p_reject then
    insert into nova.odds_history (
      selection_id,
      provider,
      odds_scaled,
      previous_odds_scaled,
      odds_version,
      status,
      is_live,
      provider_timestamp,
      anomalies,
      rejected,
      reject_reason,
      ingest_key
    )
    values (
      p_selection_id,
      p_provider,
      greatest(coalesce(p_odds_scaled, 10100), 10100),
      v_sel.odds_scaled,
      v_sel.odds_version,
      v_sel.status,
      p_is_live,
      p_provider_timestamp,
      p_anomalies,
      true,
      p_reject_reason,
      p_ingest_key
    );

    return jsonb_build_object(
      'accepted', false,
      'rejected', true,
      'reason', p_reject_reason,
      'odds_version', v_sel.odds_version
    );
  end if;

  /*
   * A stale provider observation is an audit event, not a new current
   * odds version. Never let it advance odds_updated_at, provider_timestamp,
   * odds_version or current odds. This preserves the last known valid quote
   * and lets suspend_stale_selections decide when that quote is actually
   * too old to remain bettable.
   */
  if v_stale then
    insert into nova.odds_history (
      selection_id,
      provider,
      odds_scaled,
      previous_odds_scaled,
      odds_version,
      status,
      is_live,
      provider_timestamp,
      anomalies,
      rejected,
      reject_reason,
      ingest_key
    )
    values (
      p_selection_id,
      p_provider,
      p_odds_scaled,
      v_sel.odds_scaled,
      v_sel.odds_version,
      v_sel.status,
      p_is_live,
      p_provider_timestamp,
      p_anomalies,
      false,
      null,
      p_ingest_key
    );

    return jsonb_build_object(
      'accepted', false,
      'duplicate', false,
      'stale', true,
      'odds_version', v_sel.odds_version,
      'updated', false
    );
  end if;

  v_new_version := v_sel.odds_version + 1;

  insert into nova.odds_history (
    selection_id,
    provider,
    odds_scaled,
    previous_odds_scaled,
    odds_version,
    status,
    is_live,
    provider_timestamp,
    anomalies,
    rejected,
    reject_reason,
    ingest_key
  )
  values (
    p_selection_id,
    p_provider,
    p_odds_scaled,
    v_sel.odds_scaled,
    v_new_version,
    case
      when p_suspend then 'suspended'::selection_status
      else v_sel.status
    end,
    p_is_live,
    p_provider_timestamp,
    p_anomalies,
    false,
    null,
    p_ingest_key
  );

  update nova.selections
     set odds_scaled = p_odds_scaled,
         previous_odds_scaled = v_sel.odds_scaled,
         odds_version = v_new_version,
         odds_updated_at = now(),
         provider = p_provider,
         provider_timestamp = p_provider_timestamp,
         is_live = p_is_live,
         anomaly_codes = p_anomalies,
         status = case
           when p_suspend then 'suspended'::selection_status
           else 'open'::selection_status
         end
   where id = p_selection_id;

  v_inserted := true;

  return jsonb_build_object(
    'accepted', true,
    'duplicate', false,
    'stale', false,
    'odds_version', v_new_version,
    'updated', v_inserted
  );
end
$function$;

revoke all on function nova.publish_odds_tick(
  uuid,
  bigint,
  text,
  timestamptz,
  boolean,
  text,
  text[],
  boolean,
  text,
  boolean
) from public;

grant execute on function nova.publish_odds_tick(
  uuid,
  bigint,
  text,
  timestamptz,
  boolean,
  text,
  text[],
  boolean,
  text,
  boolean
) to service_role;
