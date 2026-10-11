-- =====================================================================
-- 0150: RLS gaps found by `scripts/db-verify.sh`.
--
-- Seven tables had row level security disabled. The verification script treats that as a
-- failure, and it was right: any table without RLS is fully readable/writable by anyone
-- holding the anon or authenticated JWT. Each table now either has a read policy that
-- matches its visibility or is locked to the service role (RLS enabled, no permissive
-- policy), which is what internal bookkeeping tables need.
--
-- Public catalog data  -> read for anon/authenticated, writes service-role only
-- Operator data        -> read for admins, writes service-role only
-- Affiliate data       -> the affiliate sees their own group, admins see everything
-- Infrastructure       -> no access through the API at all (service role bypasses RLS)
-- =====================================================================

-- ---------------------------------------------------------------- public catalog data
alter table nova.seasons enable row level security;
drop policy if exists seasons_public_read on nova.seasons;
create policy seasons_public_read on nova.seasons for select to anon, authenticated using (true);

alter table nova.players enable row level security;
drop policy if exists players_public_read on nova.players;
create policy players_public_read on nova.players for select to anon, authenticated using (true);

alter table nova.match_stats enable row level security;
drop policy if exists match_stats_public_read on nova.match_stats;
create policy match_stats_public_read on nova.match_stats for select to anon, authenticated using (true);

-- ---------------------------------------------------------------- operator data
alter table nova.settlement_events enable row level security;
drop policy if exists settlement_events_admin_read on nova.settlement_events;
create policy settlement_events_admin_read on nova.settlement_events for select to authenticated
  using (nova.is_admin());

-- ---------------------------------------------------------------- affiliate groups
alter table nova.affiliate_groups enable row level security;
drop policy if exists affiliate_groups_read on nova.affiliate_groups;
create policy affiliate_groups_read on nova.affiliate_groups for select to authenticated
  using (
    nova.is_admin()
    or exists (
      select 1
        from nova.affiliate_group_members m
        join nova.affiliates a on a.id = m.affiliate_id
       where m.group_id = nova.affiliate_groups.id
         and a.user_id = nova.current_user_id()
    )
  );
drop policy if exists affiliate_groups_admin_write on nova.affiliate_groups;
create policy affiliate_groups_admin_write on nova.affiliate_groups for all to authenticated
  using (nova.is_admin()) with check (nova.is_admin());

alter table nova.affiliate_group_members enable row level security;
drop policy if exists affiliate_group_members_read on nova.affiliate_group_members;
create policy affiliate_group_members_read on nova.affiliate_group_members for select to authenticated
  using (
    nova.is_admin()
    or exists (
      select 1 from nova.affiliates a
       where a.user_id = nova.current_user_id() and a.id = nova.affiliate_group_members.affiliate_id
    )
  );
drop policy if exists affiliate_group_members_admin_write on nova.affiliate_group_members;
create policy affiliate_group_members_admin_write on nova.affiliate_group_members for all to authenticated
  using (nova.is_admin()) with check (nova.is_admin());

-- ---------------------------------------------------------------- infrastructure
-- Migration bookkeeping is never exposed through the API. RLS enabled with no policy means
-- "service role only", which is exactly the intent.
alter table nova.migrations enable row level security;
