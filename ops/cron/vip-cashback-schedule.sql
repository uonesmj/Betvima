-- Admin-only operational installation. Run after checking cron.timezone = GMT/UTC.
-- 05:30 UTC Monday = 09:00 Asia/Tehran (Iran uses UTC+03:30).
-- Two finance DB switches must BOTH be enabled before any credit occurs.
-- Monday is primary payout; Tuesday-Sunday is idempotent missed-run retry.
select cron.schedule(
  'betvima-vip-cashback-monday',
  '30 5 * * 1',
  'select nova.vip_cashback_process_due_week(true);'
);
select cron.schedule(
  'betvima-vip-cashback-missed-run-retry',
  '0 8 * * 2-7',
  'select nova.vip_cashback_process_due_week(true);'
);
