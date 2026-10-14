-- 0206: report missing FX only for deposit-active users, without
-- silently reducing their weekly net result.
begin;
create or replace function nova.vip_cashback_fx_blockers(p_week_start date)
returns table(user_id uuid,missing_count bigint,currencies text[])
language sql stable security definer set search_path=nova,public
as $$
  select a.user_id,
    count(*) filter(where a.usd_minor is null)::bigint,
    array_agg(distinct a.source_currency) filter(where a.usd_minor is null)
  from nova.vip_cb_activities(p_week_start) a
  group by a.user_id
  having count(*) filter(where a.source_kind='deposit') > 0
    and count(*) filter(where a.usd_minor is null) > 0
$$;
revoke execute on function nova.vip_cashback_fx_blockers(date) from public,anon,authenticated;
grant execute on function nova.vip_cashback_fx_blockers(date) to service_role;
commit;
