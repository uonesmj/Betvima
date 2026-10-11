-- ============================================================================
-- 0083 - RECONCILIATION (spec §40, §78)
-- Detects mismatches between: wallet ledger, bet settlements, affiliate ledger,
-- affiliate settlements and payouts. NEVER repairs silently: it flags.
-- ============================================================================

create or replace function nova.reconcile_financial_period(
  p_period_start timestamptz,
  p_period_end timestamptz,
  p_auto_resolve boolean default false
) returns jsonb
language plpgsql security definer set search_path = nova, public as $$
declare
  v_wallet_ledger bigint;
  v_wallet_balance bigint;
  v_result jsonb := '[]'::jsonb;
  v_rec record;
  v_existing_id uuid;
  v_unsettled_payout bigint;
  v_ledger_settled bigint;
  v_commission_ledger bigint;
  v_commission_stats bigint;
  v_bet_payout bigint;
  v_wallet_win bigint;
begin
  /* ---- CHECK 1: wallets.balance_minor must equal SUM(ledger) ---- */
  for v_rec in
    select w.user_id, w.currency, w.balance_minor as balance,
           coalesce((select sum(t.amount_minor) from nova.wallet_transactions t
                      where t.wallet_id = w.id and t.status = 'posted'), 0) as ledger_sum
      from nova.wallets w
     where w.updated_at >= p_period_start - interval '1 day'
  loop
    if v_rec.balance <> v_rec.ledger_sum then
      insert into nova.reconciliation_records (period_start, period_end, check_key, expected_minor, actual_minor,
        difference_minor, status, details, affected_entities)
      values (p_period_start, p_period_end, 'wallet_balance_vs_ledger:' || v_rec.user_id::text || ':' || v_rec.currency,
        v_rec.ledger_sum, v_rec.balance, v_rec.balance - v_rec.ledger_sum, 'mismatch',
        jsonb_build_object('user_id', v_rec.user_id, 'currency', v_rec.currency),
        jsonb_build_array(jsonb_build_object('type', 'wallet', 'id', v_rec.user_id)))
      on conflict (period_start, period_end, check_key) do update
        set expected_minor = excluded.expected_minor, actual_minor = excluded.actual_minor,
            difference_minor = excluded.difference_minor, status = 'mismatch'
      returning id into v_existing_id;
      v_result := v_result || jsonb_build_object('check', 'wallet_balance_vs_ledger', 'user_id', v_rec.user_id,
        'difference_minor', v_rec.balance - v_rec.ledger_sum, 'status', 'mismatch');
    end if;
  end loop;

  /* ---- CHECK 2: bet settlements must equal wallet win/void credits ---- */
  select coalesce(sum(payout_minor), 0) into v_bet_payout
    from nova.bet_settlements where kind = 'settlement' and created_at >= p_period_start and created_at < p_period_end;
  select coalesce(sum(amount_minor), 0) into v_wallet_win
    from nova.wallet_transactions
   where type in ('win_credit','void_refund') and status = 'posted'
     and created_at >= p_period_start and created_at < p_period_end;
  if v_bet_payout <> v_wallet_win then
    insert into nova.reconciliation_records (period_start, period_end, check_key, expected_minor, actual_minor,
      difference_minor, status, details)
    values (p_period_start, p_period_end, 'bet_payouts_vs_wallet_credits', v_bet_payout, v_wallet_win,
      v_wallet_win - v_bet_payout, 'mismatch',
      jsonb_build_object('note', 'Settled payouts must equal wallet win/void credits for the period'))
    on conflict (period_start, period_end, check_key) do update
      set expected_minor = excluded.expected_minor, actual_minor = excluded.actual_minor,
          difference_minor = excluded.difference_minor, status = 'mismatch';
    v_result := v_result || jsonb_build_object('check', 'bet_payouts_vs_wallet_credits',
      'difference_minor', v_wallet_win - v_bet_payout, 'status', 'mismatch');
  end if;

  /* ---- CHECK 3: commission ledger entries must be backed by a settled bet ---- */
  for v_rec in
    select al.id, al.affiliate_id, al.amount_minor, al.bet_settlement_id
      from nova.affiliate_ledger al
     where al.type in ('user_loss_commission','user_win_debit')
       and al.created_at >= p_period_start and al.created_at < p_period_end
       and (al.bet_settlement_id is null
            or not exists (select 1 from nova.bet_settlements bs where bs.id = al.bet_settlement_id))
  loop
    insert into nova.reconciliation_records (period_start, period_end, check_key, expected_minor, actual_minor,
      difference_minor, status, details, affected_entities)
    values (p_period_start, p_period_end, 'commission_without_settlement:' || v_rec.id::text,
      0, v_rec.amount_minor, v_rec.amount_minor, 'manual_review',
      jsonb_build_object('affiliate_id', v_rec.affiliate_id, 'ledger_id', v_rec.id),
      jsonb_build_array(jsonb_build_object('type', 'affiliate_ledger', 'id', v_rec.id)))
    on conflict (period_start, period_end, check_key) do nothing;
    v_result := v_result || jsonb_build_object('check', 'commission_without_settlement',
      'ledger_id', v_rec.id, 'status', 'manual_review');
  end loop;

  /* ---- CHECK 4: paid payouts must be covered by ledger entries ---- */
  for v_rec in
    select p.id, p.affiliate_id, p.amount_minor, p.currency,
           coalesce((select sum(amount_minor) from nova.affiliate_ledger al
                      where al.affiliate_id = p.affiliate_id and al.status in ('settled','paid')), 0) as ledger_sum
      from nova.affiliate_payouts p
     where p.status = 'paid' and p.paid_at >= p_period_start and p.paid_at < p_period_end
  loop
    if v_rec.amount_minor > v_rec.ledger_sum then
      insert into nova.reconciliation_records (period_start, period_end, check_key, expected_minor, actual_minor,
        difference_minor, status, details, affected_entities)
      values (p_period_start, p_period_end, 'payout_exceeds_ledger:' || v_rec.id::text,
        v_rec.ledger_sum, v_rec.amount_minor, v_rec.amount_minor - v_rec.ledger_sum, 'manual_review',
        jsonb_build_object('affiliate_id', v_rec.affiliate_id, 'payout_id', v_rec.id),
        jsonb_build_array(jsonb_build_object('type', 'affiliate_payout', 'id', v_rec.id)))
      on conflict (period_start, period_end, check_key) do nothing;
      v_result := v_result || jsonb_build_object('check', 'payout_exceeds_ledger', 'payout_id', v_rec.id,
        'status', 'manual_review');
    end if;
  end loop;

  /* ---- CHECK 5: settled bets must have graded legs and a settlement row ---- */
  for v_rec in
    select b.id, b.public_id from nova.bets b
     where b.status in ('settled','void','partially_settled')
       and b.settled_at >= p_period_start and b.settled_at < p_period_end
       and not exists (select 1 from nova.bet_settlements s where s.bet_id = b.id and s.kind = 'settlement')
  loop
    insert into nova.reconciliation_records (period_start, period_end, check_key, expected_minor, actual_minor,
      difference_minor, status, details, affected_entities)
    values (p_period_start, p_period_end, 'settled_bet_without_record:' || v_rec.id::text, 0, 0, 0, 'manual_review',
      jsonb_build_object('bet_public_id', v_rec.public_id),
      jsonb_build_array(jsonb_build_object('type', 'bet', 'id', v_rec.id)))
    on conflict (period_start, period_end, check_key) do nothing;
    v_result := v_result || jsonb_build_object('check', 'settled_bet_without_record', 'bet_id', v_rec.id,
      'status', 'manual_review');
  end loop;

  /* ---- CHECK 6: MODEL B payable must never be negative ---- */
  for v_rec in
    select a.id as affiliate_id, a.public_id as public_id, b.raw_minor, b.payable_minor, b.floor_applied
      from nova.affiliates a
      cross join lateral nova.affiliate_payable_balance(a.id) b
     where a.status = 'approved'
  loop
    if v_rec.payable_minor < 0 then
      insert into nova.reconciliation_records (period_start, period_end, check_key, expected_minor, actual_minor,
        difference_minor, status, details, affected_entities)
      values (p_period_start, p_period_end, 'negative_payable:' || v_rec.affiliate_id::text, 0,
        v_rec.payable_minor, v_rec.payable_minor, 'manual_review',
        jsonb_build_object('affiliate_public_id', v_rec.public_id, 'raw_minor', v_rec.raw_minor),
        jsonb_build_array(jsonb_build_object('type', 'affiliate', 'id', v_rec.affiliate_id)))
      on conflict (period_start, period_end, check_key) do nothing;
      v_result := v_result || jsonb_build_object('check', 'negative_payable', 'affiliate_id', v_rec.affiliate_id,
        'payable_minor', v_rec.payable_minor, 'status', 'manual_review');
    end if;
  end loop;

  if p_auto_resolve then
    update nova.reconciliation_records set status = 'resolved', resolved_at = now(), resolution_note = 'auto: recorded only'
     where period_start = p_period_start and period_end = p_period_end and status = 'manual_review';
  end if;

  return jsonb_build_object('ok', true, 'period_start', p_period_start, 'period_end', p_period_end,
    'findings', v_result, 'finding_count', jsonb_array_length(v_result));
end $$;

/** Latest reconciliation status per check, for the admin finance panel. */
drop view if exists nova.reconciliation_status_view;
create or replace view nova.reconciliation_status_view as
select distinct on (check_key) check_key, status, difference_minor, created_at, details, resolved_at
  from nova.reconciliation_records
 order by check_key, created_at desc;

grant execute on function nova.reconcile_financial_period(timestamptz, timestamptz, boolean) to service_role;
