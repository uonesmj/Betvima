-- ============================================================================
-- 0090 - ROW LEVEL SECURITY
-- Deny-by-default. Users read their own rows; affiliates read their own rows;
-- admins read operational data; financial WRITES only happen through the
-- SECURITY DEFINER functions in 0070-0083 (never through table grants).
-- ============================================================================

-- Helper: the affiliate record owned by the authenticated user (null for non-affiliates).
create or replace function nova.current_affiliate_id() returns uuid
language sql stable security definer set search_path = nova, public as $$
  select id from nova.affiliates where user_id = nova.current_user_id()
$$;

-- ---------------------------------------------------------------- profiles
alter table nova.profiles enable row level security;
drop policy if exists profiles_select_own on nova.profiles;
create policy profiles_select_own on nova.profiles for select to authenticated
  using (id = nova.current_user_id() or nova.is_admin());
drop policy if exists profiles_update_own on nova.profiles;
create policy profiles_update_own on nova.profiles for update to authenticated
  using (id = nova.current_user_id())
  with check (id = nova.current_user_id());
drop policy if exists profiles_admin_all on nova.profiles;
create policy profiles_admin_all on nova.profiles for all to authenticated
  using (nova.is_admin()) with check (nova.is_admin());

/** Users must never self-escalate role/status/KYC via a direct table update. */
create or replace function nova.guard_profile_update() returns trigger
language plpgsql as $$
begin
  if nova.is_admin() then
    return new;
  end if;
  if new.role <> old.role or new.status <> old.status or new.kyc_status <> old.kyc_status
     or new.age_verified <> old.age_verified or new.email_verified <> old.email_verified
     or new.is_affiliate <> old.is_affiliate or new.public_id <> old.public_id then
    raise exception 'FORBIDDEN: protected profile fields' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists profiles_guard on nova.profiles;
create trigger profiles_guard before update on nova.profiles for each row execute function nova.guard_profile_update();

-- ---------------------------------------------------------------- sessions
alter table nova.user_sessions enable row level security;
drop policy if exists sessions_own on nova.user_sessions;
create policy sessions_own on nova.user_sessions for select to authenticated
  using (user_id = nova.current_user_id() or nova.is_admin());
drop policy if exists sessions_revoke_own on nova.user_sessions;
create policy sessions_revoke_own on nova.user_sessions for delete to authenticated
  using (user_id = nova.current_user_id());

-- ---------------------------------------------------------------- restrictions
alter table nova.user_restrictions enable row level security;
drop policy if exists restrictions_own on nova.user_restrictions;
create policy restrictions_own on nova.user_restrictions for select to authenticated
  using (user_id = nova.current_user_id() or nova.is_admin());
drop policy if exists restrictions_insert_own on nova.user_restrictions;
create policy restrictions_insert_own on nova.user_restrictions for insert to authenticated
  with check (user_id = nova.current_user_id()
              and kind in ('deposit_limit','stake_limit','loss_limit','cooling_off','self_exclusion','session_limit','time_reminder'));

-- ---------------------------------------------------------------- wallets / ledger
alter table nova.wallets enable row level security;
drop policy if exists wallets_select_own on nova.wallets;
create policy wallets_select_own on nova.wallets for select to authenticated
  using (user_id = nova.current_user_id() or nova.is_admin());

alter table nova.wallet_transactions enable row level security;
drop policy if exists wallet_tx_select_own on nova.wallet_transactions;
create policy wallet_tx_select_own on nova.wallet_transactions for select to authenticated
  using (user_id = nova.current_user_id() or nova.is_admin());

alter table nova.payment_transactions enable row level security;
drop policy if exists payment_tx_select_own on nova.payment_transactions;
create policy payment_tx_select_own on nova.payment_transactions for select to authenticated
  using (user_id = nova.current_user_id() or nova.is_admin());

