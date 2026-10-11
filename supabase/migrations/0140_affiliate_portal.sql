create table if not exists nova.affiliate_payout_profiles (
  affiliate_id       uuid primary key references nova.affiliates(id) on delete cascade,
  full_name          text not null check (length(trim(full_name)) between 2 and 120),
  email              text not null check (length(trim(email)) between 5 and 254),
  account_number     text not null check (length(trim(account_number)) between 4 and 120),
  payout_method      text not null default 'bank_transfer'
                     check (payout_method in ('bank_transfer','crypto','wallet')),
  currency           text not null default 'USD'
                     check (currency = 'USD'),
  updated_at         timestamptz not null default now(),
  created_at         timestamptz not null default now()
);

create index if not exists affiliate_payout_profiles_email_idx
  on nova.affiliate_payout_profiles (lower(email));

alter table nova.affiliates
  add column if not exists payout_currency text not null default 'USD';

alter table nova.affiliates
  add column if not exists payout_minimum_minor bigint not null default 4000;

alter table nova.affiliates
  add column if not exists payout_min_active_users_weekly int not null default 5;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'affiliates_payout_currency_usd_check'
      and conrelid = 'nova.affiliates'::regclass
  ) then
    alter table nova.affiliates
      add constraint affiliates_payout_currency_usd_check
      check (payout_currency = 'USD');
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'affiliates_payout_minimum_check'
      and conrelid = 'nova.affiliates'::regclass
  ) then
    alter table nova.affiliates
      add constraint affiliates_payout_minimum_check
      check (payout_minimum_minor >= 4000);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'affiliates_payout_active_users_check'
      and conrelid = 'nova.affiliates'::regclass
  ) then
    alter table nova.affiliates
      add constraint affiliates_payout_active_users_check
      check (payout_min_active_users_weekly >= 5);
  end if;
end $$;

comment on table nova.affiliate_payout_profiles is
  'Affiliate payout identity and destination profile.';

comment on column nova.affiliates.payout_minimum_minor is
  'Minimum weekly affiliate payout in USD cents. Default $40.';

comment on column nova.affiliates.payout_min_active_users_weekly is
  'Minimum active referred users in the completed weekly period required for payout. Default 5.';
