-- ============================================================================
-- 0081 - SETTLEMENT RPC: enqueue / settle_bet / reverse_bet_settlement / manual decisions
-- Idempotency: UNIQUE (bet_id, revision, kind) on nova.bet_settlements plus a terminal-state
-- guard mean a bet can never be settled or paid twice (rules 20, 33).
-- ============================================================================

/** Queue every open bet of a match for settlement (idempotent per (bet_id, reason)). */
create or replace function nova.enqueue_match_settlement(p_match_id uuid, p_reason text)
returns int
language plpgsql security definer set search_path = nova, public as $$
declare v_count int := 0;
begin
  insert into nova.settlement_jobs (bet_id, match_id, user_id, reason)
  select distinct b.id, p_match_id, b.user_id, p_reason
    from nova.bet_legs l
    join nova.bets b on b.id = l.bet_id
   where l.match_id = p_match_id
     and b.status in ('accepted','partially_settled','manual_review')
  on conflict (bet_id, reason) do nothing;
  get diagnostics v_count = row_count;
  insert into nova.settlement_events (match_id, event, detail, actor, correlation_id)
  values (p_match_id, 'enqueued', jsonb_build_object('reason', p_reason, 'count', v_count), 'system', null);
  return v_count;
end $$;

/** Claim due jobs with row locks (multiple workers are safe). */
create or replace function nova.claim_settlement_jobs(p_worker_id text, p_limit int, p_lock_ttl_seconds int default 300)
returns setof nova.settlement_jobs
language plpgsql security definer set search_path = nova, public as $$
begin
  return query
  with claimable as (
    select id from nova.settlement_jobs
     where (status = 'queued' and run_after <= now())
        or (status = 'failed' and attempts < 5 and run_after <= now())
        or (status = 'processing' and locked_at < now() - make_interval(secs => p_lock_ttl_seconds))
     order by run_after
     limit p_limit
     for update skip locked
  )
  update nova.settlement_jobs j
     set status = 'processing', locked_by = p_worker_id, locked_at = now(), attempts = j.attempts + 1
    from claimable c
   where j.id = c.id
  returning j.*;
end $$;

create or replace function nova.complete_settlement_job(p_job_id uuid, p_status settlement_job_status, p_error text default null)
returns void language sql security definer set search_path = nova, public as $$
  update nova.settlement_jobs
     set status = p_status, processed_at = case when p_status in ('done','skipped','manual_review') then now() else processed_at end,
         last_error = coalesce(p_error, last_error), locked_by = null, locked_at = null
   where id = p_job_id;
$$;

/**
 * ATOMIC SETTLEMENT OF ONE BET.
 *   graded legs -> bet status -> wallet credit (idempotent) -> ledger -> affiliate commission -> audit
 * Returns the outcome; replaying the same (bet_id, revision) returns idempotent_replay=true
 * and never credits twice.
 */
create or replace function nova.settle_bet(
  p_bet_id        uuid,
  p_graded_legs   jsonb,        -- [{"selection_id":..,"grade":"WON|LOST|VOID|HALF_WON|HALF_LOST","reason":".."}]
  p_payout_minor  bigint,       -- computed by the settlement engine from authoritative odds
  p_currency      text,
  p_revision      int default 1,
  p_worker        text default 'worker',
  p_correlation_id text default null,
  p_operator_id   uuid default null,
  p_notes         text default null
) returns jsonb
language plpgsql
security definer
set search_path = nova, public
as $$
declare
  v_bet           nova.bets%rowtype;
  v_existing      nova.bet_settlements%rowtype;
  v_status        bet_status;
  v_leg           jsonb;
  v_grade         text;
  v_noop          boolean := false;
  v_ledger        jsonb := null;
  v_settlement_id uuid;
  v_net           bigint;
  v_any_lost      boolean := false;
  v_all_void      boolean := true;
  v_half          boolean := false;
  v_credit_type   wallet_tx_type;
  v_tx_id         uuid;
  v_leg_status    bet_leg_status;
