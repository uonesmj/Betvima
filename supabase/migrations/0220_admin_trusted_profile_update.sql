-- 0220: Honour server-side trusted database administrators for profile updates.
-- Direct authenticated user SQL continues to be protected by the same trigger.
-- Preserve the existing affiliate signup exception, self-exclusion, KYC and all
-- audit/WAL data. This migration DOES NOT demote or remove any accounts.
CREATE OR REPLACE FUNCTION nova.guard_profile_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_signup_target text := current_setting('nova.affiliate_signup', true);
BEGIN
  -- The production API verifies admin RBAC and AAL2 before using its trusted
  -- database connection. PostgreSQL owner/service_role remain trusted;
  -- ordinary authenticated/anon clients are NOT exempt from protection.
  IF current_user IN ('postgres', 'service_role') OR nova.is_admin() THEN
    RETURN NEW;
  END IF;

  IF new.is_affiliate IS DISTINCT FROM old.is_affiliate
     AND new.is_affiliate
     AND v_signup_target IS NOT NULL
     AND v_signup_target = old.id::text
     AND new.role = old.role AND new.status = old.status AND new.kyc_status = old.kyc_status
     AND new.public_id = old.public_id
     AND new.email IS NOT DISTINCT FROM old.email
     AND new.phone IS NOT DISTINCT FROM old.phone THEN
    RETURN NEW;
  END IF;

  IF new.role <> old.role OR new.status <> old.status OR new.kyc_status <> old.kyc_status
     OR new.age_verified <> old.age_verified OR new.email_verified <> old.email_verified
     OR new.is_affiliate <> old.is_affiliate OR new.public_id <> old.public_id THEN
    RAISE EXCEPTION 'FORBIDDEN: protected profile fields' USING errcode = '42501';
  END IF;
  RETURN NEW;
END $$;
