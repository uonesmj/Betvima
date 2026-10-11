-- Repair legacy enum collision:
-- 0001 created unqualified types and reused legacy public.* enums.
-- NOVA owns these types in the nova schema.

do $$
begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'nova' and t.typname = 'user_role') then
    create type nova.user_role as enum ('user','affiliate','support','finance','risk_manager','settlement_manager','trader','affiliate_manager','admin','super_admin');
  end if;

  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'nova' and t.typname = 'account_status') then
    create type nova.account_status as enum ('active','restricted','suspended','closed','self_excluded');
  end if;

  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'nova' and t.typname = 'kyc_status') then
    create type nova.kyc_status as enum ('not_started','pending','verified','rejected','expired');
  end if;

  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'nova' and t.typname = 'match_status') then
    create type nova.match_status as enum ('scheduled','live','paused','finished','postponed','cancelled','abandoned','interrupted','rescheduled');
  end if;

  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'nova' and t.typname = 'market_status') then
    create type nova.market_status as enum ('open','suspended','closed','settled','void','manual_review');
  end if;

  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'nova' and t.typname = 'selection_status') then
    create type nova.selection_status as enum ('open','suspended','closed','settled','void');
  end if;

  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'nova' and t.typname = 'bet_type') then
    create type nova.bet_type as enum ('SINGLE','MULTIPLE');
  end if;

  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'nova' and t.typname = 'bet_status') then
    create type nova.bet_status as enum ('pending','accepted','cashed_out','settled','partially_settled','void','cancelled','refunded','manual_review','rejected');
  end if;

  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'nova' and t.typname = 'bet_leg_status') then
    create type nova.bet_leg_status as enum ('pending','won','lost','void','half_won','half_lost','pending_review','refunded');
  end if;

  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'nova' and t.typname = 'wallet_tx_type') then
    create type nova.wallet_tx_type as enum ('deposit','withdrawal','bet_debit','bet_refund','win_credit','void_refund','bonus','adjustment','reversal','withdrawal_hold','withdrawal_release','affiliate_payout');
  end if;

  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'nova' and t.typname = 'wallet_tx_status') then
    create type nova.wallet_tx_status as enum ('pending','posted','reversed','failed','cancelled');
  end if;

  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.oid = t.typnamespace and n.nspname = 'nova' and t.typname = 'payment_tx_type') then
    create type nova.payment_tx_type as enum ('deposit','withdrawal');
  end if;

  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'nova' and t.typname = 'payment_tx_status') then
    create type nova.payment_tx_status as enum ('initiated','pending','requires_action','succeeded','failed','cancelled','expired','refunded','reversed');
  end if;

  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'nova' and t.typname = 'settlement_job_status') then
    create type nova.settlement_job_status as enum ('queued','processing','done','failed','manual_review','skipped');
  end if;

  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'nova' and t.typname = 'commission_model') then
    create type nova.commission_model as enum ('PROFIT_LOSS_35','NON_NEGATIVE_35','CPA','HYBRID');
  end if;

  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'nova' and t.typname = 'affiliate_status') then
    create type nova.affiliate_status as enum ('pending','approved','suspended','blocked','closed');
  end if;

  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'nova' and t.typname = 'affiliate_ledger_type') then
    create type nova.affiliate_ledger_type as enum ('user_loss_commission','user_win_debit','reversal','adjustment','settlement','payout','carry_forward','carry_forward_release');
  end if;

  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'nova' and t.typname = 'affiliate_ledger_status') then
    create type nova.affiliate_ledger_status as enum ('pending','available','settled','paid','void');
  end if;

  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'nova' and t.typname = 'affiliate_settlement_status') then
    create type nova.affiliate_settlement_status as enum ('draft','locked','processing','calculated','paid','partially_paid','skipped','failed','manual_review');
  end if;

  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'nova' and t.typname = 'affiliate_payout_status') then
    create type nova.affiliate_payout_status as enum ('pending','eligible','approved','processing','paid','failed','cancelled','manual_review','rejected');
  end if;

  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'nova' and t.typname = 'attribution_status') then
    create type nova.attribution_status as enum ('pending','confirmed','rejected','locked','review');
  end if;

  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'nova' and t.typname = 'commission_scope') then
    create type nova.commission_scope as enum ('GLOBAL','SPORT','GROUP','AFFILIATE','CAMPAIGN');
  end if;

  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'nova' and t.typname = 'risk_decision') then
    create type nova.risk_decision as enum ('ALLOW','LIMIT','REJECT','MANUAL_REVIEW');
  end if;

  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'nova' and t.typname = 'notification_type') then
    create type nova.notification_type as enum ('bet_accepted','bet_won','bet_lost','bet_void','bet_cashout','odds_change','deposit','withdrawal','security_alert','affiliate_commission','affiliate_settlement','affiliate_payout','system','promotion');
  end if;

  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'nova' and t.typname = 'job_status') then
    create type nova.job_status as enum ('queued','processing','succeeded','failed','dead_letter');
  end if;

  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'nova' and t.typname = 'reconciliation_status') then
    create type nova.reconciliation_status as enum ('ok','mismatch','manual_review','resolved');
  end if;
end
$$;
