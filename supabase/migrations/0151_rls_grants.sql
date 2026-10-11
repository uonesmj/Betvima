-- =====================================================================
-- 0151: table privileges for the tables secured in 0150.
--
-- Row level security decides WHICH rows a caller sees; a GRANT decides whether the caller
-- may touch the table at all. Enabling RLS alone therefore produced "permission denied"
-- instead of an empty result set, which is a different (and less informative) failure.
--
--   public catalogue  -> select for anon + authenticated (visibility still filtered per row)
--   operator/affiliate-> select for authenticated, rows filtered by the policy
--   nova.migrations   -> NO grant: infrastructure is service-role only
-- =====================================================================
grant select on nova.seasons, nova.players, nova.match_stats to anon, authenticated;
grant select on nova.settlement_events, nova.affiliate_groups, nova.affiliate_group_members to authenticated;
grant select, insert, update, delete on nova.affiliate_groups, nova.affiliate_group_members to authenticated;
