-- 0204: missing FX coverage is a blocking, audited failure, not silent success.
begin;
create or replace function nova.vip_cashback_process_due_week(p_live boolean default false)
returns jsonb
language plpgsql volatile
security definer
set search_path = nova,public
as $$
declare
  v_today date := timezone('Asia/Tehran',clock_timestamp())::date;
  v_current_monday date;
  v_week date;
  v_day_start timestamp;
  v_payout_switch boolean;
  v_cron_switch boolean;
  v_quote record;
  v_response jsonb;
  v_status text;
  v_error text;
  v_candidate_count int := 0;
  v_paid_count int := 0;
  v_already_paid_count int := 0;
  v_failed_count int := 0;
  v_amount bigint := 0;
  v_run_status text;
  v_errors jsonb := '{}'::jsonb;
begin
  v_current_monday := v_today - (extract(isodow from v_today)::int-1);
  v_week := v_current_monday - 7;
  v_day_start := timezone('Asia/Tehran',clock_timestamp());
  if v_day_start < v_current_monday::timestamp + interval '9 hours' then
    raise exception 'VIP_MONDAY_CUTOFF_NOT_REACHED' using errcode='22023';
  end if;
  if p_live then
    select enabled into v_payout_switch from nova.system_operations
      where key='VIP_CASHBACK_PAYOUT';
    select enabled into v_cron_switch from nova.system_operations
      where key='VIP_CASHBACK_CRON';
    if v_payout_switch is distinct from true or v_cron_switch is distinct from true then
      insert into nova.vip_cashback_run_audits(week_start,is_live,status)
        values(v_week,true,'disabled');
      return jsonb_build_object('status','disabled','week_start',v_week);
    end if;
    perform nova.vip_cashback_reconcile(12);
  end if;
  if p_live then
    -- Missing historical FX (including an unsupported currency) blocks the
    -- entire user/week, is an explicit operational failure and cannot be
    -- reported as a successful weekly settlement run.
    for v_quote in select * from nova.vip_cashback_fx_blockers(v_week) loop
      v_failed_count := v_failed_count + 1;
      v_errors := jsonb_set(v_errors,array['FX_MISSING_HISTORICAL'],
        to_jsonb(coalesce((v_errors->>'FX_MISSING_HISTORICAL')::int,0)+1));
      insert into nova.vip_cashback_run_failures(week_start,user_id,error_code)
        values(v_week,v_quote.user_id,'FX_MISSING_HISTORICAL')
      on conflict(week_start,user_id,error_code) do nothing;
    end loop;
  end if;
  for v_quote in
    select * from nova.vip_cashback_quote_week(v_week)
    where cashback_minor > 0 order by user_id
  loop
    v_candidate_count := v_candidate_count + 1;
    if not p_live then continue; end if;
    begin
      v_response := nova.vip_cashback_credit_user(v_week,v_quote.user_id,false);
      v_status := v_response->>'status';
      if v_status = 'credited' then
        v_paid_count := v_paid_count + 1;
        v_amount := v_amount + (v_response->>'amount_minor')::bigint;
      elsif v_status = 'already_paid' then
        v_already_paid_count := v_already_paid_count + 1;
      elsif v_status not in ('not_eligible','no_longer_eligible') then
        raise exception 'VIP_UNEXPECTED_PAYOUT_STATUS';
      end if;
    exception when others then
      v_failed_count := v_failed_count + 1;
      v_error := coalesce(sqlstate,'P0001');
      v_errors := jsonb_set(v_errors,array[v_error],
        to_jsonb(coalesce((v_errors->>v_error)::int,0)+1));
      insert into nova.vip_cashback_run_failures(week_start,user_id,error_code)
        values(v_week,v_quote.user_id,v_error)
      on conflict(week_start,user_id,error_code) do nothing;
    end;
  end loop;
  if not p_live then
    -- Strictly read-only preview; do not create even an audit row.
    return jsonb_build_object('status','preview','week_start',v_week,
      'candidates',v_candidate_count,'paid',0,'failed',0,'paid_minor',0);
  end if;
  v_run_status := case when v_failed_count > 0 then 'partial_failure'
                       else 'success' end;
  insert into nova.vip_cashback_run_audits(
    week_start,is_live,status,candidate_count,paid_count,already_paid_count,
    failed_count,paid_minor,error_codes)
  values(v_week,p_live,v_run_status,v_candidate_count,v_paid_count,
     v_already_paid_count,v_failed_count,v_amount,v_errors);
  return jsonb_build_object(
    'status',v_run_status,'week_start',v_week,
    'candidates',v_candidate_count,'paid',v_paid_count,
    'already_paid',v_already_paid_count,'failed',v_failed_count,
    'paid_minor',v_amount
  );
end $$;


revoke execute on function nova.vip_cashback_process_due_week(boolean) from public,anon,authenticated;
grant execute on function nova.vip_cashback_process_due_week(boolean) to service_role;
commit;