-- ---------------------------------------------------------------- betting
alter table nova.bets enable row level security;
drop policy if exists bets_select_own on nova.bets;
create policy bets_select_own on nova.bets for select to authenticated
  using (user_id = nova.current_user_id() or nova.is_admin());

alter table nova.bet_legs enable row level security;
drop policy if exists bet_legs_select_own on nova.bet_legs;
create policy bet_legs_select_own on nova.bet_legs for select to authenticated
  using (exists (select 1 from nova.bets b where b.id = bet_id and (b.user_id = nova.current_user_id() or nova.is_admin())));

alter table nova.bet_settlements enable row level security;
drop policy if exists bet_settlements_select_own on nova.bet_settlements;
create policy bet_settlements_select_own on nova.bet_settlements for select to authenticated
  using (exists (select 1 from nova.bets b where b.id = bet_id and (b.user_id = nova.current_user_id() or nova.is_admin())));

alter table nova.settlement_jobs enable row level security;
drop policy if exists settlement_jobs_admin on nova.settlement_jobs;
create policy settlement_jobs_admin on nova.settlement_jobs for select to authenticated
  using (nova.is_admin());

-- ---------------------------------------------------------------- catalogue (public read)
alter table nova.sports enable row level security;
drop policy if exists sports_public_read on nova.sports;
create policy sports_public_read on nova.sports for select to anon, authenticated using (is_active or nova.is_admin());
alter table nova.countries enable row level security;
drop policy if exists countries_public_read on nova.countries;
create policy countries_public_read on nova.countries for select to anon, authenticated using (true);
alter table nova.leagues enable row level security;
drop policy if exists leagues_public_read on nova.leagues;
create policy leagues_public_read on nova.leagues for select to anon, authenticated using (is_active or nova.is_admin());
alter table nova.teams enable row level security;
drop policy if exists teams_public_read on nova.teams;
create policy teams_public_read on nova.teams for select to anon, authenticated using (true);
alter table nova.matches enable row level security;
drop policy if exists matches_public_read on nova.matches;
create policy matches_public_read on nova.matches for select to anon, authenticated using (true);
alter table nova.match_periods enable row level security;
drop policy if exists match_periods_public_read on nova.match_periods;
create policy match_periods_public_read on nova.match_periods for select to anon, authenticated using (true);
alter table nova.match_events enable row level security;
drop policy if exists match_events_public_read on nova.match_events;
create policy match_events_public_read on nova.match_events for select to anon, authenticated using (true);
alter table nova.match_results enable row level security;
drop policy if exists match_results_public_read on nova.match_results;
create policy match_results_public_read on nova.match_results for select to anon, authenticated using (authoritative or nova.is_admin());
alter table nova.markets enable row level security;
drop policy if exists markets_public_read on nova.markets;
create policy markets_public_read on nova.markets for select to anon, authenticated using (true);
alter table nova.selections enable row level security;
drop policy if exists selections_public_read on nova.selections;
create policy selections_public_read on nova.selections for select to anon, authenticated using (true);
alter table nova.odds_history enable row level security;
drop policy if exists odds_history_admin_read on nova.odds_history;
create policy odds_history_admin_read on nova.odds_history for select to authenticated using (nova.is_admin());
alter table nova.provider_entities enable row level security;
drop policy if exists provider_entities_admin on nova.provider_entities;
create policy provider_entities_admin on nova.provider_entities for select to authenticated using (nova.is_admin());

-- ---------------------------------------------------------------- personal data
alter table nova.favorites enable row level security;
drop policy if exists favorites_own on nova.favorites;
create policy favorites_own on nova.favorites for all to authenticated
  using (user_id = nova.current_user_id()) with check (user_id = nova.current_user_id());

alter table nova.notifications enable row level security;
drop policy if exists notifications_own on nova.notifications;
create policy notifications_own on nova.notifications for select to authenticated
  using (user_id = nova.current_user_id() or nova.is_admin());
drop policy if exists notifications_mark_read on nova.notifications;
create policy notifications_mark_read on nova.notifications for update to authenticated
  using (user_id = nova.current_user_id()) with check (user_id = nova.current_user_id());

