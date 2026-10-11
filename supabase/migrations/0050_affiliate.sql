-- ============================================================================
-- 0050 - AFFILIATE / REFERRAL SYSTEM
-- Independent, immutable affiliate ledger. Commission is derived from
-- AUTHORITATIVE settled betting results only (spec §32).
-- ============================================================================

create table if not exists nova.affiliates (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null unique references nova.profiles (id) on delete cascade,
  public_id             text not null unique,
  code                  text not null unique check (code ~ '^[A-Z0-9]{4,16}$'),
  slug                  text not null unique,
  display_name          text,
  status                affiliate_status not null default 'pending',
  commission_model      commission_model not null default 'NON_NEGATIVE_35',
  commission_rate_bps   int not null default 3500 check (commission_rate_bps between 0 and 10000),
  allow_negative_balance boolean not null default false,
  negative_balance_floor_minor bigint not null default 0,
  min_payout_minor      bigint not null default 5000000,
  max_payout_minor      bigint,
  currency              text not null default 'IRT',
  parent_affiliate_id   uuid references nova.affiliates (id),
  depth                 int not null default 0 check (depth >= 0 and depth <= 3),
  parent_override_bps   int not null default 0 check (parent_override_bps between 0 and 10000),
  total_net_bps_cap     int check (total_net_bps_cap is null or total_net_bps_cap between 0 and 10000),
  settlement_day_iso    int not null default 5 check (settlement_day_iso between 1 and 7), -- 5 = Friday
  settlement_hour       int not null default 3 check (settlement_hour between 0 and 23),
  settlement_minute     int not null default 0 check (settlement_minute between 0 and 59),
  settlement_timezone   text not null default 'Asia/Tehran',
  auto_payout_enabled   boolean not null default false,
  carry_forward_enabled boolean not null default true,
  created_at            timestamptz not null default now(),
  approved_at           timestamptz,
  updated_at            timestamptz not null default now(),
  check (parent_affiliate_id is null or parent_affiliate_id <> id)
);
create index if not exists affiliates_status_idx on nova.affiliates (status);
create index if not exists affiliates_parent_idx on nova.affiliates (parent_affiliate_id);
drop trigger if exists affiliates_updated_at on nova.affiliates;
create trigger affiliates_updated_at before update on nova.affiliates for each row execute function nova.set_updated_at();

create table if not exists nova.affiliate_links (
  id            uuid primary key default gen_random_uuid(),
  affiliate_id  uuid not null references nova.affiliates (id) on delete cascade,
  code          text not null,
  campaign      text not null default 'default',
  source        text,
  medium        text,
  landing_path  text not null default '/',
  label         text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  unique (code, campaign)
);
create index if not exists affiliate_links_affiliate_idx on nova.affiliate_links (affiliate_id, is_active);

create table if not exists nova.affiliate_campaigns (
  id            uuid primary key default gen_random_uuid(),
  affiliate_id  uuid not null references nova.affiliates (id) on delete cascade,
  name          text not null,
  source        text,
  medium        text,
  landing_path  text not null default '/',
  status        text not null default 'active' check (status in ('draft','active','paused','archived')),
  budget_minor  bigint,
  spend_minor   bigint not null default 0,
  starts_at     timestamptz,
  ends_at       timestamptz,
  created_at    timestamptz not null default now(),
  unique (affiliate_id, name)
);

create table if not exists nova.affiliate_clicks (
  id                uuid primary key default gen_random_uuid(),
  affiliate_id      uuid not null references nova.affiliates (id) on delete cascade,
  link_id           uuid references nova.affiliate_links (id) on delete set null,
  code              text not null,
  campaign          text,
  ip_hash           text,
  user_agent_hash   text,
  device_fingerprint text,
  referrer          text,
  landing_path      text not null,
  is_likely_bot     boolean not null default false,
  is_duplicate      boolean not null default false,
  converted_at      timestamptz,
  created_at        timestamptz not null default now()
);
create index if not exists affiliate_clicks_affiliate_idx on nova.affiliate_clicks (affiliate_id, created_at desc);
create index if not exists affiliate_clicks_ip_idx on nova.affiliate_clicks (affiliate_id, ip_hash);

