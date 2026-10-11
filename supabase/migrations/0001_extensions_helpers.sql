-- ============================================================================
-- NOVA SPORTSBOOK - 0001 EXTENSIONS, SCHEMA, ENUMS, SHARED HELPERS
-- Every monetary value in this database is an INTEGER in MINOR UNITS (bigint).
-- Every odds value is an INTEGER scaled by 10000 (see nova.odds_scale()).
-- No floating point is used for money anywhere (spec rule 29).
-- ============================================================================

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

create schema if not exists nova;

-- Supabase provides auth.users; a vanilla PostgreSQL instance (used by the SQL test
-- harness) needs a compatible shell so migrations run unchanged in both environments.
create schema if not exists auth;
do $$
begin
  if not exists (select 1 from information_schema.tables where table_schema = 'auth' and table_name = 'users') then
    create table auth.users (
      id uuid primary key default gen_random_uuid(),
      email text,
      created_at timestamptz not null default now()
    );
  end if;
end $$;

-- ---------------------------------------------------------------- constants
create or replace function nova.odds_scale() returns bigint language sql immutable as $$ select 10000::bigint $$;
create or replace function nova.bps_den() returns bigint language sql immutable as $$ select 10000::bigint $$;

/**
 * Deterministic monetary rounding: HALF_UP away from zero, exact integer arithmetic.
 * Mirrors src/domain/money.ts#roundDiv and is used by EVERY payout/commission formula.
 */
create or replace function nova.round_div(p_num numeric, p_den numeric) returns bigint
language plpgsql immutable as $$
declare
  v_sign int;
  v_n numeric;
  v_d numeric;
  v_q numeric;
  v_r numeric;
begin
  if p_den = 0 then
    raise exception 'DIVISION_BY_ZERO' using errcode = '22012';
  end if;
  v_sign := case when (p_num < 0) <> (p_den < 0) then -1 else 1 end;
  v_n := abs(p_num);
  v_d := abs(p_den);
  v_q := div(v_n, v_d);          -- truncates toward zero
  v_r := mod(v_n, v_d);
  if v_r * 2 >= v_d then
    v_q := v_q + 1;
  end if;
  return (v_sign * v_q)::bigint;
end $$;

/** Apply a basis-point rate with the global rounding policy (3500 bps = 35%). */
create or replace function nova.apply_bps(p_amount numeric, p_bps numeric) returns bigint
language sql immutable as $$
  select nova.round_div(p_amount * p_bps, 10000::numeric)
$$;

/** Odds scaled integer -> decimal string, for API payloads and audit text. */
create or replace function nova.odds_to_text(p_odds bigint) returns text
language sql immutable as $$
  select case
    when p_odds is null then null
    when p_odds % 10000 = 0 then (p_odds / 10000)::text || '.0'
    else rtrim(rtrim(to_char(p_odds::numeric / 10000, 'FM999999990.9999'), '0'), '.')
  end
$$;

create or replace function nova.odds_from_text(p_text text) returns bigint
language plpgsql immutable as $$
declare v_clean text; v_parts text[];
begin
  v_clean := replace(trim(p_text), ',', '');
  if v_clean !~ '^\d+(\.\d{1,4})?$' then
    raise exception 'INVALID_ODDS_FORMAT: %', p_text using errcode = '22023';
  end if;
  v_parts := string_to_array(v_clean, '.');
  return (coalesce(v_parts[1], '0')::bigint * 10000)
       + (rpad(coalesce(v_parts[2], ''), 4, '0')::bigint);
end $$;

-- ---------------------------------------------------------------- trigger util
create or replace function nova.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------- identity
/**
 * Current user id resolution. Works with Supabase JWTs and with the SQL test harness,
 * which sets `nova.user_id` via set_config(). Never trusts a client-supplied body field.
 */
create or replace function nova.current_user_id() returns uuid
language plpgsql stable as $$
declare
  v_claim text;
  v_manual text;
