-- ============================================================================
-- 0130 - AFFILIATE SELF-REGISTRATION (SERVER AUTHORITY)
--
-- Affiliate sign-up touches `nova.affiliates` AND flags `nova.profiles.is_affiliate`,
-- both of which are protected from direct client writes by section 0090. Rather than
-- weakening those guards, registration goes through this SECURITY DEFINER function:
--   * the caller can only register THEIR OWN user id
--   * code uniqueness and format are enforced here
--   * a parent code must resolve to an approved affiliate, and the parent/child edge
--     is written through the same depth/cycle rules as every other hierarchy change
--   * status starts at 'pending' - approval is an explicit admin action
-- ============================================================================

create or replace function nova.register_affiliate(
  p_user_id      uuid,
  p_code         text,
  p_display_name text,
  p_model        commission_model default 'NON_NEGATIVE_35',
  p_rate_bps     int default 3500,
  p_parent_code  text default null,
  p_currency     text default 'IRT',
  p_min_payout   bigint default 5000000
) returns jsonb
language plpgsql security definer set search_path = nova, public as $$
declare
  v_actor uuid := nova.current_user_id();
  v_role text := nova.current_user_role();
  v_code text := upper(trim(coalesce(p_code, '')));
  v_parent uuid;
  v_id uuid;
  v_public text;
begin
  -- Server-side authorisation: the actor must be the affiliate owner, an admin, or the
  -- trusted service role (server-side callers only - never a browser session).
  if v_actor is not null and v_actor <> p_user_id and not nova.is_admin() then
    raise exception 'FORBIDDEN: cannot register an affiliate for another user' using errcode = '42501';
  end if;
  if v_role = 'anon' and v_actor is null then
    raise exception 'UNAUTHENTICATED' using errcode = '42501';
  end if;

  if v_code !~ '^[A-Z0-9]{4,16}$' then
    raise exception 'VALIDATION_FAILED: referral code must be 4-16 characters of A-Z/0-9' using errcode = '22023';
  end if;
  if exists (select 1 from nova.affiliates where code = v_code) then
    raise exception 'CONFLICT: referral code already taken' using errcode = '23505';
  end if;
  if exists (select 1 from nova.affiliates where user_id = p_user_id) then
    raise exception 'CONFLICT: this account already has an affiliate profile' using errcode = '23505';
  end if;
  if p_rate_bps < 0 or p_rate_bps > 10000 then
    raise exception 'VALIDATION_FAILED: rate must be between 0 and 10000 bps' using errcode = '22023';
  end if;

  if p_parent_code is not null and length(trim(p_parent_code)) > 0 then
    select id into v_parent from nova.affiliates
     where code = upper(trim(p_parent_code)) and status = 'approved';
    if v_parent is null then
      raise exception 'NOT_FOUND: parent affiliate code' using errcode = 'P0002';
    end if;
  end if;

  v_public := 'NA-' || upper(substr(md5(gen_random_uuid()::text), 1, 8));
  insert into nova.affiliates (user_id, public_id, code, slug, display_name, status, commission_model,
      commission_rate_bps, allow_negative_balance, negative_balance_floor_minor, min_payout_minor, currency,
      parent_affiliate_id, depth)
  values (p_user_id, v_public, v_code, lower(v_code), coalesce(nullif(trim(p_display_name), ''), v_code), 'pending',
      p_model, p_rate_bps, (p_model = 'PROFIT_LOSS_35'), 0, p_min_payout, p_currency,
      v_parent, case when v_parent is null then 0 else 1 end)
  returning id into v_id;

  -- The derived `is_affiliate` flag is maintained here and ONLY here. The 0090 profile
  -- guard allows precisely this one field, and only while this transaction-local marker
  -- matches the profile being updated, which no client-reachable path can forge.
  perform set_config('nova.affiliate_signup', p_user_id::text, true);
  update nova.profiles set is_affiliate = true where id = p_user_id;

  -- Root affiliates have no edge to record: the column is NOT NULL by design, so a
  -- registration without a parent simply starts the tree at depth 0.
  if v_parent is not null then
    insert into nova.affiliate_relationships (affiliate_id, parent_affiliate_id, depth, path, reason)
    values (v_id, v_parent, 1, v_parent::text || '/' || v_id::text, 'registration');
  end if;

  perform nova.audit_event(coalesce(v_actor, p_user_id), 'affiliate.register', 'affiliate', v_id::text,
    null, jsonb_build_object('code', v_code, 'model', p_model, 'rate_bps', p_rate_bps, 'parent', v_parent),
    'self-service registration', null, '{}'::jsonb);

  return jsonb_build_object('ok', true, 'affiliate_id', v_id, 'code', v_code, 'public_id', v_public,
                            'status', 'pending', 'parent_affiliate_id', v_parent);
