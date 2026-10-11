-- ============================================================================
-- 0110 - ACCOUNT LIMITS, ADMIN APPROVALS, NOTIFICATIONS OUTBOX, PAYMENT METHODS
-- Additive only: no existing table or function is modified destructively.
-- ============================================================================

-- Cash-out is a first-class wallet movement, so it becomes a ledger type of its own
-- (additive enum extension; existing rows and the existing type order are untouched).
alter type nova.wallet_tx_type add value if not exists 'cashout';

-- ---------------------------------------------------------------- user limits
create table if not exists nova.user_limits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references nova.profiles(id) on delete cascade,
  currency text not null default 'IRT',
  max_stake_per_bet_minor      bigint check (max_stake_per_bet_minor is null or max_stake_per_bet_minor >= 0),
  max_stake_per_day_minor      bigint check (max_stake_per_day_minor is null or max_stake_per_day_minor >= 0),
  max_payout_per_bet_minor     bigint check (max_payout_per_bet_minor is null or max_payout_per_bet_minor >= 0),
  max_open_bets                int    check (max_open_bets is null or max_open_bets >= 0),
  loss_limit_daily_minor       bigint check (loss_limit_daily_minor is null or loss_limit_daily_minor >= 0),
  loss_limit_weekly_minor      bigint check (loss_limit_weekly_minor is null or loss_limit_weekly_minor >= 0),
  deposit_limit_daily_minor    bigint check (deposit_limit_daily_minor is null or deposit_limit_daily_minor >= 0),
  deposit_limit_weekly_minor   bigint check (deposit_limit_weekly_minor is null or deposit_limit_weekly_minor >= 0),
  session_limit_minutes        int    check (session_limit_minutes is null or session_limit_minutes > 0),
  self_excluded_until          timestamptz,
  updated_by uuid references nova.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, currency)
);
create index if not exists user_limits_user_idx on nova.user_limits (user_id);
drop trigger if exists user_limits_touch on nova.user_limits;
create trigger user_limits_touch before update on nova.user_limits for each row execute function nova.set_updated_at();

-- --------------------------------------------------------- admin adjustments
-- Dual-approval workflow for manual money movements (spec: never silent balance edits).
create table if not exists nova.admin_adjustments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references nova.profiles(id) on delete restrict,
  currency text not null default 'IRT',
  amount_minor bigint not null check (amount_minor > 0),
  direction text not null check (direction in ('credit','debit')),
  adjustment_type text not null,
  reason text not null,
  notes text,
  status text not null default 'pending' check (status in ('pending','approved','rejected','applied','cancelled')),
  requires_dual_approval boolean not null default false,
  requested_by uuid references nova.profiles(id),
  requested_at timestamptz not null default now(),
  approved_by uuid references nova.profiles(id),
  approved_at timestamptz,
  decision_reason text,
  wallet_transaction_id uuid references nova.wallet_transactions(id),
  correlation_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists admin_adjustments_status_idx on nova.admin_adjustments (status, requested_at desc);
create index if not exists admin_adjustments_user_idx on nova.admin_adjustments (user_id, created_at desc);
drop trigger if exists admin_adjustments_touch on nova.admin_adjustments;
create trigger admin_adjustments_touch before update on nova.admin_adjustments for each row execute function nova.set_updated_at();

/** An approver may never approve their own request, and may never be the requester. */
create or replace function nova.guard_adjustment_approval() returns trigger
language plpgsql as $$
begin
  if new.status in ('approved','applied') and old.status = 'pending' then
    if new.approved_by is null then
      raise exception 'DUAL_APPROVAL_REQUIRED: approval must be recorded' using errcode = '42501';
    end if;
    if new.approved_by = new.requested_by then
      raise exception 'SELF_APPROVAL_BLOCKED' using errcode = '42501';
    end if;
  end if;
  if new.status in ('approved','rejected','applied') and old.status in ('rejected','applied','cancelled') then
    raise exception 'CONFLICT: adjustment is already final' using errcode = '23505';
  end if;
  return new;
