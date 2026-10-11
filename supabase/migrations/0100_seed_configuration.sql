-- ============================================================================
-- 0100 - SEED: CONFIGURATION ONLY
--
-- THIS FILE CONTAINS NO FAKE PRODUCTION DATA.
-- It seeds operational configuration that the platform needs to run safely:
-- kill switches, feature flags, risk limits, affiliate commission defaults and
-- the sport/country catalogue required for provider mapping.
-- It does NOT contain matches, odds, bets, users, balances or commission rows.
-- ============================================================================

-- ---------------------------------------------------------------- operations
insert into nova.system_operations (key, enabled, reason) values
  ('GLOBAL', true, 'master switch'),
  ('BETTING', true, 'global betting enabled'),
  ('LIVE_BETTING', true, 'live betting enabled by default; requiring flag + provider'),
  ('PREMATCH_BETTING', true, 'pre-match betting enabled'),
  ('DEPOSITS', true, 'deposits require a configured payment provider'),
  ('WITHDRAWALS', true, 'withdrawals require a configured payment provider'),
  ('ODDS_INGESTION', true, 'odds ingestion requires a configured sports provider'),
  ('SETTLEMENT', true, 'automatic settlement enabled'),
  ('AFFILIATE_SETTLEMENT', true, 'weekly settlement enabled'),
  ('AFFILIATE_PAYOUT', true, 'payout execution requires a configured payment provider'),
  ('MAINTENANCE_MODE', false, 'site-wide maintenance')
on conflict (key) do nothing;

-- ---------------------------------------------------------------- feature flags
insert into nova.feature_flags (key, enabled, description, is_public) values
  ('liveBetting', true, 'In-play betting (requires live odds provider)', true),
  ('cashout', false, 'Cash-out is not implemented; flag stays off', true),
  ('betBuilder', false, 'Bet builder not implemented', true),
  ('bonus', false, 'Bonus engine not implemented; no monetary bonus behaviour exists', true),
  ('affiliatePayouts', false, 'Requires an approved payment provider for payouts', true),
  ('payments', false, 'Enabled only when a real payment provider is configured', true),
  ('kyc', false, 'KYC provider not configured', true),
  ('streaming', false, 'Streaming provider not configured', true),
  ('multiCurrency', true, 'Multi-currency wallet architecture', true),
  ('softGaming', false, 'Casino vertical not part of this platform', true)
on conflict (key) do nothing;

-- ---------------------------------------------------------------- risk rules (global defaults)
insert into nova.risk_rules (scope, kind, value_minor, currency, action, priority, reason)
select * from (values
  ('global','min_stake', 10000::bigint, null::text, 'REJECT'::risk_decision, 10, 'Platform minimum stake'),
  ('global','max_stake', 500000000::bigint, null, 'REJECT', 10, 'Platform maximum stake per bet'),
  ('global','max_payout', 2000000000::bigint, null, 'REJECT', 10, 'Maximum potential payout per bet'),
  ('global','max_daily_stake', 1000000000::bigint, null, 'LIMIT', 20, 'Daily stake cap per user'),
  ('global','max_daily_payout', 5000000000::bigint, null, 'LIMIT', 20, 'Daily payout cap per user'),
  ('global','max_live_stake', 100000000::bigint, null, 'LIMIT', 20, 'Lower cap for in-play bets'),
  ('global','max_exposure', 5000000000::bigint, null, 'REJECT', 30, 'Maximum market exposure')
) as v(scope, kind, value_minor, currency, action, priority, reason)
where not exists (
  select 1 from nova.risk_rules r where r.scope = v.scope and r.kind = v.kind and r.scope_ref is null and r.currency is null
);

-- ------------------------------------------- affiliate commission configuration
-- MODEL A: variable profit/loss, negative carry-forward allowed.
-- MODEL B (default): NON_NEGATIVE_35 - payable balance can never go negative.
insert into nova.affiliate_commission_configs (
  scope, scope_ref, commission_model, commission_rate_bps, allow_negative_balance,
  negative_balance_floor_minor, min_payout_minor, max_payout_minor, parent_override_bps,
  total_net_bps_cap, carry_forward, settlement_day_iso, settlement_time, settlement_timezone,
  auto_payout, priority, is_active, reason)
