-- Operation-specific, in-database rollback snapshot. This is NOT a full
-- offsite PostgreSQL backup; Supabase Pro managed backups are independent.
-- Run only after verifying the KYC schema and before external-custody migration.
create schema if not exists betvima_safe_backup;
revoke all on schema betvima_safe_backup from public, anon, authenticated;
create table betvima_safe_backup.casino_kyc_20261027 as
  select * from nova.kyc_submissions;
create table betvima_safe_backup.profile_kyc_20261027 as
  select id, kyc_status::text as kyc_status, age_verified, created_at
  from nova.profiles;
alter table betvima_safe_backup.casino_kyc_20261027 enable row level security;
alter table betvima_safe_backup.profile_kyc_20261027 enable row level security;
revoke all on betvima_safe_backup.casino_kyc_20261027 from public, anon, authenticated;
revoke all on betvima_safe_backup.profile_kyc_20261027 from public, anon, authenticated;
comment on schema betvima_safe_backup is 'Private operator rollback data; not a complete offsite database backup.';
comment on table betvima_safe_backup.casino_kyc_20261027 is 'KYC submission snapshot before casino external document custody migration, 2026-10-27.';
comment on table betvima_safe_backup.profile_kyc_20261027 is 'Profile KYC flag snapshot before casino external document custody migration, 2026-10-27.';
