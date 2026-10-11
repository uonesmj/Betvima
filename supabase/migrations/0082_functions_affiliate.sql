-- ============================================================================
-- 0082 - AFFILIATE RPC
--   resolve_commission_config  -> effective configuration (specificity ladder)
--   apply_bet_commission       -> immutable ledger entries from settled bets
--   settle_affiliate_period    -> weekly (Friday) settlement, carry-forward, floor-zero
--   create_affiliate_payout    -> single-payout guarantee + state machine
--   affiliate_payable_balance  -> MODEL A raw vs MODEL B floor-zero payable
--
-- The formula here is identical to src/domain/affiliate-commission.ts and is covered
-- by the same mandatory examples (spec §29, §81, §99).
-- ============================================================================

/** Effective commission configuration: most specific valid layer wins. */
create or replace function nova.resolve_commission_config(p_affiliate_id uuid, p_sport_id uuid default null, p_campaign text default null)
returns jsonb
language plpgsql stable security definer set search_path = nova, public as $$
declare
  v_aff nova.affiliates%rowtype;
  v_cfg nova.affiliate_commission_configs%rowtype;
  v_group_ref text;
  v_source text := 'AFFILIATE';
begin
  select * into v_aff from nova.affiliates where id = p_affiliate_id;
  if not found then
    raise exception 'AFFILIATE_NOT_FOUND' using errcode = 'P0002';
  end if;

  -- CAMPAIGN scope
  if p_campaign is not null then
    select * into v_cfg from nova.affiliate_commission_configs
     where scope = 'CAMPAIGN' and scope_ref = (p_affiliate_id::text || ':' || p_campaign) and is_active
       and effective_from <= now() and (effective_to is null or effective_to > now())
     order by priority limit 1;
    if found then return to_jsonb(v_cfg) || jsonb_build_object('source', 'CAMPAIGN'); end if;
  end if;
  -- AFFILIATE scope
  select * into v_cfg from nova.affiliate_commission_configs
   where scope = 'AFFILIATE' and scope_ref = p_affiliate_id::text and is_active
     and effective_from <= now() and (effective_to is null or effective_to > now())
   order by priority limit 1;
  if found then return to_jsonb(v_cfg) || jsonb_build_object('source', 'AFFILIATE'); end if;
  -- GROUP scope
  select g.id::text into v_group_ref from nova.affiliate_group_members m
    join nova.affiliate_groups g on g.id = m.group_id where m.affiliate_id = p_affiliate_id limit 1;
  if v_group_ref is not null then
    select * into v_cfg from nova.affiliate_commission_configs
     where scope = 'GROUP' and scope_ref = v_group_ref and is_active
       and effective_from <= now() and (effective_to is null or effective_to > now())
     order by priority limit 1;
    if found then return to_jsonb(v_cfg) || jsonb_build_object('source', 'GROUP'); end if;
  end if;
  -- SPORT scope
  if p_sport_id is not null then
    select * into v_cfg from nova.affiliate_commission_configs
     where scope = 'SPORT' and scope_ref = p_sport_id::text and is_active
       and effective_from <= now() and (effective_to is null or effective_to > now())
     order by priority limit 1;
    if found then return to_jsonb(v_cfg) || jsonb_build_object('source', 'SPORT'); end if;
  end if;
  -- GLOBAL scope
  select * into v_cfg from nova.affiliate_commission_configs
   where scope = 'GLOBAL' and is_active and effective_from <= now() and (effective_to is null or effective_to > now())
   order by priority limit 1;
  if found then return to_jsonb(v_cfg) || jsonb_build_object('source', 'GLOBAL'); end if;

  -- Last resort: affiliate row values (never a silent global default).
  return jsonb_build_object(
    'commission_model', v_aff.commission_model,
    'commission_rate_bps', v_aff.commission_rate_bps,
    'allow_negative_balance', v_aff.allow_negative_balance,
    'negative_balance_floor_minor', v_aff.negative_balance_floor_minor,
    'min_payout_minor', v_aff.min_payout_minor,
    'max_payout_minor', v_aff.max_payout_minor,
    'parent_override_bps', v_aff.parent_override_bps,
    'total_net_bps_cap', v_aff.total_net_bps_cap,
    'carry_forward', v_aff.carry_forward_enabled,
    'settlement_day_iso', v_aff.settlement_day_iso,
    'settlement_timezone', v_aff.settlement_timezone,
    'source', v_source);
