-- 0205: atomic provider-history ingestion. Reject conflicting edits to past rates.
begin;
create or replace function nova.vip_cb_ingest_fx_history(
 p_points jsonb,p_range text
) returns integer
language plpgsql volatile security definer set search_path=nova,public,extensions
as $$
declare
 v_point jsonb;
 v_at timestamptz;
 v_price numeric(24,6);
 v_hash text;
 v_existing numeric(24,6);
 v_count int:=0;
begin
 if p_range not in ('24h','7d','30d','90d') then
   raise exception 'VIP_FX_INVALID_RANGE' using errcode='22023';
 end if;
 if jsonb_typeof(p_points) is distinct from 'array'
    or jsonb_array_length(p_points)=0
    or jsonb_array_length(p_points)>2500 then
   raise exception 'VIP_FX_INVALID_BATCH_SIZE' using errcode='22023';
 end if;
 for v_point in select * from jsonb_array_elements(p_points) loop
   if jsonb_typeof(v_point) <> 'object'
      or (v_point->>'price') !~ '^[0-9]{1,12}(\.[0-9]{1,6})?$'
      or coalesce(v_point->>'timestamp','') !~ '^\d{4}-\d{2}-\d{2}T'
   then
     raise exception 'VIP_FX_INVALID_POINT' using errcode='22023';
   end if;
   v_at := (v_point->>'timestamp')::timestamptz;
   v_price := (v_point->>'price')::numeric(24,6);
   if v_price<=0 or v_at>clock_timestamp()+interval '1 minute'
      or v_at < clock_timestamp()-interval '100 days' then
     raise exception 'VIP_FX_POINT_OUT_OF_RANGE' using errcode='22023';
   end if;
   v_hash := encode(digest(v_point::text,'sha256'),'hex');
   select price_toman_per_usd into v_existing
     from nova.vip_cashback_fx_rates
     where asset='usd' and source='arzhaam_history' and sampled_at=v_at;
   if found then
     if v_existing<>v_price then
       raise exception 'VIP_FX_PROVIDER_HISTORY_CONFLICT' using errcode='23505';
     end if;
   else
     insert into nova.vip_cashback_fx_rates(
       asset,source,sampled_at,price_toman_per_usd,range_requested,source_payload_hash
     ) values ('usd','arzhaam_history',v_at,v_price,p_range,v_hash);
     v_count:=v_count+1;
   end if;
 end loop;
 return v_count;
end $$;
revoke execute on function nova.vip_cb_ingest_fx_history(jsonb,text) from public,anon,authenticated;
grant execute on function nova.vip_cb_ingest_fx_history(jsonb,text) to service_role;
commit;
