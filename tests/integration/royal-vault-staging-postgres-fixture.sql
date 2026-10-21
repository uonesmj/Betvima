\set ON_ERROR_STOP on
-- REQUIRES disposable PostgreSQL created by GitHub Actions.
-- Synthetic data only, never customer emails, credentials or production money.
\i tests/integration/softaggregator-financial-migration-smoke.sql
\i tests/integration/softaggregator-cash-postgres-fixture.sql

alter table nova.user_limits add column max_payout_per_bet_minor bigint;
create table nova.kyc_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references nova.profiles(id),
  status text not null,
  legal_age_confirmed boolean not null default false,
  reviewed_by uuid
);
insert into nova.kyc_submissions (user_id,status,legal_age_confirmed,reviewed_by)
  values('00000000-0000-4000-8000-000000000002','verified',true,
         '00000000-0000-4000-8000-000000000099');

-- Second wallet reserved for the isolated parallel-spend test.
insert into nova.profiles(id,status,age_verified,kyc_status,jurisdiction,preferred_currency)
  values('00000000-0000-4000-8000-000000000003','active',true,'verified','DE','USD');
insert into nova.kyc_submissions (user_id,status,legal_age_confirmed,reviewed_by)
  values('00000000-0000-4000-8000-000000000003','verified',true,
         '00000000-0000-4000-8000-000000000099');
insert into nova.wallets(user_id,currency,balance_minor)
  values('00000000-0000-4000-8000-000000000003','USD',10);
insert into nova.wallet_transactions(wallet_id,user_id,type,amount_minor,
    balance_after_minor,currency,status,reference,idempotency_key)
  select id,user_id,'deposit',10,10,currency,'posted','synthetic-stage-seed','originals-seed-10'
  from nova.wallets where user_id='00000000-0000-4000-8000-000000000003';
insert into nova.user_limits(user_id,currency,max_stake_per_day_minor)
  values('00000000-0000-4000-8000-000000000003','USD',10);

\i docs/pending-financial-migrations/0219_originals_royal_vault_rounds_staging_only.sql

DO $verify$
begin
  if not exists(select 1 from pg_class where oid='nova.originals_rounds'::regclass
    and relrowsecurity and relforcerowsecurity) then
    raise exception 'ORIGINALS_STAGING_RLS_NOT_ENFORCED';
  end if;
  if (select count(*) from pg_trigger where tgrelid='nova.originals_rounds'::regclass
    and tgname in ('originals_pair_integrity','originals_rounds_immutable')
    and tgenabled<>'D') <> 2 then
    raise exception 'ORIGINALS_STAGING_TRIGGERS_MISSING';
  end if;
  if has_table_privilege('anon','nova.originals_rounds','INSERT,UPDATE,DELETE')
     or has_table_privilege('authenticated','nova.originals_rounds','INSERT,UPDATE,DELETE') then
    raise exception 'ORIGINALS_STAGING_API_ROLES_WRITE_ALLOWED';
  end if;
end;
$verify$;