end $$;

/** Payable balance: raw ledger sum + floor-zero payable for non-negative models. */
create or replace function nova.affiliate_payable_balance(p_affiliate_id uuid, OUT raw_minor bigint, OUT payable_minor bigint, OUT suppressed_minor bigint, OUT floor_applied boolean, OUT currency text)
language plpgsql stable security definer set search_path = nova, public as $$
declare
  v_aff nova.affiliates%rowtype;
  v_cfg jsonb;
  v_allow_negative boolean;
  v_floor bigint;
begin
  select * into v_aff from nova.affiliates where id = p_affiliate_id;
  if not found then raise exception 'AFFILIATE_NOT_FOUND' using errcode = 'P0002'; end if;
  v_cfg := nova.resolve_commission_config(p_affiliate_id, null, null);
  v_allow_negative := coalesce((v_cfg->>'allow_negative_balance')::boolean, false);
  v_floor := greatest(coalesce((v_cfg->>'negative_balance_floor_minor')::bigint, 0), 0);
  currency := v_aff.currency;

  select coalesce(sum(amount_minor), 0) into raw_minor
    from nova.affiliate_ledger
   where affiliate_id = p_affiliate_id and status <> 'void' and type <> 'carry_forward';

  if v_allow_negative then
    payable_minor := raw_minor;
    suppressed_minor := 0;
    floor_applied := false;
  else
    -- MODEL B: the payable obligation can NEVER go negative (spec §29).
    if raw_minor < v_floor then
      payable_minor := v_floor;
      suppressed_minor := v_floor - raw_minor;
      floor_applied := true;
    else
      payable_minor := raw_minor;
      suppressed_minor := 0;
      floor_applied := false;
    end if;
  end if;
end $$;

/**
 * Commission for one settled bet. Writes IMMUTABLE ledger entries for the bet's
 * affiliate (child rate) and for each ancestor (parent override), respecting the
 * configured total cap. Idempotent per (affiliate, 'commission:<settlement>:<affiliate>').
 */
create or replace function nova.apply_bet_commission(
  p_bet_id uuid,
  p_settlement_id uuid,
  p_revision int,
  p_net_user_result_minor bigint,
  p_currency text,
  p_worker text default 'worker'
) returns int
language plpgsql security definer set search_path = nova, public as $$
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
end $$;

/**
 * WEEKLY (FRIDAY) SETTLEMENT for one affiliate.
 *   lock period -> snapshot eligible entries -> net -> carry forward -> minimum payout
 *   -> settlement row -> (optional) payout -> ledger -> audit
 * UNIQUE (affiliate_id, period_end) makes a second run in the same week a no-op.
 */