create table if not exists nova.affiliate_attributions (
  id                uuid primary key default gen_random_uuid(),
  affiliate_id      uuid not null references nova.affiliates (id) on delete restrict,
  link_id           uuid references nova.affiliate_links (id) on delete set null,
  user_id           uuid not null unique references nova.profiles (id) on delete cascade,
  code              text not null,
  campaign          text,
  status            attribution_status not null default 'pending',
  click_id          uuid references nova.affiliate_clicks (id) on delete set null,
  ip_hash           text,
  device_fingerprint text,
  signals           text[] not null default '{}',
  is_immutable      boolean not null default false,
  confirmed_at      timestamptz,
  locked_at         timestamptz,
  rejection_reason  text,
  first_deposit_at  timestamptz,
  first_bet_at      timestamptz,
  activated_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists affiliate_attributions_affiliate_idx on nova.affiliate_attributions (affiliate_id, status);
drop trigger if exists affiliate_attributions_updated_at on nova.affiliate_attributions;
create trigger affiliate_attributions_updated_at before update on nova.affiliate_attributions for each row execute function nova.set_updated_at();

/** Attribution immutability: once confirmed+locked the row may not be re-pointed (rule §26). */
create or replace function nova.guard_attribution_immutable() returns trigger
language plpgsql as $$
begin
  if old.is_immutable
     and (new.affiliate_id <> old.affiliate_id or new.user_id <> old.user_id or new.code <> old.code) then
    if not nova.is_admin() then
      raise exception 'ATTRIBUTION_LOCKED' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists affiliate_attributions_locked on nova.affiliate_attributions;
create trigger affiliate_attributions_locked before update on nova.affiliate_attributions
  for each row execute function nova.guard_attribution_immutable();

create table if not exists nova.affiliate_relationships (
  id                 uuid primary key default gen_random_uuid(),
  affiliate_id       uuid not null references nova.affiliates (id) on delete cascade,
  parent_affiliate_id uuid not null references nova.affiliates (id) on delete cascade,
  depth              int not null,
  path               text not null,
  effective_from     timestamptz not null default now(),
  effective_to       timestamptz,
  created_by         uuid references nova.profiles (id),
  reason             text,
  created_at         timestamptz not null default now(),
  check (affiliate_id <> parent_affiliate_id)
);
create index if not exists affiliate_relationships_child_idx on nova.affiliate_relationships (affiliate_id, effective_to);

create table if not exists nova.affiliate_commission_configs (
  id                    uuid primary key default gen_random_uuid(),
  scope                 commission_scope not null,
  scope_ref             text,
  commission_model      commission_model not null,
  commission_rate_bps   int not null check (commission_rate_bps between 0 and 10000),
  allow_negative_balance boolean not null default false,
  negative_balance_floor_minor bigint not null default 0,
  min_payout_minor      bigint not null default 5000000,
  max_payout_minor      bigint,
  parent_override_bps   int not null default 0 check (parent_override_bps between 0 and 10000),
  total_net_bps_cap     int check (total_net_bps_cap is null or total_net_bps_cap between 0 and 10000),
  carry_forward         boolean not null default true,
  settlement_day_iso    int not null default 5,
  settlement_time       time not null default '03:00',
  settlement_timezone   text not null default 'Asia/Tehran',
  auto_payout           boolean not null default false,
  priority              int not null default 100,
  is_active             boolean not null default true,
  effective_from        timestamptz not null default now(),
  effective_to          timestamptz,
  reason                text,
  created_by            uuid references nova.profiles (id),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists affiliate_config_lookup_idx on nova.affiliate_commission_configs (scope, scope_ref, is_active);
drop trigger if exists affiliate_config_updated_at on nova.affiliate_commission_configs;
create trigger affiliate_config_updated_at before update on nova.affiliate_commission_configs for each row execute function nova.set_updated_at();

create table if not exists nova.affiliate_groups (
  id           uuid primary key default gen_random_uuid(),
  name         text not null unique,
  description  text,
  created_at   timestamptz not null default now()
);
create table if not exists nova.affiliate_group_members (
  group_id     uuid not null references nova.affiliate_groups (id) on delete cascade,
  affiliate_id uuid not null references nova.affiliates (id) on delete cascade,
  added_at     timestamptz not null default now(),
  primary key (group_id, affiliate_id)
);

-- --------------------------------------------------------------- settlements
create table if not exists nova.affiliate_settlements (
  id                    uuid primary key default gen_random_uuid(),
  affiliate_id          uuid not null references nova.affiliates (id) on delete cascade,
  period_start          timestamptz not null,
  period_end            timestamptz not null,
  status                affiliate_settlement_status not null default 'draft',
  week_key              text not null,
  closed_entries_count  int not null default 0,
  gross_commission_minor bigint not null default 0,
  negative_impact_minor bigint not null default 0,
  net_minor             bigint not null default 0,
  opening_carry_minor   bigint not null default 0,
  closing_carry_minor   bigint not null default 0,
  payable_minor         bigint not null default 0,
  suppressed_minor      bigint not null default 0,
  floor_applied         boolean not null default false,
  capped_by_cap         boolean not null default false,
  currency              text not null default 'IRT',
  commission_model      commission_model not null,
  commission_rate_bps   int not null,
  minimum_payout_minor  bigint not null default 0,
  payout_id             uuid,
  settled_at            timestamptz,
  calculated_at         timestamptz,
  notes                 text,
  created_at            timestamptz not null default now(),
  unique (affiliate_id, period_end)
);
create index if not exists affiliate_settlements_status_idx on nova.affiliate_settlements (status, period_end desc);
create index if not exists affiliate_settlements_affiliate_idx on nova.affiliate_settlements (affiliate_id, period_end desc);

-- --------------------------------------------------------------- ledger
create table if not exists nova.affiliate_ledger (
  id                 uuid primary key default gen_random_uuid(),
  affiliate_id       uuid not null references nova.affiliates (id) on delete restrict,
  type               affiliate_ledger_type not null,
  amount_minor       bigint not null,          -- signed: credit > 0, debit < 0
  currency           text not null,
  direction          text not null check (direction in ('credit','debit')),
  commission_rate_bps int not null default 0,
  applied_rate_bps   int not null default 0,
  cap_applied        boolean not null default false,
  source_amount_minor bigint not null default 0,  -- signed user result the entry derives from
  source_kind        text not null default 'system' check (source_kind in ('bet_settlement','bet_regrade','manual','settlement','payout','system')),
  user_id            uuid references nova.profiles (id) on delete set null,
  bet_id             uuid references nova.bets (id) on delete set null,
  bet_settlement_id  uuid references nova.bet_settlements (id) on delete set null,
  settlement_id      uuid references nova.affiliate_settlements (id) deferrable initially deferred,
  payout_id          uuid,
  status             affiliate_ledger_status not null default 'available',
  idempotency_key    text not null,
  reverse_of         uuid references nova.affiliate_ledger (id),
  settled_at         timestamptz,
  metadata           jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now(),
  unique (affiliate_id, idempotency_key)
);
create index if not exists affiliate_ledger_affiliate_idx on nova.affiliate_ledger (affiliate_id, created_at desc);
create index if not exists affiliate_ledger_status_idx on nova.affiliate_ledger (affiliate_id, status);
create index if not exists affiliate_ledger_bet_idx on nova.affiliate_ledger (bet_id) where bet_id is not null;
create index if not exists affiliate_ledger_period_idx on nova.affiliate_ledger (affiliate_id, status, created_at) where status = 'available';

drop trigger if exists affiliate_ledger_immutable on nova.affiliate_ledger;
create trigger affiliate_ledger_immutable before delete on nova.affiliate_ledger
  for each row execute function nova.prevent_delete_only();

comment on table nova.affiliate_ledger is
  'Append-only affiliate ledger. Settlements only flip status/settlement_id; amounts are never rewritten.';

-- --------------------------------------------------------------- payouts
create table if not exists nova.affiliate_payouts (
  id                  uuid primary key default gen_random_uuid(),
  public_id           text not null unique,
  affiliate_id        uuid not null references nova.affiliates (id) on delete restrict,
  settlement_id       uuid references nova.affiliate_settlements (id),
  amount_minor        bigint not null check (amount_minor > 0),
  currency            text not null,
  status              affiliate_payout_status not null default 'pending',
  method              text,
  destination_masked  text,
  provider            text,
  provider_reference  text,
  idempotency_key     text not null,
  requested_by        uuid references nova.profiles (id),
  requested_at        timestamptz not null default now(),
  approved_by         uuid references nova.profiles (id),
  approved_at         timestamptz,
  second_approver_id  uuid references nova.profiles (id),
  second_approved_at  timestamptz,
  dual_approval_required boolean not null default false,
  processing_at       timestamptz,
  paid_at             timestamptz,
  failed_reason       text,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (affiliate_id, idempotency_key),
  unique (settlement_id)
);
create index if not exists affiliate_payouts_status_idx on nova.affiliate_payouts (status, requested_at desc);
drop trigger if exists affiliate_payouts_updated_at on nova.affiliate_payouts;
create trigger affiliate_payouts_updated_at before update on nova.affiliate_payouts for each row execute function nova.set_updated_at();

/**
 * A payout can only be paid once (rule 19). The unique index on provider_reference plus
 * this guard makes a double-payout impossible even under concurrent approvals.
 */
create or replace function nova.guard_payout_no_double_pay() returns trigger
language plpgsql as $$
begin
  if old.status = 'paid' and new.status = 'paid' then
    raise exception 'DOUBLE_PAYOUT_BLOCKED' using errcode = '23505';
  end if;
  if old.paid_at is not null and new.paid_at is not null and new.paid_at <> old.paid_at then
    raise exception 'DOUBLE_PAYOUT_BLOCKED' using errcode = '23505';
  end if;
  return new;
end $$;
drop trigger if exists affiliate_payouts_no_double on nova.affiliate_payouts;
create trigger affiliate_payouts_no_double before update on nova.affiliate_payouts
  for each row execute function nova.guard_payout_no_double_pay();
create unique index if not exists affiliate_payouts_provider_ref_unique
  on nova.affiliate_payouts (provider, provider_reference) where provider_reference is not null;

create table if not exists nova.affiliate_adjustments (
  id             uuid primary key default gen_random_uuid(),
  affiliate_id   uuid not null references nova.affiliates (id) on delete cascade,
  ledger_id      uuid references nova.affiliate_ledger (id),
  amount_minor   bigint not null,
  currency       text not null,
  reason         text not null check (length(trim(reason)) >= 8),
  balance_before_minor bigint not null,
  balance_after_minor  bigint not null,
  actor_id       uuid not null references nova.profiles (id),
  correlation_id text,
  created_at     timestamptz not null default now()
);
create index if not exists affiliate_adjustments_affiliate_idx on nova.affiliate_adjustments (affiliate_id, created_at desc);

create table if not exists nova.affiliate_fraud_flags (
  id            uuid primary key default gen_random_uuid(),
  affiliate_id  uuid not null references nova.affiliates (id) on delete cascade,
  user_id       uuid references nova.profiles (id) on delete set null,
  signal        text not null,
  severity      text not null default 'low' check (severity in ('low','medium','high','critical')),
  status        text not null default 'clean' check (status in ('clean','suspicious','review','restricted','blocked')),
  details       jsonb not null default '{}'::jsonb,
  reviewed_by   uuid references nova.profiles (id),
  reviewed_at   timestamptz,
  resolution    text,
  created_at    timestamptz not null default now()
);
create index if not exists affiliate_fraud_status_idx on nova.affiliate_fraud_flags (status, created_at desc);

create table if not exists nova.affiliate_daily_stats (
  affiliate_id       uuid not null references nova.affiliates (id) on delete cascade,
  day                date not null,
  currency           text not null default 'IRT',
  clicks             int not null default 0,
  registrations      int not null default 0,
  first_deposits     int not null default 0,
  active_users       int not null default 0,
  settled_bets       int not null default 0,
  turnover_minor     bigint not null default 0,
  user_wins_minor    bigint not null default 0,
  user_losses_minor  bigint not null default 0,
  commission_minor   bigint not null default 0,
  primary key (affiliate_id, day)
);

create table if not exists nova.affiliate_weekly_stats (
  affiliate_id       uuid not null references nova.affiliates (id) on delete cascade,
  week_key           text not null,
  currency           text not null default 'IRT',
  registrations      int not null default 0,
  first_deposits     int not null default 0,
  settled_bets       int not null default 0,
  turnover_minor     bigint not null default 0,
  gross_commission_minor bigint not null default 0,
  negative_impact_minor bigint not null default 0,
  net_minor          bigint not null default 0,
  closing_carry_minor bigint not null default 0,
  settled_at         timestamptz,
  primary key (affiliate_id, week_key)
);

create table if not exists nova.affiliate_audit_logs (
  id             bigserial primary key,
  affiliate_id   uuid references nova.affiliates (id) on delete set null,
  actor_id       uuid references nova.profiles (id) on delete set null,
  action         text not null,
  before_state   jsonb,
  after_state    jsonb,
  reason         text,
  correlation_id text,
  created_at     timestamptz not null default now()
);
create index if not exists affiliate_audit_affiliate_idx on nova.affiliate_audit_logs (affiliate_id, created_at desc);

-- Per-user referral aggregates used by the affiliate dashboard (query-friendly).
create table if not exists nova.affiliate_referral_stats (
  affiliate_id       uuid not null references nova.affiliates (id) on delete cascade,
  user_id            uuid not null references nova.profiles (id) on delete cascade,
  currency           text not null default 'IRT',
  settled_bets       int not null default 0,
  turnover_minor     bigint not null default 0,
  user_wins_minor    bigint not null default 0,
  user_losses_minor  bigint not null default 0,
  commission_minor   bigint not null default 0,
  last_settled_at    timestamptz,
  primary key (affiliate_id, user_id)
);