end $$;

revoke all on function nova.register_affiliate(uuid, text, text, commission_model, int, text, text, bigint) from public, anon;
grant execute on function nova.register_affiliate(uuid, text, text, commission_model, int, text, text, bigint) to authenticated, service_role;

-- Suspending/activating an affiliate is an admin action; keep it in one place so the
-- "who approved this" trail is complete.
create or replace function nova.set_affiliate_status(p_affiliate_id uuid, p_status affiliate_status, p_actor uuid, p_reason text)
returns jsonb
language plpgsql security definer set search_path = nova, public as $$
declare v_before affiliate_status;
begin
  if not nova.is_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  select status into v_before from nova.affiliates where id = p_affiliate_id;
  if v_before is null then
    raise exception 'AFFILIATE_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_before = p_status then
    return jsonb_build_object('ok', true, 'status', p_status, 'unchanged', true);
  end if;
  update nova.affiliates
     set status = p_status,
         approved_at = case when p_status = 'approved' then coalesce(approved_at, now()) else approved_at end
   where id = p_affiliate_id;
  perform nova.audit_event(p_actor, 'affiliate.status.' || p_status::text, 'affiliate', p_affiliate_id::text,
    jsonb_build_object('status', v_before), jsonb_build_object('status', p_status), p_reason, null, '{}'::jsonb);
  return jsonb_build_object('ok', true, 'status', p_status, 'unchanged', false);
end $$;

revoke all on function nova.set_affiliate_status(uuid, affiliate_status, uuid, text) from public, anon;
grant execute on function nova.set_affiliate_status(uuid, affiliate_status, uuid, text) to authenticated, service_role;


-- ---------------------------------------------------------------------------
-- Re-state the profile guard with a single, explicit exception: the derived
-- `profiles.is_affiliate` flag may be set by nova.register_affiliate for the
-- profile it is registering, inside the same transaction. Every other protected
-- field, and every other caller, still cannot touch these columns.
-- ---------------------------------------------------------------------------
create or replace function nova.guard_profile_update() returns trigger
language plpgsql as $$
declare
  v_signup_target text := current_setting('nova.affiliate_signup', true);
begin
  if nova.is_admin() then
    return new;
  end if;

  if new.is_affiliate is distinct from old.is_affiliate
     and new.is_affiliate
     and v_signup_target is not null
     and v_signup_target = old.id::text
     and new.role = old.role and new.status = old.status and new.kyc_status = old.kyc_status
     and new.public_id = old.public_id
     and new.email is not distinct from old.email
     and new.phone is not distinct from old.phone then
    return new;
  end if;

  if new.role <> old.role or new.status <> old.status or new.kyc_status <> old.kyc_status
     or new.age_verified <> old.age_verified or new.email_verified <> old.email_verified
     or new.is_affiliate <> old.is_affiliate or new.public_id <> old.public_id then
    raise exception 'FORBIDDEN: protected profile fields' using errcode = '42501';
  end if;
  return new;
end $$;
