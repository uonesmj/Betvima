-- Stage16 — ONLY read-only metadata SQL. Safe on both projects; never runs a migration.
-- Production ref: mqygiufkubxxxjodsycu. Isolated branch: qrirgzvxpjhhwvyazvpn.
-- The real create-branch workflow (2026-10-30 20:37 UTC) aborted in first
-- remote migration 20261012160639 (repair_clean_prematch_odds_resumption_20261012)
-- because nova.publish_odds_tick(...) did not yet exist on the fresh branch.
WITH nova_objects AS (
  SELECT count(*)::int AS nova_base_tables
  FROM information_schema.tables WHERE table_schema='nova' AND table_type='BASE TABLE'
),
history AS (
  SELECT count(*)::int AS migration_rows,
         min(version) AS earliest_migration_version,
         max(version) AS latest_migration_version,
         count(*) FILTER (WHERE name='repair_clean_prematch_odds_resumption_20261012')::int AS first_failing_migration_registered
  FROM supabase_migrations.schema_migrations
),
requirements AS (
  SELECT
    to_regprocedure('nova.publish_odds_tick(uuid,bigint,text,timestamptz,boolean,text,text[],boolean,text,boolean)') IS NOT NULL AS odds_function_present,
    to_regclass('nova.migrations') IS NOT NULL AS legacy_nova_migration_registry_present,
    to_regclass('nova.wallets') IS NOT NULL AS wallet_table_present,
    to_regclass('nova.softaggregator_callback_receipts') IS NOT NULL AS casino_receipts_present,
    to_regclass('nova.bets') IS NOT NULL AS sportsbook_bets_present,
    to_regclass('nova.user_limits') IS NOT NULL AS user_limits_table_present
)
SELECT
  nova_objects.nova_base_tables, history.*,
  requirements.*,
  (requirements.odds_function_present
   AND requirements.legacy_nova_migration_registry_present
   AND requirements.sportsbook_bets_present) AS first_migration_base_dependencies_present
FROM nova_objects CROSS JOIN history CROSS JOIN requirements;