begin
  if not nova.operation_enabled('SETTLEMENT') then
    raise exception 'SETTLEMENT_DISABLED' using errcode = 'P0001';
  end if;
  if p_payout_minor is null or p_payout_minor < 0 then
    raise exception 'VALIDATION_ERROR: payout must be >= 0' using errcode = '22023';
  end if;

  select * into v_bet from nova.bets where id = p_bet_id for update;
  if not found then
    raise exception 'NOT_FOUND: bet %', p_bet_id using errcode = 'P0002';
  end if;

  -- Idempotency guard #1: same revision already settled.
  select * into v_existing from nova.bet_settlements
   where bet_id = p_bet_id and revision = p_revision and kind = 'settlement';
  if found then
    return jsonb_build_object('ok', true, 'idempotent_replay', true, 'bet_id', p_bet_id,
      'settlement_id', v_existing.id, 'payout_minor', v_existing.payout_minor,
      'status', v_existing.status_after, 'ledger_transaction_id', v_existing.wallet_transaction_id);
  end if;

  -- Idempotency guard #2: terminal state.
  if v_bet.status in ('settled','void','refunded','cancelled') then
    return jsonb_build_object('ok', true, 'idempotent_replay', true, 'bet_id', p_bet_id,
      'status', v_bet.status, 'payout_minor', v_bet.payout_minor, 'already_terminal', true);
  end if;

  /* -------- classify the graded legs -------- */
  for v_leg in select * from jsonb_array_elements(p_graded_legs)
  loop
    v_grade := upper(v_leg->>'grade');
    v_leg_status := case v_grade
      when 'WON' then 'won'::bet_leg_status
      when 'LOST' then 'lost'::bet_leg_status
      when 'VOID' then 'void'::bet_leg_status
      when 'HALF_WON' then 'half_won'::bet_leg_status
      when 'HALF_LOST' then 'half_lost'::bet_leg_status
      when 'REFUNDED' then 'refunded'::bet_leg_status
      else 'pending_review'::bet_leg_status end;
    if v_leg_status = 'pending_review' then
      raise exception 'INVALID_STATE_TRANSITION: leg requires manual review' using errcode = 'P0001';
    end if;
    if v_leg_status = 'lost' then v_any_lost := true; end if;
    if v_leg_status <> 'void' then v_all_void := false; end if;
    if v_leg_status in ('half_won','half_lost') then v_half := true; end if;

    update nova.bet_legs
       set status = v_leg_status,
           grade_reason = v_leg->>'reason',
           result_revision = p_revision,
           score_snapshot = coalesce(v_leg->>'score', score_snapshot),
           settled_at = now()
     where bet_id = p_bet_id and selection_id = (v_leg->>'selection_id')::uuid;
  end loop;

  if v_all_void then
    v_status := 'void';
    v_credit_type := 'void_refund';
  elsif v_half then
    v_status := 'partially_settled';
    v_credit_type := 'win_credit';
  else
    v_status := 'settled';
    v_credit_type := 'win_credit';
  end if;
  if v_any_lost and p_payout_minor <> 0 then
    raise exception 'VALIDATION_ERROR: a bet with a losing leg cannot pay out' using errcode = '22023';
  end if;

  v_net := p_payout_minor - v_bet.stake_minor;

  /* -------- wallet credit (idempotent by key) -------- */
  v_ledger := null;
  v_tx_id := null;
  if p_payout_minor > 0 then
    v_ledger := nova.credit_wallet(
      v_bet.user_id, v_credit_type, p_payout_minor, p_currency,
      'settle:' || p_bet_id::text || ':' || p_revision::text,
      v_bet.public_id, p_bet_id, null,
      case when v_status = 'void' then 'Void refund' else 'Winning bet payout' end,
      p_operator_id, jsonb_build_object('revision', p_revision, 'worker', p_worker));
    v_tx_id := (v_ledger->>'transaction_id')::uuid;
  end if;

  /* -------- settlement row + bet status -------- */
  insert into nova.bet_settlements (
    bet_id, revision, kind, status_before, status_after, payout_minor, currency, stake_minor,
    net_user_result_minor, graded_legs, wallet_transaction_id, settled_by, operator_id, correlation_id, notes)
  values (
    p_bet_id, p_revision, 'settlement', v_bet.status, v_status, p_payout_minor, p_currency, v_bet.stake_minor,
    v_net, coalesce(p_graded_legs, '[]'::jsonb), v_tx_id, p_worker, p_operator_id, p_correlation_id, p_notes)
  returning id into v_settlement_id;

  update nova.bets
     set status = v_status,
         payout_minor = p_payout_minor,
         settled_at = now(),
         result_revision = p_revision,
         settlement_attempts = settlement_attempts + 1
   where id = p_bet_id;

  insert into nova.settlement_events (bet_id, event, detail, actor, correlation_id)
  values (p_bet_id, 'settled',
    jsonb_build_object('revision', p_revision, 'status', v_status, 'payout_minor', p_payout_minor, 'net_user_result_minor', v_net),
    p_worker, p_correlation_id);

  /* -------- affiliate commission (same transaction; deterministic formula) -------- */
  perform nova.apply_bet_commission(p_bet_id, v_settlement_id, p_revision, v_net, p_currency, p_worker);

  perform nova.audit_event(coalesce(p_operator_id, v_bet.user_id), 'bet.settled', 'bet', v_bet.public_id,
    jsonb_build_object('status', v_bet.status),
    jsonb_build_object('status', v_status, 'payout_minor', p_payout_minor, 'revision', p_revision),
    p_notes, p_correlation_id, jsonb_build_object('worker', p_worker));

  return jsonb_build_object('ok', true, 'idempotent_replay', false, 'bet_id', p_bet_id,
    'settlement_id', v_settlement_id, 'status', v_status, 'payout_minor', p_payout_minor,
    'net_user_result_minor', v_net, 'ledger_transaction_id', v_tx_id,
    'wallet_balance_minor', case when v_ledger is null then null else (v_ledger->>'balance_after_minor')::bigint end);