create or replace function nova.settle_affiliate_period(
  p_affiliate_id uuid,
  p_period_start timestamptz,
  p_period_end timestamptz,
  p_worker text default 'affiliate-worker',
  p_force boolean default false
) returns jsonb
language plpgsql security definer set search_path = nova, public as $$
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
  v_min_payout := coalesce((v_cfg->>'min_payout_minor')::bigint, 5000000);
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
    case when v_payable >= v_min_payout then 0 else v_payable end,
    case when v_payable >= v_min_payout then least(v_payable, coalesce(v_max_payout, v_payable)) else 0 end,
    v_suppressed, v_floor_applied, v_capped, v_aff.currency,
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

  v_closing_carry := case when v_payable >= v_min_payout then 0 else v_payable end;

  -- close the period's entries (status only; amounts are never rewritten)
  update nova.affiliate_ledger
     set status = 'settled', settled_at = now(), settlement_id = v_settlement_id
   where affiliate_id = p_affiliate_id and status = 'available'
     and created_at >= p_period_start and created_at < p_period_end;

  -- record carry-forward explicitly (positive or negative) when nothing is payable
  if v_payable < v_min_payout and v_payable <> 0 then
    insert into nova.affiliate_ledger (
      affiliate_id, type, amount_minor, currency, direction, source_kind, status,
      idempotency_key, settlement_id, metadata)
    values (
      p_affiliate_id, 'carry_forward', v_payable, v_aff.currency,
      case when v_payable >= 0 then 'credit' else 'debit' end, 'settlement', 'settled',
      'carry_forward:' || p_period_end::text, v_settlement_id,
      jsonb_build_object('week', v_week_key, 'opening_carry_minor', v_opening_carry,
                         'payable_minor', v_payable, 'below_minimum_payout_minor', v_min_payout))
    on conflict (affiliate_id, idempotency_key) do nothing;
  end if;

  -- payout when the payable balance reaches the minimum
  if v_payable >= v_min_payout and v_payable > 0 then
    v_payout := nova.create_affiliate_payout(
      p_affiliate_id, v_settlement_id, least(v_payable, coalesce(v_max_payout, v_payable)),
      v_aff.currency, 'settlement:' || v_settlement_id::text, null, 'system',
      jsonb_build_object('week_key', v_week_key, 'source', 'weekly_settlement'));
  end if;

  perform nova.audit_event(null, 'affiliate.settlement.run', 'affiliate_settlement', v_settlement_id::text,
    jsonb_build_object('opening_carry_minor', v_opening_carry, 'entries', v_entries),
    jsonb_build_object('net_minor', v_net, 'payable_minor', v_payable, 'suppressed_minor', v_suppressed,
                       'payout_id', v_payout->>'id', 'floor_applied', v_floor_applied, 'worker', p_worker),
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
end $$;

/** Create a payout. Idempotent per (affiliate, idempotency_key) and per settlement. */
create or replace function nova.create_affiliate_payout(
  p_affiliate_id uuid,
  p_settlement_id uuid,
  p_amount_minor bigint,
  p_currency text,
  p_idempotency_key text,
  p_requested_by uuid default null,
  p_source text default 'manual',
  p_metadata jsonb default '{}'::jsonb
) returns jsonb
language plpgsql security definer set search_path = nova, public as $$
declare
  v_aff nova.affiliates%rowtype;
  v_cfg jsonb;
  v_existing nova.affiliate_payouts%rowtype;
  v_payout_id uuid;
  v_public_id text;
  v_balance record;
  v_dual boolean := false;
  v_threshold bigint;
begin
  if not nova.operation_enabled('AFFILIATE_PAYOUT') then
    raise exception 'AFFILIATE_PAYOUT_DISABLED' using errcode = 'P0001';
  end if;
  if p_amount_minor is null or p_amount_minor <= 0 then
    raise exception 'VALIDATION_ERROR: payout amount must be positive' using errcode = '22023';
  end if;

  select * into v_aff from nova.affiliates where id = p_affiliate_id for update;
  if not found then raise exception 'AFFILIATE_NOT_FOUND' using errcode = 'P0002'; end if;

  -- Double-submission protection: same key returns the same payout.
  select * into v_existing from nova.affiliate_payouts
   where affiliate_id = p_affiliate_id and idempotency_key = p_idempotency_key;
  if found then
    return to_jsonb(v_existing) || jsonb_build_object('duplicate', true);
  end if;

  v_cfg := nova.resolve_commission_config(p_affiliate_id, null, null);
  if p_amount_minor < coalesce((v_cfg->>'min_payout_minor')::bigint, 0) then
    raise exception 'PAYOUT_BELOW_MINIMUM' using errcode = '22023';
  end if;

  -- Authoritative balance check (floor-zero aware).
  select * into v_balance from nova.affiliate_payable_balance(p_affiliate_id);
  if p_amount_minor > v_balance.payable_minor then
    raise exception 'INSUFFICIENT_BALANCE: payout exceeds payable balance' using errcode = 'P0001';
  end if;

  v_threshold := nullif(current_setting('nova.dual_approval_threshold', true), '')::bigint;
  v_dual := v_threshold is not null and p_amount_minor >= v_threshold;

  v_public_id := nova.new_public_id('NAP');
  insert into nova.affiliate_payouts (
    public_id, affiliate_id, settlement_id, amount_minor, currency, status, idempotency_key,
    requested_by, dual_approval_required, method, notes)
  values (
    v_public_id, p_affiliate_id, p_settlement_id, p_amount_minor, p_currency,
    case when v_dual then 'manual_review'::affiliate_payout_status else 'pending'::affiliate_payout_status end,
    p_idempotency_key, p_requested_by, v_dual, coalesce(p_metadata->>'method', 'manual'), p_metadata->>'note')
  returning id into v_payout_id;

  if p_settlement_id is not null then
    update nova.affiliate_settlements set payout_id = v_payout_id, status = 'calculated' where id = p_settlement_id;
  end if;

  perform nova.audit_event(p_requested_by, 'affiliate.payout.create', 'affiliate_payout', v_public_id,
    null, jsonb_build_object('amount_minor', p_amount_minor, 'currency', p_currency, 'dual_approval', v_dual,
                             'settlement_id', p_settlement_id, 'source', p_source),
    null, null, p_metadata);

  return jsonb_build_object('id', v_payout_id, 'public_id', v_public_id, 'status',
    case when v_dual then 'manual_review' else 'pending' end,
    'amount_minor', p_amount_minor, 'currency', p_currency, 'duplicate', false, 'dual_approval_required', v_dual);
end $$;

/** Payout state machine with an explicit, audited transition table. */
create or replace function nova.transition_affiliate_payout(
  p_payout_id uuid, p_status affiliate_payout_status, p_reason text default null, p_provider_reference text default null
) returns jsonb
language plpgsql security definer set search_path = nova, public as $$
declare
  v_actor uuid := nova.current_user_id();
  v_payout nova.affiliate_payouts%rowtype;
  v_allowed text[];
begin
  perform nova.require_admin();
  select * into v_payout from nova.affiliate_payouts where id = p_payout_id for update;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;

  v_allowed := case v_payout.status
    when 'pending' then array['eligible','cancelled','rejected','manual_review','approved']
    when 'eligible' then array['approved','manual_review','cancelled','rejected']
    when 'approved' then array['processing','cancelled','failed']
    when 'processing' then array['paid','failed']
    when 'failed' then array['pending','cancelled']
    when 'manual_review' then array['eligible','approved','rejected','cancelled']
    when 'rejected' then array['pending','cancelled']
    else array[]::text[] end;

  if not (p_status::text = any(v_allowed)) then
    raise exception 'INVALID_STATE_TRANSITION: % -> %', v_payout.status, p_status using errcode = 'P0001';
  end if;
  if p_status in ('rejected','failed','cancelled') and (p_reason is null or length(trim(p_reason)) < 8) then
    raise exception 'REASON_REQUIRED' using errcode = '22023';
  end if;
  if p_status = 'paid' and v_payout.dual_approval_required and v_payout.second_approver_id is null
     and v_payout.approved_by is distinct from v_actor then
    raise exception 'DUAL_APPROVAL_REQUIRED' using errcode = '42501';
  end if;

  update nova.affiliate_payouts
     set status = p_status,
         approved_by = case when p_status in ('approved') and approved_by is null then v_actor else approved_by end,
         approved_at = case when p_status in ('approved') and approved_at is null then now() else approved_at end,
         second_approver_id = case when p_status = 'paid' and dual_approval_required and second_approver_id is null
                                   then v_actor else second_approver_id end,
         second_approved_at = case when p_status = 'paid' and dual_approval_required and second_approved_at is null
                                   then now() else second_approved_at end,
         processing_at = case when p_status = 'processing' then now() else processing_at end,
         paid_at = case when p_status = 'paid' then now() else paid_at end,
         failed_reason = case when p_status in ('failed','rejected','cancelled') then p_reason else failed_reason end,
         provider_reference = coalesce(p_provider_reference, provider_reference),
         notes = coalesce(p_reason, notes)
   where id = p_payout_id;

  -- On payment, settle the corresponding ledger entries as paid.
  if p_status = 'paid' then
    update nova.affiliate_ledger
       set status = 'paid'
     where affiliate_id = v_payout.affiliate_id and status = 'settled' and type <> 'payout';
    update nova.affiliate_settlements set status = 'paid', settled_at = now()
     where id = v_payout.settlement_id;
  end if;

  perform nova.audit_event(v_actor, 'affiliate.payout.transition', 'affiliate_payout', v_payout.public_id,
    jsonb_build_object('status', v_payout.status), jsonb_build_object('status', p_status, 'reason', p_reason),
    p_reason, null, jsonb_build_object('provider_reference', p_provider_reference));

  return jsonb_build_object('ok', true, 'status', p_status, 'payout_id', p_payout_id);
end $$;

/** Admin financial adjustment for an affiliate (reason + before/after + audit required). */
create or replace function nova.affiliate_adjustment(
  p_affiliate_id uuid, p_amount_minor bigint, p_currency text, p_reason text, p_correlation_id text default null
) returns jsonb
language plpgsql security definer set search_path = nova, public as $$
declare
  v_actor uuid := nova.current_user_id();
  v_before bigint;
  v_after bigint;
  v_ledger_id uuid;
  v_payout_balance record;
begin
  perform nova.require_admin();
  if p_reason is null or length(trim(p_reason)) < 8 then
    raise exception 'REASON_REQUIRED' using errcode = '22023';
  end if;
  select raw_minor into v_before from nova.affiliate_payable_balance(p_affiliate_id) limit 1;
  v_before := coalesce(v_before, 0);

  insert into nova.affiliate_ledger (
    affiliate_id, type, amount_minor, currency, direction, source_kind, status, idempotency_key, metadata)
  values (
    p_affiliate_id, 'adjustment', p_amount_minor, p_currency,
    case when p_amount_minor >= 0 then 'credit' else 'debit' end, 'manual', 'available',
    'adjustment:' || v_actor::text || ':' || extract(epoch from clock_timestamp())::text,
    jsonb_build_object('reason', p_reason, 'actor', v_actor))
  returning id into v_ledger_id;

  select raw_minor into v_after from nova.affiliate_payable_balance(p_affiliate_id) limit 1;

  insert into nova.affiliate_adjustments (affiliate_id, ledger_id, amount_minor, currency, reason,
    balance_before_minor, balance_after_minor, actor_id, correlation_id)
  values (p_affiliate_id, v_ledger_id, p_amount_minor, p_currency, p_reason, v_before, v_after, v_actor, p_correlation_id);

  perform nova.audit_event(v_actor, 'affiliate.adjustment', 'affiliate', p_affiliate_id::text,
    jsonb_build_object('raw_minor', v_before), jsonb_build_object('raw_minor', v_after, 'amount_minor', p_amount_minor),
    p_reason, p_correlation_id, jsonb_build_object('ledger_id', v_ledger_id));

  return jsonb_build_object('ok', true, 'ledger_id', v_ledger_id, 'before_minor', v_before, 'after_minor', v_after);
end $$;

/** Attach a user to an affiliate: server-authoritative, self-referral and cycle safe. */
create or replace function nova.attach_attribution(
  p_user_id uuid, p_code text, p_click_id uuid default null, p_ip_hash text default null, p_device text default null
) returns jsonb
language plpgsql security definer set search_path = nova, public as $$
declare
  v_aff nova.affiliates%rowtype;
  v_existing nova.affiliate_attributions%rowtype;
  v_profile nova.profiles%rowtype;
  v_link_id uuid;
  v_campaign text;
  v_signals text[] := '{}';
  v_status attribution_status := 'confirmed';
  v_id uuid;
begin
  select * into v_aff from nova.affiliates where code = upper(p_code) or slug = lower(p_code);
  if not found then
    return jsonb_build_object('attributed', false, 'reason', 'UNKNOWN_CODE');
  end if;
  if v_aff.status <> 'approved' then
    return jsonb_build_object('attributed', false, 'reason', 'AFFILIATE_NOT_APPROVED');
  end if;

  -- One primary affiliate per user, forever (unless an admin acts explicitly).
  select * into v_existing from nova.affiliate_attributions where user_id = p_user_id;
  if found then
    return jsonb_build_object('attributed', false, 'reason', 'ALREADY_ATTRIBUTED', 'affiliate_id', v_existing.affiliate_id);
  end if;

  select * into v_profile from nova.profiles where id = p_user_id;
  if not found then raise exception 'USER_NOT_FOUND' using errcode = 'P0002'; end if;

  -- SELF-REFERRAL BLOCK (strong signals only)
  if v_profile.id = v_aff.user_id then
    insert into nova.affiliate_fraud_flags (affiliate_id, user_id, signal, severity, status, details)
    values (v_aff.id, p_user_id, 'SELF_REFERRAL', 'critical', 'blocked',
            jsonb_build_object('code', p_code, 'ip_hash', p_ip_hash));
    return jsonb_build_object('attributed', false, 'reason', 'SELF_REFERRAL_BLOCKED');
  end if;
  if v_profile.email_hash is not null and exists (
      select 1 from nova.profiles ap where ap.id = v_aff.user_id and ap.email_hash = v_profile.email_hash) then
    insert into nova.affiliate_fraud_flags (affiliate_id, user_id, signal, severity, status, details)
    values (v_aff.id, p_user_id, 'SELF_REFERRAL_EMAIL_MATCH', 'critical', 'blocked', jsonb_build_object('code', p_code));
    return jsonb_build_object('attributed', false, 'reason', 'SELF_REFERRAL_BLOCKED');
  end if;
  -- Weak signal: shared device/IP -> manual review, attribution still recorded but flagged.
  if p_device is not null and exists (
      select 1 from nova.affiliate_attributions a
       where a.affiliate_id = v_aff.id and a.device_fingerprint = p_device) then
    v_signals := array_append(v_signals, 'SAME_DEVICE');
    v_status := 'review';
  end if;
  if p_ip_hash is not null and exists (
      select 1 from nova.affiliate_clicks c where c.affiliate_id = v_aff.id and c.ip_hash = p_ip_hash
        and c.created_at > now() - interval '1 day') then
    v_signals := array_append(v_signals, 'SAME_IP');
    if v_status = 'confirmed' then v_status := 'review'; end if;
  end if;

  select id, campaign into v_link_id, v_campaign from nova.affiliate_links
   where affiliate_id = v_aff.id and code = upper(p_code) and is_active
   order by created_at limit 1;

  insert into nova.affiliate_attributions (
    affiliate_id, link_id, user_id, code, campaign, status, click_id, ip_hash, device_fingerprint,
    signals, is_immutable, confirmed_at, locked_at)
  values (
    v_aff.id, v_link_id, p_user_id, upper(p_code), v_campaign, v_status, p_click_id, p_ip_hash, p_device,
    v_signals, v_status = 'confirmed', case when v_status = 'confirmed' then now() end,
    case when v_status = 'confirmed' then now() end)
  returning id into v_id;

  if array_length(v_signals, 1) > 0 then
    insert into nova.affiliate_fraud_flags (affiliate_id, user_id, signal, severity, status, details)
    values (v_aff.id, p_user_id, v_signals[1], 'medium',
            case when v_status = 'review' then 'review' else 'suspicious' end, jsonb_build_object('signals', v_signals));
  end if;

  perform nova.audit_event(null, 'affiliate.attribution.attach', 'affiliate_attribution', v_id::text,
    null, jsonb_build_object('affiliate_id', v_aff.id, 'status', v_status, 'signals', v_signals), null, null);

  return jsonb_build_object('attributed', true, 'attribution_id', v_id, 'affiliate_id', v_aff.id,
                            'status', v_status, 'signals', v_signals);
end $$;

/** Hierarchy change with cycle + depth protection (all changes audited). */
create or replace function nova.set_affiliate_parent(
  p_child_id uuid, p_parent_id uuid, p_reason text, p_max_depth int default 3
) returns jsonb
language plpgsql security definer set search_path = nova, public as $$
declare
  v_actor uuid := nova.current_user_id();
  v_cursor uuid := p_parent_id;
  v_depth int := 0;
  v_seen uuid[] := '{}';
begin
  perform nova.require_admin();
  if p_child_id = p_parent_id then
    raise exception 'SELF_PARENT' using errcode = '22023';
  end if;
  if p_parent_id is not null and not exists (select 1 from nova.affiliates where id = p_parent_id) then
    raise exception 'PARENT_NOT_FOUND' using errcode = 'P0002';
  end if;

  -- walk up from the prospective parent: the child must never be an ancestor.
  while v_cursor is not null loop
    if v_cursor = p_child_id then
      raise exception 'CIRCULAR_HIERARCHY' using errcode = '22023';
    end if;
    if v_cursor = any(v_seen) then
      raise exception 'EXISTING_CYCLE_DETECTED' using errcode = '22023';
    end if;
    v_seen := v_seen || v_cursor;
    v_depth := v_depth + 1;
    select parent_affiliate_id into v_cursor from nova.affiliates where id = v_cursor;
  end loop;

  if v_depth > p_max_depth then
    raise exception 'MAX_DEPTH_EXCEEDED' using errcode = '22023';
  end if;

  update nova.affiliates set parent_affiliate_id = p_parent_id, depth = v_depth where id = p_child_id;

  update nova.affiliate_relationships set effective_to = now()
   where affiliate_id = p_child_id and effective_to is null;
  if p_parent_id is not null then
    insert into nova.affiliate_relationships (affiliate_id, parent_affiliate_id, depth, path, created_by, reason)
    values (p_child_id, p_parent_id, v_depth, p_parent_id::text || '/' || p_child_id::text, v_actor, p_reason);
  end if;

  perform nova.audit_event(v_actor, 'affiliate.hierarchy.change', 'affiliate', p_child_id::text,
    null, jsonb_build_object('parent_affiliate_id', p_parent_id, 'depth', v_depth), p_reason, null);
  return jsonb_build_object('ok', true, 'depth', v_depth);
end $$;

grant execute on function nova.apply_bet_commission(uuid, uuid, int, bigint, text, text) to service_role;
grant execute on function nova.settle_affiliate_period(uuid, timestamptz, timestamptz, text, boolean) to service_role;
grant execute on function nova.create_affiliate_payout(uuid, uuid, bigint, text, text, uuid, text, jsonb) to service_role;
grant execute on function nova.attach_attribution(uuid, text, uuid, text, text) to authenticated;
grant execute on function nova.set_affiliate_parent(uuid, uuid, text, int) to authenticated;
grant execute on function nova.affiliate_adjustment(uuid, bigint, text, text, text) to authenticated;
grant execute on function nova.transition_affiliate_payout(uuid, affiliate_payout_status, text, text) to authenticated;
