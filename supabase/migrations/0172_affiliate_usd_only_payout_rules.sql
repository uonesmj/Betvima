-- Affiliate payout policy: USD only.
-- Sportsbook bet/settlement currencies remain unchanged.


UPDATE nova.affiliates
SET payout_currency = 'USD',
    payout_minimum_minor = 4000,
    payout_min_active_users_weekly = 5;


-- Enforce USD-only affiliate payouts and the $40 minimum at DB level.
CREATE OR REPLACE FUNCTION nova.create_affiliate_payout(
  p_affiliate_id uuid,
  p_settlement_id uuid,
  p_amount_minor bigint,
  p_currency text,
  p_idempotency_key text,
  p_requested_by uuid DEFAULT NULL::uuid,
  p_source text DEFAULT 'manual'::text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'nova', 'public'
AS $function$
DECLARE
  v_aff nova.affiliates%rowtype;
  v_existing nova.affiliate_payouts%rowtype;
  v_payout_id uuid;
  v_public_id text;
  v_balance record;
  v_dual boolean := false;
  v_threshold bigint;
  v_minimum bigint;
BEGIN
  IF NOT nova.operation_enabled('AFFILIATE_PAYOUT') THEN
    RAISE EXCEPTION 'AFFILIATE_PAYOUT_DISABLED' USING errcode = 'P0001';
  END IF;

  IF upper(coalesce(p_currency, '')) <> 'USD' THEN
    RAISE EXCEPTION 'AFFILIATE_PAYOUT_USD_ONLY' USING errcode = '22023';
  END IF;

  IF p_amount_minor IS NULL OR p_amount_minor <= 0 THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: payout amount must be positive' USING errcode = '22023';
  END IF;

  SELECT * INTO v_aff
  FROM nova.affiliates
  WHERE id = p_affiliate_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'AFFILIATE_NOT_FOUND' USING errcode = 'P0002';
  END IF;

  SELECT * INTO v_existing
  FROM nova.affiliate_payouts
  WHERE affiliate_id = p_affiliate_id
    AND idempotency_key = p_idempotency_key;

  IF FOUND THEN
    RETURN to_jsonb(v_existing) || jsonb_build_object('duplicate', true);
  END IF;

  v_minimum := greatest(coalesce(v_aff.payout_minimum_minor, 4000), 4000);

  IF p_amount_minor < v_minimum THEN
    RAISE EXCEPTION 'PAYOUT_BELOW_MINIMUM' USING errcode = '22023';
  END IF;

  SELECT * INTO v_balance
  FROM nova.affiliate_payable_balance(p_affiliate_id);

  IF p_amount_minor > v_balance.payable_minor THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE: payout exceeds payable balance' USING errcode = 'P0001';
  END IF;

  v_threshold := nullif(current_setting('nova.dual_approval_threshold', true), '')::bigint;
  v_dual := v_threshold IS NOT NULL AND p_amount_minor >= v_threshold;

  v_public_id := nova.new_public_id('NAP');

  INSERT INTO nova.affiliate_payouts (
    public_id, affiliate_id, settlement_id, amount_minor, currency,
    status, idempotency_key, requested_by, dual_approval_required,
    method, notes
  )
  VALUES (
    v_public_id,
    p_affiliate_id,
    p_settlement_id,
    p_amount_minor,
    'USD',
    CASE WHEN v_dual
      THEN 'manual_review'::affiliate_payout_status
      ELSE 'pending'::affiliate_payout_status END,
    p_idempotency_key,
    p_requested_by,
    v_dual,
    coalesce(p_metadata->>'method', 'manual'),
    p_metadata->>'note'
  )
  RETURNING id INTO v_payout_id;

  IF p_settlement_id IS NOT NULL THEN
    UPDATE nova.affiliate_settlements
    SET payout_id = v_payout_id,
        status = 'calculated'
    WHERE id = p_settlement_id;
  END IF;

  PERFORM nova.audit_event(
    p_requested_by,
    'affiliate.payout.create',
    'affiliate_payout',
    v_public_id,
    null,
    jsonb_build_object(
      'amount_minor', p_amount_minor,
      'currency', 'USD',
      'dual_approval', v_dual,
      'settlement_id', p_settlement_id,
      'source', p_source
    ),
    null,
    null,
    p_metadata
  );

  RETURN jsonb_build_object(
    'id', v_payout_id,
    'public_id', v_public_id,
    'status', CASE WHEN v_dual THEN 'manual_review' ELSE 'pending' END,
    'amount_minor', p_amount_minor,
    'currency', 'USD',
    'duplicate', false,
    'dual_approval_required', v_dual
  );
END
$function$;

CREATE OR REPLACE FUNCTION nova.apply_bet_commission(p_bet_id uuid, p_settlement_id uuid, p_revision integer, p_net_user_result_minor bigint, p_currency text, p_worker text DEFAULT 'worker'::text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'nova', 'public'
AS $function$
declare
  v_bet nova.bets%rowtype;
  v_aff_id uuid;
  v_cfg jsonb;
  v_rate_bps numeric;
  v_parent_bps numeric;
  v_cap numeric;
  v_child_bps numeric;
  v_parent_applied numeric;
  v_child_amount bigint;
  v_parent_amount bigint;
  v_inserted int := 0;
  v_ancestor record;
begin
  if upper(coalesce(p_currency, '')) <> 'USD' then
    return 0;
  end if;

  select * into v_bet from nova.bets where id = p_bet_id;
  if not found then return 0; end if;

  -- Attribution is authoritative on the bet row (captured transactionally at placement).
  v_aff_id := v_bet.affiliate_id;
  if v_aff_id is null then
    select affiliate_id into v_aff_id from nova.affiliate_attributions
     where user_id = v_bet.user_id and status in ('confirmed','locked') limit 1;
  end if;
  if v_aff_id is null then return 0; end if;      -- organic user: no commission, by design
  if p_net_user_result_minor = 0 then return 0; end if;

  v_cfg := nova.resolve_commission_config(v_aff_id, null, v_bet.campaign);
  v_rate_bps := coalesce((v_cfg->>'commission_rate_bps')::numeric, 3500);
  v_parent_bps := coalesce((v_cfg->>'parent_override_bps')::numeric, 0);
  v_cap := nullif(v_cfg->>'total_net_bps_cap', '')::numeric;

  -- Prune child/parent rates so child + parent never exceed the configured cap.
  -- The parent is prorated first and the child receives exactly the remaining headroom.
  if v_cap is not null and (v_rate_bps + v_parent_bps) > v_cap then
    v_parent_applied := floor(v_parent_bps * v_cap / greatest(v_rate_bps + v_parent_bps, 1));
    v_child_bps := greatest(v_cap - v_parent_applied, 0);
  else
    v_child_bps := v_rate_bps;
    v_parent_applied := v_parent_bps;
  end if;

  -- Child commission (the affiliate that owns the attribution).
  -- SIGN: p_net_user_result_minor is the USER's result (payout - stake); the affiliate
  -- earns the inverse: user loses 10,000,000 -> +3,500,000 at 35% (spec §29).
  v_child_amount := nova.apply_bps(-p_net_user_result_minor::numeric, v_child_bps);
  if v_child_amount <> 0 then
    insert into nova.affiliate_ledger (
      affiliate_id, type, amount_minor, currency, direction, commission_rate_bps, applied_rate_bps,
      cap_applied, source_amount_minor, source_kind, user_id, bet_id, bet_settlement_id,
      status, idempotency_key, metadata)
    values (
      v_aff_id,
      case when v_child_amount >= 0 then 'user_loss_commission'::affiliate_ledger_type else 'user_win_debit'::affiliate_ledger_type end,
      v_child_amount, p_currency, case when v_child_amount >= 0 then 'credit' else 'debit' end,
      v_rate_bps::int, v_child_bps::int, (v_child_bps <> v_rate_bps),
      p_net_user_result_minor, 'bet_settlement', v_bet.user_id, p_bet_id, p_settlement_id,
      'available',
      'commission:' || p_settlement_id::text || ':' || v_aff_id::text,
      jsonb_build_object('revision', p_revision, 'worker', p_worker, 'model', v_cfg->>'commission_model'))
    on conflict (affiliate_id, idempotency_key) do nothing;
    v_inserted := v_inserted + 1;
  end if;

  -- Parent override commission (walk the hierarchy; never infinite, never negative-sum).
  if v_parent_applied > 0 then
    for v_ancestor in
      select a.id, a.parent_affiliate_id, r.depth
        from nova.affiliates a
        left join nova.affiliate_relationships r on r.affiliate_id = a.id and r.effective_to is null
       where a.id = (select parent_affiliate_id from nova.affiliates where id = v_aff_id)
      union all
      select p.id, p.parent_affiliate_id, 2 from nova.affiliates p
       where p.id = (select a2.parent_affiliate_id from nova.affiliates a2
                      where a2.id = (select parent_affiliate_id from nova.affiliates where id = v_aff_id))
    loop
      v_parent_amount := nova.apply_bps(-p_net_user_result_minor::numeric, v_parent_applied);
      if v_parent_amount <> 0 then
        insert into nova.affiliate_ledger (
          affiliate_id, type, amount_minor, currency, direction, commission_rate_bps, applied_rate_bps,
          cap_applied, source_amount_minor, source_kind, user_id, bet_id, bet_settlement_id,
          status, idempotency_key, metadata)
        values (
          v_ancestor.id,
          case when v_parent_amount >= 0 then 'user_loss_commission'::affiliate_ledger_type else 'user_win_debit'::affiliate_ledger_type end,
          v_parent_amount, p_currency, case when v_parent_amount >= 0 then 'credit' else 'debit' end,
          v_parent_applied::int, v_parent_applied::int, (v_parent_applied <> v_parent_bps),
          p_net_user_result_minor, 'bet_settlement', v_bet.user_id, p_bet_id, p_settlement_id,
          'available',
          'parent_commission:' || p_settlement_id::text || ':' || v_ancestor.id::text,
          jsonb_build_object('revision', p_revision, 'child_affiliate', v_aff_id, 'depth', v_ancestor.depth))
        on conflict (affiliate_id, idempotency_key) do nothing;
        v_inserted := v_inserted + 1;
      end if;
    end loop;
  end if;

  -- Referral statistics + daily aggregates (reporting only, never the money authority).
  insert into nova.affiliate_referral_stats (affiliate_id, user_id, currency, settled_bets, turnover_minor,
    user_wins_minor, user_losses_minor, commission_minor, last_settled_at)
  select v_aff_id, v_bet.user_id, p_currency, 1, v_bet.stake_minor,
         greatest(p_net_user_result_minor, 0), greatest(-p_net_user_result_minor, 0), coalesce(sum(amount_minor),0), now()
    from nova.affiliate_ledger
   where bet_id = p_bet_id and bet_settlement_id = p_settlement_id
  on conflict (affiliate_id, user_id) do update
    set settled_bets = nova.affiliate_referral_stats.settled_bets + 1,
        turnover_minor = nova.affiliate_referral_stats.turnover_minor + v_bet.stake_minor,
        user_wins_minor = nova.affiliate_referral_stats.user_wins_minor + greatest(p_net_user_result_minor, 0),
        user_losses_minor = nova.affiliate_referral_stats.user_losses_minor + greatest(-p_net_user_result_minor, 0),
        commission_minor = nova.affiliate_referral_stats.commission_minor + coalesce((
          select sum(amount_minor) from nova.affiliate_ledger
           where bet_id = p_bet_id and bet_settlement_id = p_settlement_id and affiliate_id = v_aff_id), 0),
        last_settled_at = now();

  insert into nova.affiliate_daily_stats (affiliate_id, day, currency, settled_bets, turnover_minor,
    user_wins_minor, user_losses_minor, commission_minor)
  values (v_aff_id, (now() at time zone 'UTC')::date, p_currency, 1, v_bet.stake_minor,
          greatest(p_net_user_result_minor, 0), greatest(-p_net_user_result_minor, 0), coalesce(v_child_amount, 0))
  on conflict (affiliate_id, day) do update
    set settled_bets = nova.affiliate_daily_stats.settled_bets + 1,
        turnover_minor = nova.affiliate_daily_stats.turnover_minor + v_bet.stake_minor,
        user_wins_minor = nova.affiliate_daily_stats.user_wins_minor + greatest(p_net_user_result_minor, 0),
        user_losses_minor = nova.affiliate_daily_stats.user_losses_minor + greatest(-p_net_user_result_minor, 0),
        commission_minor = nova.affiliate_daily_stats.commission_minor + coalesce(v_child_amount, 0);

  -- Activation milestones (reporting).
  update nova.affiliate_attributions
     set first_bet_at = coalesce(first_bet_at, now()), activated_at = coalesce(activated_at, now())
   where user_id = v_bet.user_id and affiliate_id = v_aff_id;

  return v_inserted;
end;
$function$;

CREATE OR REPLACE FUNCTION nova.settle_affiliate_period(p_affiliate_id uuid, p_period_start timestamp with time zone, p_period_end timestamp with time zone, p_worker text DEFAULT 'affiliate-worker'::text, p_force boolean DEFAULT false)
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
begin
  if not nova.operation_enabled('AFFILIATE_SETTLEMENT') then
    raise exception 'AFFILIATE_SETTLEMENT_DISABLED' using errcode = 'P0001';
  end if;
  if p_period_end <= p_period_start then
    raise exception 'VALIDATION_ERROR: invalid period' using errcode = '22023';
  end if;

  select * into v_aff from nova.affiliates where id = p_affiliate_id for update;
  if not found then raise exception 'AFFILIATE_NOT_FOUND' using errcode = 'P0002'; end if;

  select * into v_existing from nova.affiliate_settlements
   where affiliate_id = p_affiliate_id and period_end = p_period_end;
  if found and not p_force then
    return jsonb_build_object('ok', true, 'duplicate', true, 'settlement_id', v_existing.id,
      'payable_minor', v_existing.payable_minor, 'status', v_existing.status);
  end if;

  v_cfg := nova.resolve_commission_config(p_affiliate_id, null, null);
  v_allow_negative := coalesce((v_cfg->>'allow_negative_balance')::boolean, false);
  v_floor := greatest(coalesce((v_cfg->>'negative_balance_floor_minor')::bigint, 0), 0);
  v_min_payout := greatest(coalesce(v_aff.payout_minimum_minor, 4000), 4000);
  v_active_required := greatest(coalesce(v_aff.payout_min_active_users_weekly, 5), 5);
  v_max_payout := nullif(v_cfg->>'max_payout_minor', '')::bigint;
  v_cap := nullif(v_cfg->>'total_net_bps_cap', '')::numeric;
  v_week_key := to_char(p_period_end, 'IYYY-"W"IW');

  -- opening carry = previous settlement's closing carry
  select coalesce(closing_carry_minor, 0) into v_opening_carry
    from nova.affiliate_settlements
   where affiliate_id = p_affiliate_id and period_end < p_period_end
   order by period_end desc limit 1;
  v_opening_carry := coalesce(v_opening_carry, 0);

  -- snapshot eligible (settled, not yet settled) entries in the period
  select count(*), coalesce(sum(case when amount_minor > 0 then amount_minor else 0 end), 0),
         coalesce(sum(case when amount_minor < 0 then amount_minor else 0 end), 0)
    into v_entries, v_gross, v_debit
    from nova.affiliate_ledger
   where affiliate_id = p_affiliate_id
     and currency = 'USD'
     and status = 'available'
     and created_at >= p_period_start and created_at < p_period_end;

  v_net := v_gross + v_debit;   -- v_debit is negative

  -- optional cap on TOTAL net commission relative to referred turnover
  if v_cap is not null then
    select coalesce(sum(turnover_minor), 0) into v_turnover
      from nova.affiliate_daily_stats
     where affiliate_id = p_affiliate_id
       and day >= (p_period_start at time zone 'UTC')::date and day < (p_period_end at time zone 'UTC')::date;
    if v_turnover > 0 and v_net > floor(v_turnover * v_cap / 10000) then
      v_net := floor(v_turnover * v_cap / 10000);
      v_capped := true;
    end if;
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
    -- MODEL B: payable can never be negative; the deficit is suppressed (raw entries stay).
    if v_payable < v_floor then
      v_suppressed := v_floor - v_payable;
      v_payable := v_floor;
      v_floor_applied := true;
    end if;
  end if;

  insert into nova.affiliate_settlements (
    affiliate_id, period_start, period_end, status, week_key, closed_entries_count,
    gross_commission_minor, negative_impact_minor, net_minor, opening_carry_minor, closing_carry_minor,
    payable_minor, suppressed_minor, floor_applied, capped_by_cap, currency, commission_model,
    commission_rate_bps, minimum_payout_minor, calculated_at)
  values (
    p_affiliate_id, p_period_start, p_period_end, 'calculated', v_week_key, v_entries,
    v_gross, -v_debit, v_net, v_opening_carry,
    case when v_payable >= v_min_payout and v_active_eligible then 0 else v_payable end,
    case when v_payable >= v_min_payout and v_active_eligible then least(v_payable, coalesce(v_max_payout, v_payable)) else 0 end,
    v_suppressed, v_floor_applied, v_capped, 'USD',
    coalesce(v_cfg->>'commission_model', v_aff.commission_model::text)::commission_model,
    coalesce((v_cfg->>'commission_rate_bps')::int, v_aff.commission_rate_bps),
    v_min_payout, now())
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

  v_closing_carry := case when v_payable >= v_min_payout and v_active_eligible then 0 else v_payable end;

  -- close the period's entries (status only; amounts are never rewritten)
  update nova.affiliate_ledger
     set status = 'settled', settled_at = now(), settlement_id = v_settlement_id
   where affiliate_id = p_affiliate_id
     and currency = 'USD'
     and status = 'available'
     and created_at >= p_period_start and created_at < p_period_end;

  -- record carry-forward explicitly (positive or negative) when nothing is payable
  if (v_payable < v_min_payout or not v_active_eligible) and v_payable <> 0 then
    insert into nova.affiliate_ledger (
      affiliate_id, type, amount_minor, currency, direction, source_kind, status,
      idempotency_key, settlement_id, metadata)
    values (
      p_affiliate_id, 'carry_forward', v_payable, 'USD',
      case when v_payable >= 0 then 'credit' else 'debit' end, 'settlement', 'settled',
      'carry_forward:' || p_period_end::text, v_settlement_id,
      jsonb_build_object('week', v_week_key, 'opening_carry_minor', v_opening_carry,
                         'payable_minor', v_payable, 'below_minimum_payout_minor', v_min_payout,
                         'active_users', v_active_users, 'active_users_required', v_active_required))
    on conflict (affiliate_id, idempotency_key) do nothing;
  end if;

  -- payout when the payable balance reaches the minimum
  if v_payable >= v_min_payout and v_active_eligible and v_payable > 0 then
    v_payout := nova.create_affiliate_payout(
      p_affiliate_id, v_settlement_id, least(v_payable, coalesce(v_max_payout, v_payable)),
      'USD', 'settlement:' || v_settlement_id::text, null, 'system',
      jsonb_build_object('week_key', v_week_key, 'source', 'weekly_settlement'));
  end if;

  perform nova.audit_event(null, 'affiliate.settlement.run', 'affiliate_settlement', v_settlement_id::text,
    jsonb_build_object('opening_carry_minor', v_opening_carry, 'entries', v_entries),
    jsonb_build_object('net_minor', v_net, 'payable_minor', v_payable, 'suppressed_minor', v_suppressed,
                       'payout_id', v_payout->>'id', 'floor_applied', v_floor_applied,
                       'active_users', v_active_users, 'active_users_required', v_active_required,
                       'active_users_eligible', v_active_eligible, 'worker', p_worker),
    'Weekly settlement ' || v_week_key, null);

  return jsonb_build_object(
    'ok', true, 'duplicate', false, 'settlement_id', v_settlement_id, 'week_key', v_week_key,
    'entries', v_entries, 'gross_minor', v_gross, 'debit_minor', v_debit, 'net_minor', v_net,
    'opening_carry_minor', v_opening_carry, 'payable_minor', v_payable, 'closing_carry_minor', v_closing_carry,
    'suppressed_minor', v_suppressed, 'floor_applied', v_floor_applied, 'capped', v_capped,
    'payout', v_payout);
exception
  when unique_violation then
    select * into v_existing from nova.affiliate_settlements where affiliate_id = p_affiliate_id and period_end = p_period_end;
    return jsonb_build_object('ok', true, 'duplicate', true, 'settlement_id', v_existing.id,
      'payable_minor', v_existing.payable_minor);
end;
$function$;
