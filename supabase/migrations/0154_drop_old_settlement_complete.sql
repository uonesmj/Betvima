-- ============================================================================
-- 0154 - REMOVE LEGACY SETTLEMENT COMPLETION FUNCTION
--
-- The legacy 3-argument overload did not enforce worker ownership.
-- Keep only the ownership-aware 4-argument version.
-- ============================================================================

drop function if exists nova.complete_settlement_job(
  uuid,
  nova.settlement_job_status,
  text
);