exception
  when unique_violation then
    select * into v_existing from nova.bet_settlements where bet_id = p_bet_id and revision = p_revision and kind = 'settlement';
    if found then
      return jsonb_build_object('ok', true, 'idempotent_replay', true, 'bet_id', p_bet_id,
        'settlement_id', v_existing.id, 'status', v_existing.status_after, 'payout_minor', v_existing.payout_minor);
    end if;
    raise;
end $$;

/**
 * RE-GRADE / REVERSAL. Historical records are never modified:
 * a reversal settlement row, a reversal ledger entry and affiliate reversal entries are appended.
 */
create or replace function nova.reverse_bet_settlement(
  p_bet_id uuid, p_reason text, p_actor_id uuid default null, p_correlation_id text default null
) returns jsonb
language plpgsql security definer set search_path = nova, public as $$
declare
  v_bet nova.bets%rowtype;
  v_settlement nova.bet_settlements%rowtype;
  v_reversal_tx uuid;
  v_reversal_id uuid;
  v_affiliate record;
begin
  perform nova.require_admin();
  if p_reason is null or length(trim(p_reason)) < 8 then
    raise exception 'REASON_REQUIRED' using errcode = '22023';
  end if;

  select * into v_bet from nova.bets where id = p_bet_id for update;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;

  select * into v_settlement from nova.bet_settlements
   where bet_id = p_bet_id and kind = 'settlement'
   order by revision desc limit 1;
  if not found then
    return jsonb_build_object('reversed', false, 'reason', 'NO_SETTLEMENT');
  end if;
  if v_settlement.reversed_by is not null then
    return jsonb_build_object('reversed', false, 'reason', 'ALREADY_REVERSED', 'reversal_id', v_settlement.reversed_by);
  end if;

  -- 1) reverse the wallet credit (append-only reversal entry)
  if v_settlement.wallet_transaction_id is not null and v_settlement.payout_minor > 0 then
    insert into nova.wallet_transactions (
      wallet_id, user_id, type, amount_minor, balance_after_minor, currency, status,
      reference, bet_id, reversal_of, idempotency_key, reason, actor_id, metadata)
    select w.id, v_bet.user_id, 'reversal', -v_settlement.payout_minor,
           w.balance_minor - v_settlement.payout_minor, v_settlement.currency, 'posted',
           v_bet.public_id, p_bet_id, v_settlement.wallet_transaction_id,
           'reverse:' || v_settlement.id::text, p_reason, p_actor_id,
           jsonb_build_object('settlement_id', v_settlement.id)
      from nova.wallets w where w.user_id = v_bet.user_id and w.currency = v_settlement.currency
    returning id into v_reversal_tx;
    update nova.wallets set balance_minor = balance_minor - v_settlement.payout_minor, version = version + 1
     where user_id = v_bet.user_id and currency = v_settlement.currency;
  end if;

  -- 2) reversal settlement row
  insert into nova.bet_settlements (
    bet_id, revision, kind, status_before, status_after, payout_minor, currency, stake_minor,
    net_user_result_minor, graded_legs, wallet_transaction_id, reversal_of, settled_by, operator_id, correlation_id, notes)
  values (
    p_bet_id, v_settlement.revision, 'reversal', v_bet.status, 'pending', -v_settlement.payout_minor, v_settlement.currency,
    v_settlement.stake_minor, -v_settlement.net_user_result_minor, v_settlement.graded_legs, v_reversal_tx,
    v_settlement.id, 'reversal:' || p_reason, p_actor_id, p_correlation_id, p_reason)
  returning id into v_reversal_id;

  update nova.bet_settlements set reversed_by = v_reversal_id where id = v_settlement.id;

  -- 3) reverse affiliate commission entries for this bet (append-only)
  for v_affiliate in
    select affiliate_id, sum(amount_minor) as amount, currency
      from nova.affiliate_ledger
     where bet_id = p_bet_id and reverse_of is null and status <> 'void'
     group by affiliate_id, currency
  loop
    insert into nova.affiliate_ledger (
      affiliate_id, type, amount_minor, currency, direction, commission_rate_bps, applied_rate_bps,
      source_amount_minor, source_kind, user_id, bet_id, bet_settlement_id, status, idempotency_key, reverse_of, metadata)
    select al.affiliate_id, 'reversal', -v_affiliate.amount, v_affiliate.currency,
           case when -v_affiliate.amount >= 0 then 'credit' else 'debit' end,
           al.commission_rate_bps, 0, 0, 'bet_regrade', v_bet.user_id, p_bet_id, v_settlement.id, 'void',
           'reversal:' || v_settlement.id::text || ':' || v_affiliate.affiliate_id::text, min(al.id),
           jsonb_build_object('reason', p_reason, 'settlement_id', v_settlement.id)
      from nova.affiliate_ledger al
     where al.bet_id = p_bet_id and al.affiliate_id = v_affiliate.affiliate_id
     group by al.affiliate_id, al.commission_rate_bps, v_affiliate.amount, v_affiliate.currency
    on conflict (affiliate_id, idempotency_key) do nothing;
  end loop;

  -- 4) bet returns to a settleable state
  update nova.bets set status = 'pending', settled_at = null where id = p_bet_id;
  update nova.bet_legs set status = 'pending', settled_at = null, grade_reason = 'REGRADE_REVERSAL' where bet_id = p_bet_id;

  insert into nova.settlement_events (bet_id, event, detail, actor, correlation_id)
  values (p_bet_id, 'reversed',
    jsonb_build_object('settlement_id', v_settlement.id, 'reversal_id', v_reversal_id, 'amount_minor', v_settlement.payout_minor, 'reason', p_reason),
    coalesce(p_actor_id::text, 'system'), p_correlation_id);

  perform nova.audit_event(p_actor_id, 'bet.settlement.reversed', 'bet', v_bet.public_id,
    jsonb_build_object('settlement_id', v_settlement.id, 'payout_minor', v_settlement.payout_minor),
    jsonb_build_object('reversal_id', v_reversal_id, 'status', 'pending'),
    p_reason, p_correlation_id);

  return jsonb_build_object('reversed', true, 'reversal_id', v_reversal_id, 'ledger_transaction_id', v_reversal_tx);
