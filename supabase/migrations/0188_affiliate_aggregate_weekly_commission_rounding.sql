CREATE OR REPLACE FUNCTION nova.settle_affiliate_period(
  p_affiliate_id uuid,
  p_period_start timestamp with time zone,
  p_period_end timestamp with time zone,
  p_worker text DEFAULT 'affiliate-worker'::text,
  p_force boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'nova', 'public'
AS $function$
declare
  v_aff nova.affiliates%rowtype;
  v_cfg jsonb;
  v_existing nova.affiliate_settlements%rowtype;
  v_settlement_id uuid;
  v_gross bigint := 0;
  v_debit bigint := 0;
  v_net bigint := 0;
  v_raw_net bigint := 0;
  v_non_commission_net bigint := 0;
  v_aggregate_commission bigint := 0;
  v_target_net bigint := 0;
  v_adjustment bigint := 0;
  v_existing_adjustment bigint := 0;
  v_opening_carry bigint := 0;
  v_payable bigint := 0;
  v_suppressed bigint := 0;
  v_floor_applied boolean := false;
  v_min_payout bigint;
  v_active_users bigint := 0;
  v_active_required bigint := 5;
  v_active_eligible boolean := false;
  v_max_payout bigint;
  v_allow_negative boolean;
  v_floor bigint;
  v_cap numeric;
  v_turnover bigint := 0;
  v_capped boolean := false;
  v_payout jsonb := null;
  v_entries int := 0;
  v_week_key text;
  v_closing_carry bigint;
  v_adjustment_key text;
begin
  if not nova.operation_enabled('AFFILIATE_SETTLEMENT') then
    raise exception 'AFFILIATE_SETTLEMENT_DISABLED' using errcode = 'P0001';
  end if;

  if p_period_end <= p_period_start then
    raise exception 'VALIDATION_ERROR: invalid period' using errcode = '22023';
  end if;

  select * into v_aff
    from nova.affiliates
   where id = p_affiliate_id
   for update;

  if not found then
    raise exception 'AFFILIATE_NOT_FOUND' using errcode = 'P0002';
  end if;

  select * into v_existing
    from nova.affiliate_settlements
   where affiliate_id = p_affiliate_id
     and period_end = p_period_end;

  if found and not p_force then
    return jsonb_build_object(
      'ok', true,
      'duplicate', true,
      'settlement_id', v_existing.id,
      'payable_minor', v_existing.payable_minor,
      'status', v_existing.status
    );
  end if;

  v_cfg := nova.resolve_commission_config(p_affiliate_id, null, null);
  v_allow_negative := coalesce((v_cfg->>'allow_negative_balance')::boolean, false);
  v_floor := greatest(coalesce((v_cfg->>'negative_balance_floor_minor')::bigint, 0), 0);
  v_min_payout := greatest(coalesce(v_aff.payout_minimum_minor, 4000), 4000);
  v_active_required := greatest(coalesce(v_aff.payout_min_active_users_weekly, 5), 5);
  v_max_payout := nullif(v_cfg->>'max_payout_minor', '')::bigint;
  v_cap := nullif(v_cfg->>'total_net_bps_cap', '')::numeric;
  v_week_key := to_char(p_period_end, 'IYYY-"W"IW');
  v_adjustment_key := 'aggregate_rounding:' || p_period_end::text;

  select coalesce(closing_carry_minor, 0)
    into v_opening_carry
    from nova.affiliate_settlements
   where affiliate_id = p_affiliate_id
     and period_end < p_period_end
   order by period_end desc
   limit 1;

  v_opening_carry := coalesce(v_opening_carry, 0);

  select coalesce(sum(amount_minor), 0)
    into v_raw_net
    from nova.affiliate_ledger
   where affiliate_id = p_affiliate_id
     and currency = 'USD'
     and status = 'available'
     and created_at >= p_period_start
     and created_at < p_period_end;

  select coalesce(sum(amount_minor), 0)
    into v_non_commission_net
    from nova.affiliate_ledger
   where affiliate_id = p_affiliate_id
     and currency = 'USD'
     and status = 'available'
     and created_at >= p_period_start
     and created_at < p_period_end
     and type not in (
       'user_loss_commission'::affiliate_ledger_type,
       'user_win_debit'::affiliate_ledger_type
     );

  select coalesce(sum(nova.apply_bps(
    -x.source_sum::numeric,
    x.rate_bps::numeric
  )), 0)
    into v_aggregate_commission
    from (
      select
        coalesce(applied_rate_bps, commission_rate_bps, 0)::bigint as rate_bps,
        sum(source_amount_minor)::bigint as source_sum
        from nova.affiliate_ledger
       where affiliate_id = p_affiliate_id
         and currency = 'USD'
         and status = 'available'
         and created_at >= p_period_start
         and created_at < p_period_end
         and type in (
           'user_loss_commission'::affiliate_ledger_type,
           'user_win_debit'::affiliate_ledger_type
         )
         and source_kind = 'bet_settlement'
         and source_amount_minor is not null
       group by coalesce(applied_rate_bps, commission_rate_bps, 0)
    ) x;

  v_target_net := v_non_commission_net + v_aggregate_commission;

  if v_cap is not null then
    select coalesce(sum(turnover_minor), 0)
      into v_turnover
      from nova.affiliate_daily_stats
     where affiliate_id = p_affiliate_id
       and day >= (p_period_start at time zone 'UTC')::date
       and day < (p_period_end at time zone 'UTC')::date;

    if v_turnover > 0 and v_target_net > floor(v_turnover * v_cap / 10000) then
      v_target_net := floor(v_turnover * v_cap / 10000);
      v_capped := true;
    end if;
  end if;

  v_adjustment := v_target_net - v_raw_net;

  if v_adjustment <> 0 then
    insert into nova.affiliate_ledger (
      affiliate_id,
      type,
      amount_minor,
      currency,
      direction,
      commission_rate_bps,
      applied_rate_bps,
      cap_applied,
      source_amount_minor,
      source_kind,
      status,
      idempotency_key,
      settlement_id,
      metadata,
      created_at
    )
    values (
      p_affiliate_id,
      'adjustment'::affiliate_ledger_type,
      v_adjustment,
      'USD',
      case when v_adjustment >= 0 then 'credit' else 'debit' end,
      null,
      null,
      v_capped,
      v_adjustment,
      'weekly_settlement_adjustment',
      'available',
      v_adjustment_key,
      null,
      jsonb_build_object(
        'week', v_week_key,
        'period_start', p_period_start,
        'period_end', p_period_end,
        'raw_net_minor', v_raw_net,
        'target_net_minor', v_target_net,
        'aggregate_commission_minor', v_aggregate_commission,
        'non_commission_net_minor', v_non_commission_net,
        'reason', case
          when v_capped then 'aggregate_rounding_and_cap'
          else 'aggregate_rounding'
        end
      ),
      p_period_end - interval '1 microsecond'
    )
    on conflict (affiliate_id, idempotency_key) do nothing;
  end if;

  select coalesce(sum(amount_minor), 0),
         coalesce(sum(case when amount_minor > 0 then amount_minor else 0 end), 0),
         coalesce(sum(case when amount_minor < 0 then amount_minor else 0 end), 0),
         count(*)
    into v_net, v_gross, v_debit, v_entries
    from nova.affiliate_ledger
   where affiliate_id = p_affiliate_id
     and currency = 'USD'
     and status = 'available'
     and created_at >= p_period_start
     and created_at < p_period_end;

  if v_net <> v_target_net then
    v_net := v_target_net;
  end if;

  v_payable := v_opening_carry + v_net;

  select count(distinct aa.user_id)
    into v_active_users
    from nova.affiliate_attributions aa
   where aa.affiliate_id = p_affiliate_id
     and aa.activated_at >= p_period_start
     and aa.activated_at < p_period_end;

  v_active_eligible := v_active_users >= v_active_required;

  if not v_allow_negative then
    if v_payable < v_floor then
      v_suppressed := v_floor - v_payable;
      v_payable := v_floor;
      v_floor_applied := true;
    end if;
  end if;

  insert into nova.affiliate_settlements (
    affiliate_id,
    period_start,
    period_end,
    status,
    week_key,
    closed_entries_count,
    gross_commission_minor,
    negative_impact_minor,
    net_minor,
    opening_carry_minor,
    closing_carry_minor,
    payable_minor,
    suppressed_minor,
    floor_applied,
    capped_by_cap,
    currency,
    commission_model,
    commission_rate_bps,
    minimum_payout_minor,
    calculated_at
  )
  values (
    p_affiliate_id,
    p_period_start,
    p_period_end,
    'calculated',
    v_week_key,
    v_entries,
    v_gross,
    -v_debit,
    v_net,
    v_opening_carry,
    case
      when v_payable >= v_min_payout and v_active_eligible then 0
      else v_payable
    end,
    case
      when v_payable >= v_min_payout and v_active_eligible
        then least(v_payable, coalesce(v_max_payout, v_payable))
      else 0
    end,
    v_suppressed,
    v_floor_applied,
    v_capped,
    'USD',
    coalesce(v_cfg->>'commission_model', v_aff.commission_model::text)::commission_model,
    coalesce((v_cfg->>'commission_rate_bps')::int, v_aff.commission_rate_bps),
    v_min_payout,
    now()
  )
  on conflict (affiliate_id, period_end) do update
    set gross_commission_minor = excluded.gross_commission_minor,
        negative_impact_minor = excluded.negative_impact_minor,
        net_minor = excluded.net_minor,
        opening_carry_minor = excluded.opening_carry_minor,
        closing_carry_minor = excluded.closing_carry_minor,
        payable_minor = excluded.payable_minor,
        suppressed_minor = excluded.suppressed_minor,
        floor_applied = excluded.floor_applied,
        capped_by_cap = excluded.capped_by_cap,
        closed_entries_count = excluded.closed_entries_count,
        calculated_at = now()
  returning id into v_settlement_id;

  v_closing_carry :=
    case
      when v_payable >= v_min_payout and v_active_eligible then 0
      else v_payable
    end;

  update nova.affiliate_ledger
     set status = 'settled',
         settled_at = now(),
         settlement_id = v_settlement_id
   where affiliate_id = p_affiliate_id
     and currency = 'USD'
     and status = 'available'
     and created_at >= p_period_start
     and created_at < p_period_end;

  if (v_payable < v_min_payout or not v_active_eligible) and v_payable <> 0 then
    insert into nova.affiliate_ledger (
      affiliate_id,
      type,
      amount_minor,
      currency,
      direction,
      source_kind,
      status,
      idempotency_key,
      settlement_id,
      metadata
    )
    values (
      p_affiliate_id,
      'carry_forward',
      v_payable,
      'USD',
      case when v_payable >= 0 then 'credit' else 'debit' end,
      'settlement',
      'settled',
      'carry_forward:' || p_period_end::text,
      v_settlement_id,
      jsonb_build_object(
        'week', v_week_key,
        'opening_carry_minor', v_opening_carry,
        'payable_minor', v_payable,
        'below_minimum_payout_minor', v_min_payout,
        'active_users', v_active_users,
        'active_users_required', v_active_required
      )
    )
    on conflict (affiliate_id, idempotency_key) do nothing;
  end if;

  if v_payable >= v_min_payout and v_active_eligible and v_payable > 0 then
    v_payout := nova.create_affiliate_payout(
      p_affiliate_id,
      v_settlement_id,
      least(v_payable, coalesce(v_max_payout, v_payable)),
      'USD',
      'settlement:' || v_settlement_id::text,
      null,
      'system',
      jsonb_build_object(
        'week_key', v_week_key,
        'source', 'weekly_settlement'
      )
    );
  end if;

  perform nova.audit_event(
    null,
    'affiliate.settlement.run',
    'affiliate_settlement',
    v_settlement_id::text,
    jsonb_build_object(
      'opening_carry_minor', v_opening_carry,
      'entries', v_entries,
      'raw_net_minor', v_raw_net,
      'aggregate_commission_minor', v_aggregate_commission,
      'adjustment_minor', v_adjustment
    ),
    jsonb_build_object(
      'net_minor', v_net,
      'payable_minor', v_payable,
      'suppressed_minor', v_suppressed,
      'payout_id', v_payout->>'id',
      'floor_applied', v_floor_applied,
      'active_users', v_active_users,
      'active_users_required', v_active_required,
      'active_users_eligible', v_active_eligible,
      'capped', v_capped,
      'worker', p_worker
    ),
    'Weekly settlement ' || v_week_key,
    null
  );

  return jsonb_build_object(
    'ok', true,
    'duplicate', false,
    'settlement_id', v_settlement_id,
    'week_key', v_week_key,
    'entries', v_entries,
    'gross_minor', v_gross,
    'debit_minor', v_debit,
    'net_minor', v_net,
    'raw_net_minor', v_raw_net,
    'aggregate_commission_minor', v_aggregate_commission,
    'adjustment_minor', v_adjustment,
    'opening_carry_minor', v_opening_carry,
    'payable_minor', v_payable,
    'closing_carry_minor', v_closing_carry,
    'suppressed_minor', v_suppressed,
    'floor_applied', v_floor_applied,
    'capped', v_capped,
    'payout', v_payout
  );

exception
  when unique_violation then
    select * into v_existing
      from nova.affiliate_settlements
     where affiliate_id = p_affiliate_id
       and period_end = p_period_end;

    return jsonb_build_object(
      'ok', true,
      'duplicate', true,
      'settlement_id', v_existing.id,
      'payable_minor', v_existing.payable_minor
    );
end;
$function$;