alter table nova.notification_deliveries enable row level security;
drop policy if exists notification_deliveries_admin on nova.notification_deliveries;
create policy notification_deliveries_admin on nova.notification_deliveries for select to authenticated using (nova.is_admin());

alter table nova.promotions enable row level security;
drop policy if exists promotions_public_read on nova.promotions;
create policy promotions_public_read on nova.promotions for select to anon, authenticated using (is_active or nova.is_admin());
alter table nova.user_promotions enable row level security;
drop policy if exists user_promotions_own on nova.user_promotions;
create policy user_promotions_own on nova.user_promotions for select to authenticated
  using (user_id = nova.current_user_id() or nova.is_admin());
alter table nova.bonus_ledger enable row level security;
drop policy if exists bonus_ledger_own on nova.bonus_ledger;
create policy bonus_ledger_own on nova.bonus_ledger for select to authenticated
  using (user_id = nova.current_user_id() or nova.is_admin());

-- ---------------------------------------------------------------- affiliate
alter table nova.affiliates enable row level security;
drop policy if exists affiliates_own on nova.affiliates;
create policy affiliates_own on nova.affiliates for select to authenticated
  using (user_id = nova.current_user_id() or nova.is_admin());
drop policy if exists affiliates_admin_write on nova.affiliates;
create policy affiliates_admin_write on nova.affiliates for all to authenticated
  using (nova.is_admin()) with check (nova.is_admin());

alter table nova.affiliate_links enable row level security;
drop policy if exists affiliate_links_own on nova.affiliate_links;
create policy affiliate_links_own on nova.affiliate_links for all to authenticated
  using (affiliate_id = nova.current_affiliate_id() or nova.is_admin())
  with check (affiliate_id = nova.current_affiliate_id() or nova.is_admin());

alter table nova.affiliate_campaigns enable row level security;
drop policy if exists affiliate_campaigns_own on nova.affiliate_campaigns;
create policy affiliate_campaigns_own on nova.affiliate_campaigns for all to authenticated
  using (affiliate_id = nova.current_affiliate_id() or nova.is_admin())
  with check (affiliate_id = nova.current_affiliate_id() or nova.is_admin());

alter table nova.affiliate_clicks enable row level security;
drop policy if exists affiliate_clicks_own on nova.affiliate_clicks;
create policy affiliate_clicks_own on nova.affiliate_clicks for select to authenticated
  using (affiliate_id = nova.current_affiliate_id() or nova.is_admin());

alter table nova.affiliate_attributions enable row level security;
drop policy if exists affiliate_attributions_own on nova.affiliate_attributions;
create policy affiliate_attributions_own on nova.affiliate_attributions for select to authenticated
  using (affiliate_id = nova.current_affiliate_id() or user_id = nova.current_user_id() or nova.is_admin());

alter table nova.affiliate_ledger enable row level security;
drop policy if exists affiliate_ledger_own on nova.affiliate_ledger;
create policy affiliate_ledger_own on nova.affiliate_ledger for select to authenticated
  using (affiliate_id = nova.current_affiliate_id() or nova.is_admin());

alter table nova.affiliate_settlements enable row level security;
drop policy if exists affiliate_settlements_own on nova.affiliate_settlements;
create policy affiliate_settlements_own on nova.affiliate_settlements for select to authenticated
  using (affiliate_id = nova.current_affiliate_id() or nova.is_admin());

alter table nova.affiliate_payouts enable row level security;
drop policy if exists affiliate_payouts_own on nova.affiliate_payouts;
create policy affiliate_payouts_own on nova.affiliate_payouts for select to authenticated
  using (affiliate_id = nova.current_affiliate_id() or nova.is_admin());

alter table nova.affiliate_adjustments enable row level security;
drop policy if exists affiliate_adjustments_own on nova.affiliate_adjustments;
create policy affiliate_adjustments_own on nova.affiliate_adjustments for select to authenticated
  using (affiliate_id = nova.current_affiliate_id() or nova.is_admin());