begin
  v_manual := current_setting('nova.user_id', true);
  if v_manual is not null and v_manual <> '' then
    return v_manual::uuid;
  end if;
  v_claim := coalesce(current_setting('request.jwt.claim.sub', true),
                      (current_setting('request.jwt.claims', true)::jsonb ->> 'sub'));
  if v_claim is null or v_claim = '' then
    return null;
  end if;
  return v_claim::uuid;
exception when others then
  return null;
end $$;

create or replace function nova.current_user_role() returns text
language plpgsql stable as $$
declare
  v_role text;
  v_manual text;
begin
  v_manual := current_setting('nova.user_role', true);
  if v_manual is not null and v_manual <> '' then
    return v_manual;
  end if;
  v_role := coalesce(current_setting('request.jwt.claim.role', true),
                     (current_setting('request.jwt.claims', true)::jsonb ->> 'nova_role'));
  if v_role is null or v_role = '' then
    -- Fall back to the profile row: authoritative and always current.
    select p.role::text into v_role from nova.profiles p where p.id = nova.current_user_id();
  end if;
  return coalesce(v_role, 'anon');
exception when others then
  return 'anon';
end $$;

create or replace function nova.is_authenticated() returns boolean
language sql stable as $$ select nova.current_user_id() is not null $$;

create or replace function nova.admin_roles() returns text[]
language sql immutable as $$
  select array['support','finance','risk_manager','settlement_manager','trader','affiliate_manager','admin','super_admin']
$$;

create or replace function nova.is_admin() returns boolean
language sql stable as $$ select nova.current_user_role() = any(nova.admin_roles()) $$;

create or replace function nova.has_role(p_roles text[]) returns boolean
language sql stable as $$ select nova.current_user_role() = any(p_roles) $$;

create or replace function nova.require_admin() returns void
language plpgsql stable as $$
begin
  if not nova.is_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
end $$;

create or replace function nova.require_super_admin() returns void
language plpgsql stable as $$
begin
  if nova.current_user_role() not in ('admin','super_admin') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
end $$;

