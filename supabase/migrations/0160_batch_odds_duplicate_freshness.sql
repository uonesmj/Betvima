-- 0160 - refresh selection freshness on duplicate odds observations
create or replace function nova.publish_odds_tick_batch(p_ticks jsonb)
returns jsonb
language plpgsql
security definer
set search_path = nova, public
as $func$
declare
  v_tick jsonb;
  v_result jsonb;
  v_count int := 0;
  v_accepted int := 0;
  v_rejected int := 0;
  v_duplicates int := 0;
begin
  if p_ticks is null or jsonb_typeof(p_ticks) <> 'array' then
    raise exception 'VALIDATION_ERROR: ticks must be a JSON array' using errcode = '22023';
  end if;
  for v_tick in select * from jsonb_array_elements(p_ticks)
  loop
    v_result := nova.publish_odds_tick((v_tick->>'selection_id')::uuid,(v_tick->>'odds_scaled')::bigint,v_tick->>'provider',(v_tick->>'provider_timestamp')::timestamptz,coalesce((v_tick->>'is_live')::boolean,false),v_tick->>'ingest_key',coalesce(array(select jsonb_array_elements_text(v_tick->'anomalies')), '{}'::text[]),coalesce((v_tick->>'reject')::boolean,false),v_tick->>'reject_reason',coalesce((v_tick->>'suspend')::boolean,false));
    v_count := v_count + 1;
    if coalesce((v_result->>'duplicate')::boolean,false) then
      v_duplicates := v_duplicates + 1;
      update nova.selections set odds_updated_at = now(), provider_timestamp = (v_tick->>'provider_timestamp')::timestamptz, updated_at = now() where id = (v_tick->>'selection_id')::uuid;
    elsif coalesce((v_result->>'rejected')::boolean,false) then
      v_rejected := v_rejected + 1;
    elsif coalesce((v_result->>'accepted')::boolean,false) then
      v_accepted := v_accepted + 1;
    end if;
  end loop;
  return jsonb_build_object('count',v_count,'accepted',v_accepted,'rejected',v_rejected,'duplicates',v_duplicates);
end
$func$;
revoke all on function nova.publish_odds_tick_batch(jsonb) from public;
grant execute on function nova.publish_odds_tick_batch(jsonb) to service_role;