alter table nova.affiliate_daily_stats enable row level security;
drop policy if exists affiliate_daily_stats_own on nova.affiliate_daily_stats;
create policy affiliate_daily_stats_own on nova.affiliate_daily_stats for select to authenticated
  using (affiliate_id = nova.current_affiliate_id() or nova.is_admin());

alter table nova.affiliate_weekly_stats enable row level security;
drop policy if exists affiliate_weekly_stats_own on nova.affiliate_weekly_stats;
create policy affiliate_weekly_stats_own on nova.affiliate_weekly_stats for select to authenticated
  using (affiliate_id = nova.current_affiliate_id() or nova.is_admin());

alter table nova.affiliate_referral_stats enable row level security;
drop policy if exists affiliate_referral_stats_own on nova.affiliate_referral_stats;
create policy affiliate_referral_stats_own on nova.affiliate_referral_stats for select to authenticated
  using (affiliate_id = nova.current_affiliate_id() or nova.is_admin());

alter table nova.affiliate_relationships enable row level security;
drop policy if exists affiliate_relationships_admin on nova.affiliate_relationships;
create policy affiliate_relationships_admin on nova.affiliate_relationships for select to authenticated
  using (nova.is_admin() or affiliate_id = nova.current_affiliate_id() or parent_affiliate_id = nova.current_affiliate_id());

alter table nova.affiliate_commission_configs enable row level security;
drop policy if exists affiliate_config_admin on nova.affiliate_commission_configs;
create policy affiliate_config_admin on nova.affiliate_commission_configs for select to authenticated using (nova.is_admin());

alter table nova.affiliate_fraud_flags enable row level security;
drop policy if exists affiliate_fraud_admin on nova.affiliate_fraud_flags;
create policy affiliate_fraud_admin on nova.affiliate_fraud_flags for select to authenticated using (nova.is_admin());

alter table nova.affiliate_audit_logs enable row level security;
drop policy if exists affiliate_audit_admin on nova.affiliate_audit_logs;
create policy affiliate_audit_admin on nova.affiliate_audit_logs for select to authenticated using (nova.is_admin());

-- ---------------------------------------------------------------- operations (admin only)
alter table nova.audit_logs enable row level security;
drop policy if exists audit_logs_admin on nova.audit_logs;
create policy audit_logs_admin on nova.audit_logs for select to authenticated using (nova.is_admin());

alter table nova.risk_decisions enable row level security;
drop policy if exists risk_decisions_admin on nova.risk_decisions;
create policy risk_decisions_admin on nova.risk_decisions for select to authenticated using (nova.is_admin());

alter table nova.risk_rules enable row level security;
drop policy if exists risk_rules_read_admin on nova.risk_rules;
create policy risk_rules_read_admin on nova.risk_rules for select to authenticated using (nova.is_admin());
drop policy if exists risk_rules_write_admin on nova.risk_rules;
create policy risk_rules_write_admin on nova.risk_rules for all to authenticated
  using (nova.is_admin()) with check (nova.is_admin());

alter table nova.system_settings enable row level security;
drop policy if exists system_settings_public_read on nova.system_settings;
create policy system_settings_public_read on nova.system_settings for select to anon, authenticated
  using (is_public or nova.is_admin());

alter table nova.feature_flags enable row level security;
drop policy if exists feature_flags_public_read on nova.feature_flags;
create policy feature_flags_public_read on nova.feature_flags for select to anon, authenticated
  using (is_public or nova.is_admin());

alter table nova.system_operations enable row level security;
drop policy if exists system_operations_read on nova.system_operations;
create policy system_operations_read on nova.system_operations for select to anon, authenticated
  using (key in ('MAINTENANCE_MODE') or nova.is_admin());

alter table nova.provider_health enable row level security;
drop policy if exists provider_health_admin on nova.provider_health;
create policy provider_health_admin on nova.provider_health for select to authenticated using (nova.is_admin());