end $$;
drop trigger if exists admin_adjustments_guard on nova.admin_adjustments;
create trigger admin_adjustments_guard before update on nova.admin_adjustments for each row execute function nova.guard_adjustment_approval();

-- ---------------------------------------------------------------- user notes
create table if not exists nova.user_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references nova.profiles(id) on delete cascade,
  actor_id uuid references nova.profiles(id),
  note text not null,
  is_internal boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists user_notes_user_idx on nova.user_notes (user_id, created_at desc);

-- ------------------------------------------------------------ account events
create table if not exists nova.account_events (
  id bigserial primary key,
  user_id uuid references nova.profiles(id) on delete cascade,
  event_key text not null,
  actor_id uuid references nova.profiles(id),
  ip_hash text,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists account_events_user_idx on nova.account_events (user_id, created_at desc);

-- ------------------------------------------------- notifications (outbox)
alter table nova.notifications add column if not exists event_key text;
alter table nova.notifications add column if not exists status text not null default 'queued';
alter table nova.notifications add column if not exists locale text not null default 'fa';
alter table nova.notifications add column if not exists attempts int not null default 0;
alter table nova.notifications add column if not exists max_attempts int not null default 5;
alter table nova.notifications add column if not exists last_error text;
alter table nova.notifications add column if not exists dedupe_key text;
alter table nova.notifications add column if not exists scheduled_at timestamptz not null default now();
alter table nova.notifications add column if not exists sent_at timestamptz;
alter table nova.notifications add column if not exists locked_by text;
alter table nova.notifications add column if not exists locked_at timestamptz;
alter table nova.notifications add column if not exists template_key text;
create unique index if not exists notifications_dedupe_uniq on nova.notifications (dedupe_key) where dedupe_key is not null;
create index if not exists notifications_outbox_idx on nova.notifications (status, scheduled_at) where status in ('queued','sending');
create index if not exists notifications_user_idx on nova.notifications (user_id, created_at desc);

create table if not exists nova.notification_templates (
  id uuid primary key default gen_random_uuid(),
  event_key text not null,
  channel text not null check (channel in ('in_app','email','sms','push')),
  locale text not null default 'fa' check (locale in ('fa','en')),
  subject text,
  body text not null,
  is_enabled boolean not null default true,
  updated_by uuid references nova.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_key, channel, locale)
);
drop trigger if exists notification_templates_touch on nova.notification_templates;
create trigger notification_templates_touch before update on nova.notification_templates for each row execute function nova.set_updated_at();

create table if not exists nova.notification_preferences (
  user_id uuid not null references nova.profiles(id) on delete cascade,
  event_key text not null,
  in_app boolean not null default true,
  email boolean not null default false,
  sms boolean not null default false,
  push boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, event_key)
);

