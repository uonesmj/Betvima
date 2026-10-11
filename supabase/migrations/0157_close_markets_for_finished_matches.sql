-- ============================================================================
-- 0157 - CLOSE MARKETS FOR ALREADY-FINISHED MATCHES
--
-- The odds worker now closes open/suspended markets and selections when a
-- provider result transitions a match to finished. This migration repairs
-- historical finished matches that were finalized before that lifecycle rule
-- existed.
--
-- Idempotent:
--   * only finished matches are targeted
--   * only open/suspended markets and selections are changed
--   * no bet, wallet, result, or settlement record is modified
-- ============================================================================

begin;

update nova.markets mk
   set status = 'closed'::nova.market_status,
       updated_at = now()
 where mk.status::text in ('open', 'suspended')
   and exists (
     select 1
       from nova.matches m
      where m.id = mk.match_id
        and m.status::text = 'finished'
   );

update nova.selections s
   set status = 'closed'::nova.selection_status,
       updated_at = now()
 where s.status::text in ('open', 'suspended')
   and exists (
     select 1
       from nova.matches m
       join nova.markets mk on mk.match_id = m.id
      where mk.id = s.market_id
        and m.status::text = 'finished'
   );

commit;