alter table nova.worker_runs enable row level security;
drop policy if exists worker_runs_admin on nova.worker_runs;
create policy worker_runs_admin on nova.worker_runs for select to authenticated using (nova.is_admin());

alter table nova.worker_heartbeats enable row level security;
drop policy if exists worker_heartbeats_admin on nova.worker_heartbeats;
create policy worker_heartbeats_admin on nova.worker_heartbeats for select to authenticated using (nova.is_admin());

alter table nova.worker_locks enable row level security;
drop policy if exists worker_locks_admin on nova.worker_locks;
create policy worker_locks_admin on nova.worker_locks for select to authenticated using (nova.is_admin());

alter table nova.job_queue enable row level security;
drop policy if exists job_queue_admin on nova.job_queue;
create policy job_queue_admin on nova.job_queue for select to authenticated using (nova.is_admin());

alter table nova.reconciliation_records enable row level security;
drop policy if exists reconciliation_admin on nova.reconciliation_records;
create policy reconciliation_admin on nova.reconciliation_records for select to authenticated using (nova.is_admin());

alter table nova.idempotency_keys enable row level security;   -- no policies: service_role only
alter table nova.rate_limit_buckets enable row level security; -- no policies: service_role only
alter table nova.webhook_receipts enable row level security;   -- no policies: service_role only

-- ---------------------------------------------------------------- table grants (least privilege)
revoke all on all tables in schema nova from anon, authenticated;
grant select on nova.sports, nova.countries, nova.leagues, nova.teams, nova.matches, nova.markets,
      nova.selections, nova.match_events, nova.match_periods, nova.promotions, nova.match_stats
  to anon, authenticated;
grant select, insert, update, delete on nova.favorites to authenticated;
grant select, update on nova.notifications to authenticated;
grant select on nova.wallet_balances, nova.wallet_ledger, nova.current_match_results, nova.reconciliation_status_view
  to authenticated;
grant select on nova.profiles, nova.wallets, nova.wallet_transactions, nova.payment_transactions,
      nova.bets, nova.bet_legs, nova.bet_settlements, nova.user_sessions, nova.user_restrictions,
      nova.affiliates, nova.affiliate_links, nova.affiliate_campaigns, nova.affiliate_clicks,
      nova.affiliate_attributions, nova.affiliate_ledger, nova.affiliate_settlements,
      nova.affiliate_payouts, nova.affiliate_adjustments, nova.affiliate_daily_stats,
      nova.affiliate_weekly_stats, nova.affiliate_referral_stats, nova.affiliate_commission_configs,
      nova.affiliate_fraud_flags, nova.affiliate_audit_logs, nova.affiliate_relationships,
      nova.user_promotions, nova.bonus_ledger, nova.audit_logs, nova.risk_rules, nova.risk_decisions,
      nova.system_settings, nova.feature_flags, nova.system_operations, nova.provider_health,
      nova.worker_runs, nova.worker_heartbeats, nova.worker_locks, nova.job_queue,
      nova.reconciliation_records, nova.notification_deliveries, nova.settlement_jobs,
      nova.odds_history, nova.provider_entities, nova.match_results
  to authenticated;
grant insert, update, delete on nova.affiliate_links, nova.affiliate_campaigns to authenticated;
grant insert on nova.user_restrictions to authenticated;
grant insert, delete on nova.user_sessions to authenticated;

-- service_role bypasses RLS (server + workers only). It is never shipped to the browser.
grant all on all tables in schema nova to service_role;
grant all on all sequences in schema nova to service_role;
alter default privileges in schema nova grant all on tables to service_role;

-- PostgREST exposure: only the nova schema and public helper functions are exposed.
grant execute on all functions in schema nova to authenticated, service_role;
revoke execute on function nova.post_wallet_entry(uuid, wallet_tx_type, bigint, text, text, text, uuid, uuid, uuid, text, uuid, jsonb, bigint, boolean) from authenticated, anon;