end $$;

/** Operator decision for a bet parked in manual review (accept / void / reject). */
create or replace function nova.manual_settle_decision(
  p_bet_id uuid, p_decision text, p_reason text, p_correlation_id text default null
) returns jsonb
language plpgsql security definer set search_path = nova, public as $$
declare
  v_actor uuid := nova.current_user_id();
  v_bet nova.bets%rowtype;
  v_legs jsonb;
begin
  perform nova.require_admin();
  if p_decision not in ('void','refund','reject','settle_won','settle_lost') then
    raise exception 'VALIDATION_ERROR: unknown decision' using errcode = '22023';
  end if;
  if p_reason is null or length(trim(p_reason)) < 8 then
    raise exception 'REASON_REQUIRED' using errcode = '22023';
  end if;
  select * into v_bet from nova.bets where id = p_bet_id;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;

  select coalesce(jsonb_agg(jsonb_build_object('selection_id', l.selection_id,
    'grade', case p_decision
      when 'void' then 'VOID' when 'refund' then 'VOID'
      when 'settle_won' then 'WON' when 'settle_lost' then 'LOST' else 'VOID' end,
    'reason', 'OPERATOR_DECISION:' || p_decision)), '[]'::jsonb)
    into v_legs from nova.bet_legs l where l.bet_id = p_bet_id;

  if p_decision = 'reject' then
    update nova.bets set status = 'cancelled' where id = p_bet_id;
    perform nova.audit_event(v_actor, 'bet.manual_decision', 'bet', v_bet.public_id, jsonb_build_object('status', v_bet.status),
      jsonb_build_object('status','cancelled'), p_reason, p_correlation_id);
    return jsonb_build_object('ok', true, 'status', 'cancelled');
  end if;

  return nova.settle_bet(p_bet_id, v_legs,
    case when p_decision = 'settle_won' then nova.round_div(v_bet.stake_minor::numeric * v_bet.combined_odds_num, v_bet.combined_odds_den)
         when p_decision in ('void','refund') then v_bet.stake_minor
         else 0 end,
    v_bet.currency, v_bet.result_revision + 1, 'manual:' || coalesce(v_actor::text,'operator'),
    p_correlation_id, v_actor, p_reason);
end $$;

/** Bets whose legs are all graded but the bet row is not terminal (crash recovery). */
create or replace function nova.find_stuck_bets(p_limit int default 50)
returns setof nova.bets
language sql stable security definer set search_path = nova, public as $$
  select b.* from nova.bets b
   where b.status in ('accepted','partially_settled')
     and exists (select 1 from nova.bet_legs l where l.bet_id = b.id)
     and not exists (select 1 from nova.bet_legs l where l.bet_id = b.id and l.status = 'pending')
   order by b.placed_at
   limit p_limit;
$$;

grant execute on function nova.place_bet(uuid, text, bet_type, bigint, text, jsonb, boolean, text, text, text, text, text, int, int, int) to service_role;
grant execute on function nova.settle_bet(uuid, jsonb, bigint, text, int, text, text, uuid, text) to service_role;
grant execute on function nova.enqueue_match_settlement(uuid, text) to service_role;
grant execute on function nova.claim_settlement_jobs(text, int, int) to service_role;
grant execute on function nova.complete_settlement_job(uuid, settlement_job_status, text) to service_role;
grant execute on function nova.reverse_bet_settlement(uuid, text, uuid, text) to authenticated;
grant execute on function nova.manual_settle_decision(uuid, text, text, text) to authenticated;