-- ---------------------------------------------------------- payment methods
-- Rows exist so the UI can render the catalogue honestly; `is_enabled` stays false
-- until a real provider is configured and an admin switches it on.
create table if not exists nova.payment_methods (
  id text primary key,
  provider text not null default 'disabled',
  kind text not null check (kind in ('card','bank_transfer','wallet','crypto','cash','voucher')),
  direction text not null check (direction in ('deposit','withdrawal','both')),
  name_en text not null,
  name_fa text not null,
  icon text,
  min_amount_minor bigint not null default 0,
  max_amount_minor bigint not null default 0,
  currencies text[] not null default array['IRT'],
  fee_bps int not null default 0,
  fixed_fee_minor bigint not null default 0,
  estimated_seconds int,
  is_enabled boolean not null default false,
  unavailable_reason text,
  display_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists payment_methods_touch on nova.payment_methods;
create trigger payment_methods_touch before update on nova.payment_methods for each row execute function nova.set_updated_at();

insert into nova.payment_methods (id, kind, direction, name_en, name_fa, min_amount_minor, max_amount_minor, estimated_seconds, is_enabled, unavailable_reason, display_order) values
  ('card_gateway',   'card',          'deposit',    'Card payment gateway', 'درگاه پرداخت کارتی', 1000000, 500000000, 60,  false, 'PAYMENT_PROVIDER_DISABLED', 1),
  ('bank_transfer',  'bank_transfer', 'both',       'Bank transfer (Sheba)', 'انتقال بانکی (شبا)',  5000000, 2000000000, 1800, false, 'PAYMENT_PROVIDER_DISABLED', 2),
  ('wallet_transfer','wallet',        'both',       'E-wallet transfer',     'انتقال کیف پول',      1000000, 500000000, 300,  false, 'PAYMENT_PROVIDER_DISABLED', 3),
  ('crypto_usdt',    'crypto',        'both',       'Crypto (USDT)',         'رمزارز (تتر)',        1000000, 5000000000, 900,  false, 'PAYMENT_PROVIDER_DISABLED', 4),
  ('cash_agent',     'cash',          'both',       'Cash via agent',        'نقدی از طریق نمایندگی', 5000000, 500000000, 3600, false, 'PAYMENT_PROVIDER_DISABLED', 5)
on conflict (id) do nothing;

-- ------------------------------------------------------------------ cash-out
-- Server-computed offer; the client may only accept or decline an unexpired quote.
create table if not exists nova.cashout_quotes (
  id uuid primary key default gen_random_uuid(),
  bet_id uuid not null references nova.bets(id) on delete cascade,
  user_id uuid not null references nova.profiles(id) on delete cascade,
  currency text not null,
  offer_minor bigint not null check (offer_minor >= 0),
  stake_minor bigint not null,
  potential_payout_minor bigint not null,
  margin_bps int not null default 500,
  current_combined_odds_scaled bigint,
  expires_at timestamptz not null,
  status text not null default 'offered' check (status in ('offered','accepted','expired','superseded','declined')),
  accepted_at timestamptz,
  wallet_transaction_id uuid references nova.wallet_transactions(id),
  created_at timestamptz not null default now()
);
create index if not exists cashout_quotes_bet_idx on nova.cashout_quotes (bet_id, created_at desc);

-- ============================================================ functions
/** Quote a cash-out: live value of the remaining legs minus the configured margin. */
create or replace function nova.cashout_quote(
  p_bet_id uuid,
  p_user_id uuid,
  p_margin_bps int default 500,
  p_ttl_seconds int default 60
) returns jsonb
language plpgsql security definer set search_path = nova, public as $$
declare
  v_bet record; v_live_product numeric := 1; v_pending int := 0; v_leg record;
  v_offer bigint := 0; v_quote_id uuid;
begin
  if not nova.operation_enabled('CASHOUT') then
    return jsonb_build_object('available', false, 'reason', 'FEATURE_DISABLED', 'offer_minor', null);
  end if;
  select * into v_bet from nova.bets where id = p_bet_id and user_id = p_user_id;
  if v_bet is null then
    return jsonb_build_object('available', false, 'reason', 'BET_NOT_FOUND', 'offer_minor', null);
  end if;
  if v_bet.status not in ('accepted','partially_settled') then
    return jsonb_build_object('available', false, 'reason', 'BET_NOT_ELIGIBLE', 'offer_minor', null);
  end if;
  for v_leg in
    select bl.*, s.odds_scaled as current_odds, s.status::text as selection_status, m.status::text as market_status
    from nova.bet_legs bl
    join nova.selections s on s.id = bl.selection_id
    join nova.markets m on m.id = bl.market_id
    where bl.bet_id = p_bet_id
  loop
    if v_leg.status <> 'pending' then
      continue;
    end if;
    if v_leg.selection_status <> 'open' or v_leg.market_status <> 'open' then
      return jsonb_build_object('available', false, 'reason', 'MARKET_SUSPENDED', 'offer_minor', null);
    end if;
    v_live_product := v_live_product * (v_leg.current_odds::numeric / 10000);
    v_pending := v_pending + 1;
  end loop;
  if v_pending = 0 then
    return jsonb_build_object('available', false, 'reason', 'NO_OPEN_LEGS', 'offer_minor', null);
  end if;
  -- value = stake * product(current decimal odds) * (1 - margin)
  -- v_live_product is already a plain ratio (odds_scaled / 10000) per leg.
  v_offer := nova.round_div(
    v_bet.stake_minor::numeric * v_live_product * (10000 - p_margin_bps)::numeric,
    10000
  );
  -- No silent clamp to the original potential payout: the offer must follow the live
  -- price (that is what the user sees), and trading controls margin/suspension instead.
  if v_offer < 0 then
    v_offer := 0;
  end if;
  insert into nova.cashout_quotes (bet_id, user_id, currency, offer_minor, stake_minor, potential_payout_minor,
        margin_bps, current_combined_odds_scaled, expires_at)
  values (p_bet_id, p_user_id, v_bet.currency, v_offer, v_bet.stake_minor, v_bet.potential_payout_minor,
        p_margin_bps, nova.round_div(v_live_product * 10000, 1)::bigint, now() + make_interval(secs => p_ttl_seconds))
  returning id into v_quote_id;
  return jsonb_build_object('available', true, 'quote_id', v_quote_id, 'offer_minor', v_offer,
    'expires_at', (now() + make_interval(secs => p_ttl_seconds)), 'margin_bps', p_margin_bps,
    'stake_minor', v_bet.stake_minor, 'potential_payout_minor', v_bet.potential_payout_minor, 'currency', v_bet.currency);
end $$;

/** Accept exactly one unexpired quote and pay it out atomically. */
create or replace function nova.accept_cashout(p_bet_id uuid, p_quote_id uuid, p_user_id uuid, p_idempotency_key text)
returns jsonb
language plpgsql security definer set search_path = nova, public as $$
declare
  v_quote record; v_bet record; v_entry jsonb; v_balance bigint; v_credit bigint;
begin
  if coalesce(length(trim(p_idempotency_key)), 0) < 8 then
    raise exception 'IDEMPOTENCY_KEY_REQUIRED' using errcode = '22023';
  end if;
  -- Serialise on the bet so two accepts cannot both win the race.
  perform pg_advisory_xact_lock(hashtextextended('cashatt:' || p_bet_id::text, 0));
  select * into v_bet from nova.bets where id = p_bet_id and user_id = p_user_id for update;
  if v_bet is null then
    raise exception 'BET_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_bet.status = 'cashed_out' then
    -- idempotent replay: return the settled cash-out
    select jsonb_build_object('status','idempotent_replay','bet_id',p_bet_id,'offer_minor',
      (select offer_minor from nova.cashout_quotes where bet_id = p_bet_id and status = 'accepted' order by accepted_at desc limit 1))
    into v_entry;
    return v_entry;
  end if;
  if v_bet.status not in ('accepted','partially_settled') then
    raise exception 'BET_NOT_ELIGIBLE' using errcode = '22023';
  end if;
  select * into v_quote from nova.cashout_quotes
   where id = p_quote_id and bet_id = p_bet_id and user_id = p_user_id for update;
  if v_quote is null then
    raise exception 'NOT_FOUND: cash-out quote' using errcode = 'P0002';
  end if;
  if v_quote.status <> 'offered' or v_quote.expires_at < now() then
    update nova.cashout_quotes set status = 'expired' where id = v_quote.id and status = 'offered';
    raise exception 'ODDS_EXPIRED: cash-out quote is no longer valid' using errcode = '22023';
  end if;

  v_credit := nova.round_div(v_quote.offer_minor::numeric, 1);
  if v_credit > 0 then
    v_entry := nova.credit_wallet(p_user_id, 'cashout', v_credit, v_quote.currency,
      p_idempotency_key || ':cashout', 'cashout:' || p_bet_id::text, p_bet_id, null,
      'Cash-out accepted', p_user_id, jsonb_build_object('quote_id', p_quote_id, 'bet_id', p_bet_id));
    v_balance := (v_entry ->> 'balance_after_minor')::bigint;
  else
    v_balance := (select balance_minor from nova.wallets where user_id = p_user_id and currency = v_quote.currency);
  end if;

  update nova.cashout_quotes set status = 'accepted', accepted_at = now(),
         wallet_transaction_id = nullif(v_entry ->> 'transaction_id','')::uuid
   where id = v_quote.id;
  update nova.cashout_quotes set status = 'superseded' where bet_id = p_bet_id and status = 'offered' and id <> v_quote.id;

  update nova.bets set status = 'cashed_out', settled_at = now(), payout_minor = v_credit,
         result_revision = coalesce(result_revision, 0) + 1, updated_at = now()
   where id = p_bet_id;
  -- Legs are marked `refunded` (the authoritative enum member for "stake returned"),
  -- not `cancelled`, which does not exist on nova.bet_leg_status.
  update nova.bet_legs set status = 'refunded', settled_at = now()
   where bet_id = p_bet_id and status = 'pending';

  insert into nova.settlement_events (bet_id, match_id, event, detail, actor)
  select p_bet_id, bl.match_id, 'cashout', jsonb_build_object('quote_id', p_quote_id, 'offer_minor', v_credit), p_user_id::text
  from nova.bet_legs bl where bl.bet_id = p_bet_id limit 1;

  perform nova.audit_event(p_user_id, 'bet.cashout', 'bet', p_bet_id::text, null,
    jsonb_build_object('offer_minor', v_credit, 'quote_id', p_quote_id), 'user accepted cash-out', null, '{}'::jsonb);

  return jsonb_build_object('status','accepted','bet_id',p_bet_id,'offer_minor',v_credit,
                            'balance_after_minor', v_balance, 'currency', v_quote.currency);
end $$;

revoke all on function nova.cashout_quote(uuid, uuid, int, int) from public, anon, authenticated;
revoke all on function nova.accept_cashout(uuid, uuid, uuid, text) from public, anon, authenticated;

-- ============================================================ RLS + grants
alter table nova.user_limits enable row level security;
alter table nova.admin_adjustments enable row level security;
alter table nova.user_notes enable row level security;
alter table nova.account_events enable row level security;
alter table nova.notification_templates enable row level security;
alter table nova.notification_preferences enable row level security;
alter table nova.payment_methods enable row level security;
alter table nova.cashout_quotes enable row level security;

drop policy if exists user_limits_own on nova.user_limits;
create policy user_limits_own on nova.user_limits for select to authenticated
  using (user_id = nova.current_user_id() or nova.is_admin());
drop policy if exists user_limits_admin_write on nova.user_limits;
create policy user_limits_admin_write on nova.user_limits for all to authenticated
  using (nova.is_admin()) with check (nova.is_admin());

drop policy if exists admin_adjustments_admin on nova.admin_adjustments;
create policy admin_adjustments_admin on nova.admin_adjustments for select to authenticated
  using (nova.is_admin() or user_id = nova.current_user_id());
drop policy if exists admin_adjustments_admin_write on nova.admin_adjustments;
create policy admin_adjustments_admin_write on nova.admin_adjustments for all to authenticated
  using (nova.is_admin()) with check (nova.is_admin());

drop policy if exists user_notes_admin on nova.user_notes;
create policy user_notes_admin on nova.user_notes for all to authenticated
  using (nova.is_admin() or (user_id = nova.current_user_id() and not is_internal))
  with check (nova.is_admin());

drop policy if exists account_events_admin on nova.account_events;
create policy account_events_admin on nova.account_events for select to authenticated
  using (nova.is_admin() or user_id = nova.current_user_id());

drop policy if exists notification_templates_read on nova.notification_templates;
create policy notification_templates_read on nova.notification_templates for select to authenticated
  using (true);   -- templates are non-secret copy, not user data
drop policy if exists notification_templates_admin on nova.notification_templates;
create policy notification_templates_admin on nova.notification_templates for all to authenticated
  using (nova.is_admin()) with check (nova.is_admin());

drop policy if exists notification_preferences_own on nova.notification_preferences;
create policy notification_preferences_own on nova.notification_preferences for all to authenticated
  using (user_id = nova.current_user_id()) with check (user_id = nova.current_user_id());

drop policy if exists payment_methods_public on nova.payment_methods;
create policy payment_methods_public on nova.payment_methods for select to anon, authenticated using (true);
drop policy if exists payment_methods_admin on nova.payment_methods;
create policy payment_methods_admin on nova.payment_methods for all to authenticated
  using (nova.is_admin()) with check (nova.is_admin());

drop policy if exists cashout_quotes_own on nova.cashout_quotes;
create policy cashout_quotes_own on nova.cashout_quotes for select to authenticated
  using (user_id = nova.current_user_id() or nova.is_admin());

grant select on nova.payment_methods to anon, authenticated;
grant select, insert, update, delete on nova.notification_preferences to authenticated;
grant select on nova.notification_templates to authenticated;
grant select on nova.user_limits, nova.user_notes, nova.cashout_quotes, nova.admin_adjustments to authenticated;
grant insert, update, delete on nova.user_limits, nova.user_notes, nova.notification_templates,
      nova.admin_adjustments, nova.payment_methods to authenticated;
grant select, insert, update on nova.account_events to authenticated;

-- Seed the notification templates (fa + en) for every event key used by the app.
insert into nova.notification_templates (event_key, channel, locale, subject, body) values
  ('auth.welcome','in_app','fa','خوش آمدید','به NOVA SPORTSBOOK خوش آمدید. حساب شما فعال است.'),
  ('auth.welcome','in_app','en','Welcome','Welcome to NOVA SPORTSBOOK. Your account is ready.'),
  ('bet.placed','in_app','fa','شرط ثبت شد','شرط شما با موفقیت ثبت شد.'),
  ('bet.placed','in_app','en','Bet placed','Your bet has been placed successfully.'),
  ('bet.settled','in_app','fa','تسویه شرط','شرط شما تسویه شد.'),
  ('bet.settled','in_app','en','Bet settled','Your bet has been settled.'),
  ('bet.won','in_app','fa','شرط برنده','شرط شما برنده شد و مبلغ به کیف پول شما اضافه شد.'),
  ('bet.won','in_app','en','Bet won','Your bet won and the payout was credited.'),
  ('bet.lost','in_app','fa','شرط باخت','شرط شما باخت.'),
  ('bet.lost','in_app','en','Bet lost','Your bet was lost.'),
  ('bet.void','in_app','fa','شرط باطل','شرط شما باطل و مبلغ آن بازگردانده شد.'),
  ('bet.void','in_app','en','Bet void','Your bet was voided and the stake refunded.'),
  ('bet.odds_change','in_app','fa','تغییر ضریب','ضریب انتخاب شما تغییر کرده است؛ لطفاً تأیید کنید.'),
  ('bet.odds_change','in_app','en','Odds changed','The odds for your selection changed; please review.'),
  ('wallet.deposit_confirmed','in_app','fa','واریز تأیید شد','واریز شما تأیید و به کیف پول اضافه شد.'),
  ('wallet.deposit_confirmed','in_app','en','Deposit confirmed','Your deposit was confirmed and credited.'),
  ('wallet.withdrawal_requested','in_app','fa','درخواست برداشت','درخواست برداشت شما ثبت شد و در انتظار بررسی است.'),
  ('wallet.withdrawal_requested','in_app','en','Withdrawal requested','Your withdrawal request was received and is under review.'),
  ('wallet.withdrawal_paid','in_app','fa','برداشت پرداخت شد','برداشت شما پرداخت شد.'),
  ('wallet.withdrawal_paid','in_app','en','Withdrawal paid','Your withdrawal has been paid.'),
  ('wallet.withdrawal_rejected','in_app','fa','برداشت رد شد','درخواست برداشت شما رد شد و مبلغ به کیف پول بازگشت.'),
  ('wallet.withdrawal_rejected','in_app','en','Withdrawal rejected','Your withdrawal was rejected and the funds returned.'),
  ('wallet.limit_warning','in_app','fa','هشدار محدودیت','به محدودیت تعیینشده نزدیک شدهاید.'),
  ('wallet.limit_warning','in_app','en','Limit warning','You are approaching a limit you set.'),
  ('affiliate.approved','in_app','fa','حساب همکاری تأیید شد','حساب همکاری شما تأیید شد.'),
  ('affiliate.approved','in_app','en','Affiliate approved','Your affiliate account has been approved.'),
  ('affiliate.referred_user','in_app','fa','کاربر جدید','کاربر جدیدی از طریق لینک شما ثبتنام کرد.'),
  ('affiliate.referred_user','in_app','en','New referral','A new user registered through your link.'),
  ('affiliate.commission_earned','in_app','fa','کمیسیون جدید','کمیسیون جدید به حساب شما اضافه شد.'),
  ('affiliate.commission_earned','in_app','en','Commission earned','New commission was added to your account.'),
  ('affiliate.settlement_completed','in_app','fa','تسویه هفتگی','تسویه هفتگی حساب همکاری شما انجام شد.'),
  ('affiliate.settlement_completed','in_app','en','Weekly settlement','Your affiliate account was settled.'),
  ('affiliate.payout_paid','in_app','fa','پرداخت انجام شد','پرداخت کمیسیون شما انجام شد.'),
  ('affiliate.payout_paid','in_app','en','Payout paid','Your commission payout was completed.'),
  ('affiliate.payout_rejected','in_app','fa','پرداخت رد شد','درخواست پرداخت شما رد شد.'),
  ('affiliate.payout_rejected','in_app','en','Payout rejected','Your payout request was rejected.'),
  ('affiliate.fraud_review','in_app','fa','بررسی حساب','حساب همکاری شما در حال بررسی است.'),
  ('affiliate.fraud_review','in_app','en','Account review','Your affiliate account is under review.'),
  ('account.status_changed','in_app','fa','تغییر وضعیت حساب','وضعیت حساب شما تغییر کرد.'),
  ('account.status_changed','in_app','en','Account status changed','Your account status has changed.'),
  ('account.kyc_required','in_app','fa','تکمیل احراز هویت','برای ادامه فعالیت، احراز هویت خود را تکمیل کنید.'),
  ('account.kyc_required','in_app','en','Verification required','Please complete identity verification to continue.'),
  ('system.maintenance','in_app','fa','تعمیرات سیستم','سیستم موقتاً در حالت تعمیرات است.'),
  ('system.maintenance','in_app','en','Maintenance','The system is temporarily under maintenance.')
on conflict (event_key, channel, locale) do nothing;


-- Additional operational switches, using the SAME UPPERCASE convention as 0100 so
-- there is exactly one spelling per switch (no duplicate/aliased switches).
insert into nova.system_operations (key, enabled, reason) values
  ('CASHOUT', false, 'Cash-out stays off until live pricing is calibrated in production.'),
  ('REGISTRATION', true, 'Allow new sign-ups.'),
  ('WITHDRAWALS_AUTO_APPROVE', false, 'When off every withdrawal needs manual finance approval.')
on conflict (key) do nothing;