-- ---------------------------------------------------------------- enums
do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type user_role as enum ('user','affiliate','support','finance','risk_manager','settlement_manager','trader','affiliate_manager','admin','super_admin');
  end if;
  if not exists (select 1 from pg_type where typname = 'account_status') then
    create type account_status as enum ('active','restricted','suspended','closed','self_excluded');
  end if;
  if not exists (select 1 from pg_type where typname = 'kyc_status') then
    create type kyc_status as enum ('not_started','pending','verified','rejected','expired');
  end if;
  if not exists (select 1 from pg_type where typname = 'match_status') then
    create type match_status as enum ('scheduled','live','paused','finished','postponed','cancelled','abandoned','interrupted','rescheduled');
  end if;
  if not exists (select 1 from pg_type where typname = 'market_status') then
    create type market_status as enum ('open','suspended','closed','settled','void','manual_review');
  end if;
  if not exists (select 1 from pg_type where typname = 'selection_status') then
    create type selection_status as enum ('open','suspended','closed','settled','void');
  end if;
  if not exists (select 1 from pg_type where typname = 'bet_type') then
    create type bet_type as enum ('SINGLE','MULTIPLE');
  end if;
  if not exists (select 1 from pg_type where typname = 'bet_status') then
    create type bet_status as enum ('pending','accepted','cashed_out','settled','partially_settled','void','cancelled','refunded','manual_review','rejected');
  end if;
  if not exists (select 1 from pg_type where typname = 'bet_leg_status') then
    create type bet_leg_status as enum ('pending','won','lost','void','half_won','half_lost','pending_review','refunded');
  end if;
  if not exists (select 1 from pg_type where typname = 'wallet_tx_type') then
    create type wallet_tx_type as enum ('deposit','withdrawal','bet_debit','bet_refund','win_credit','void_refund','bonus','adjustment','reversal','withdrawal_hold','withdrawal_release','affiliate_payout');
  end if;
  if not exists (select 1 from pg_type where typname = 'wallet_tx_status') then
    create type wallet_tx_status as enum ('pending','posted','reversed','failed','cancelled');
  end if;
  if not exists (select 1 from pg_type where typname = 'payment_tx_type') then
    create type payment_tx_type as enum ('deposit','withdrawal');
  end if;
  if not exists (select 1 from pg_type where typname = 'payment_tx_status') then
    create type payment_tx_status as enum ('initiated','pending','requires_action','succeeded','failed','cancelled','expired','refunded','reversed');
  end if;
  if not exists (select 1 from pg_type where typname = 'settlement_job_status') then
    create type settlement_job_status as enum ('queued','processing','done','failed','manual_review','skipped');
  end if;
  if not exists (select 1 from pg_type where typname = 'commission_model') then
    create type commission_model as enum ('PROFIT_LOSS_35','NON_NEGATIVE_35','CPA','HYBRID');
  end if;
  if not exists (select 1 from pg_type where typname = 'affiliate_status') then
    create type affiliate_status as enum ('pending','approved','suspended','blocked','closed');
  end if;
  if not exists (select 1 from pg_type where typname = 'affiliate_ledger_type') then
    create type affiliate_ledger_type as enum ('user_loss_commission','user_win_debit','reversal','adjustment','settlement','payout','carry_forward','carry_forward_release');
  end if;
  if not exists (select 1 from pg_type where typname = 'affiliate_ledger_status') then
    create type affiliate_ledger_status as enum ('pending','available','settled','paid','void');
  end if;
  if not exists (select 1 from pg_type where typname = 'affiliate_settlement_status') then
    create type affiliate_settlement_status as enum ('draft','locked','processing','calculated','paid','partially_paid','skipped','failed','manual_review');
  end if;
  if not exists (select 1 from pg_type where typname = 'affiliate_payout_status') then
    create type affiliate_payout_status as enum ('pending','eligible','approved','processing','paid','failed','cancelled','manual_review','rejected');
  end if;
  if not exists (select 1 from pg_type where typname = 'attribution_status') then
    create type attribution_status as enum ('pending','confirmed','rejected','locked','review');
  end if;
  if not exists (select 1 from pg_type where typname = 'commission_scope') then
    create type commission_scope as enum ('GLOBAL','SPORT','GROUP','AFFILIATE','CAMPAIGN');
  end if;
  if not exists (select 1 from pg_type where typname = 'risk_decision') then
    create type risk_decision as enum ('ALLOW','LIMIT','REJECT','MANUAL_REVIEW');
  end if;
  if not exists (select 1 from pg_type where typname = 'notification_type') then
    create type notification_type as enum ('bet_accepted','bet_won','bet_lost','bet_void','bet_cashout','odds_change','deposit','withdrawal','security_alert','affiliate_commission','affiliate_settlement','affiliate_payout','system','promotion');
  end if;
  if not exists (select 1 from pg_type where typname = 'job_status') then
    create type job_status as enum ('queued','processing','succeeded','failed','dead_letter');
  end if;
  if not exists (select 1 from pg_type where typname = 'reconciliation_status') then
    create type reconciliation_status as enum ('ok','mismatch','manual_review','resolved');
  end if;
end $$;

-- ---------------------------------------------------------------- money guards
/** Reject zero-value ledger entries: a zero movement is never a ledger event. */
create or replace function nova.assert_nonzero_amount() returns trigger
language plpgsql as $$
begin
  if new.amount_minor = 0 then
    raise exception 'ZERO_AMOUNT_LEDGER_ENTRY' using errcode = '23514';
  end if;
  return new;
end $$;

/** Immutability guard: financial history is append-only (rule 17). */
create or replace function nova.prevent_mutation() returns trigger
language plpgsql as $$
begin
  raise exception 'IMMUTABLE_RECORD: % cannot be modified or deleted', tg_table_name using errcode = '42501';
end $$;

create or replace function nova.prevent_delete_only() returns trigger
language plpgsql as $$
begin
  raise exception 'IMMUTABLE_RECORD: % cannot be deleted', tg_table_name using errcode = '42501';
end $$;

-- ---------------------------------------------------------------- roles
-- Supabase ships these roles; a vanilla PostgreSQL (SQL test harness) does not.
-- Creating them as NOLOGIN roles keeps grants identical in both environments.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end $$;

grant usage on schema nova to anon, authenticated, service_role;