select 'GLOBAL', null, 'NON_NEGATIVE_35'::commission_model, 3500, false, 0, 5000000, null, 500, 6000, true,
       5, '03:00'::time, 'Asia/Tehran', false, 100, true,
       'Default global model: 35% non-negative (spec §29). Overridable per sport/group/affiliate/campaign.'
where not exists (select 1 from nova.affiliate_commission_configs where scope = 'GLOBAL' and scope_ref is null);

insert into nova.affiliate_commission_configs (
  scope, scope_ref, commission_model, commission_rate_bps, allow_negative_balance,
  negative_balance_floor_minor, min_payout_minor, max_payout_minor, parent_override_bps,
  total_net_bps_cap, carry_forward, settlement_day_iso, settlement_time, settlement_timezone,
  auto_payout, priority, is_active, reason)
select 'GLOBAL', 'PROFIT_LOSS_VARIANT', 'PROFIT_LOSS_35'::commission_model, 3500, true, 0, 5000000, null, 500, 6000, true,
       5, '03:00'::time, 'Asia/Tehran', false, 200, false,
       'Disabled variant documenting MODEL A (negative carry-forward). Enable per affiliate when required.'
where not exists (select 1 from nova.affiliate_commission_configs where scope = 'GLOBAL' and scope_ref = 'PROFIT_LOSS_VARIANT');

-- ---------------------------------------------------------------- sports catalogue
insert into nova.sports (slug, name_en, name_fa, icon, display_order, is_active) values
  ('football', 'Football', 'فوتبال', 'football', 10, true),
  ('basketball', 'Basketball', 'بسکتبال', 'basketball', 20, true),
  ('tennis', 'Tennis', 'تنیس', 'tennis', 30, true),
  ('volleyball', 'Volleyball', 'والیبال', 'volleyball', 40, true),
  ('ice-hockey', 'Ice Hockey', 'هاکی روی یخ', 'hockey', 50, true),
  ('handball', 'Handball', 'هندبال', 'handball', 60, true),
  ('baseball', 'Baseball', 'بیسبال', 'baseball', 70, true),
  ('american-football', 'American Football', 'فوتبال آمریکایی', 'american-football', 80, true),
  ('cricket', 'Cricket', 'کریکت', 'cricket', 90, true),
  ('mma', 'MMA', 'ام‌ام‌ای', 'mma', 100, true),
  ('boxing', 'Boxing', 'بوکس', 'boxing', 110, true),
  ('table-tennis', 'Table Tennis', 'تنیس روی میز', 'table-tennis', 120, true),
  ('esports', 'Esports', 'ورزش‌های الکترونیکی', 'esports', 130, true)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------- system settings
insert into nova.system_settings (key, value, description, is_public) values
  ('odds_freshness', '{"prematch_seconds": 45, "live_seconds": 12}', 'Staleness thresholds for authoritative odds', true),
  ('betting_limits', '{"max_legs": 20, "max_combined_odds": "1000000"}', 'Structural betslip limits', true),
  ('affiliate_settlement', '{"day_iso": 5, "time": "03:00", "timezone": "Asia/Tehran", "mode": "manual"}',
   'Weekly settlement runs every Friday 03:00 Asia/Tehran (spec §33)', false),
  ('payout_policy', '{"min_payout_minor": 5000000, "carry_forward": true}', 'Affiliate payout policy defaults', false),
  ('locale', '{"default_locale": "fa", "default_dir": "rtl", "default_currency": "IRT", "timezone": "Asia/Tehran"}',
   'Localisation defaults', true),
  ('age_policy', '{"minimum_age": 18, "enforce_age_verification": true}', 'Responsible gaming / age policy', true)
on conflict (key) do nothing;

-- ------------------------------------------------------- provider registry stubs
insert into nova.provider_health (provider, kind, status, metadata) values
  ('disabled', 'sports', 'disabled', '{"reason":"No sports data provider configured. UI shows ''Sports data unavailable''."}'),
  ('disabled', 'payment', 'disabled', '{"reason":"No payment provider configured. Deposits/withdrawals are unavailable."}'),
  ('disabled', 'notification', 'disabled', '{"reason":"No notification provider configured. Deliveries are recorded as skipped_disabled."}')
on conflict (provider, kind) do nothing;
