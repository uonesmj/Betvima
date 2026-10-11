create or replace function nova.register_affiliate(
  p_user_id uuid,
  p_code text,
  p_display_name text,
  p_model nova.commission_model default 'NON_NEGATIVE_35',
  p_rate_bps integer default 3500,
  p_parent_code text default null,
  p_currency text default 'IRT',
  p_min_payout bigint default 5000000
)
returns jsonb
language plpgsql
security definer
set search_path to 'nova', 'public'
as $function$
declare
  v_actor uuid := nova.current_user_id();
  v_role text := nova.current_user_role();
  v_code text := upper(trim(coalesce(p_code, '')));
  v_parent uuid;
  v_id uuid;
  v_public text;
begin
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
    select id into v_parent
    from nova.affiliates
    where code = upper(trim(p_parent_code))
      and status = 'approved';

    if v_parent is null then
      raise exception 'NOT_FOUND: parent affiliate code' using errcode = 'P0002';
    end if;
  end if;

  v_public := 'NA-' || upper(substr(md5(gen_random_uuid()::text), 1, 8));

  insert into nova.affiliates (
    user_id,
    public_id,
    code,
    slug,
    display_name,
    status,
    commission_model,
    commission_rate_bps,
    allow_negative_balance,
    negative_balance_floor_minor,
    min_payout_minor,
    currency,
    parent_affiliate_id,
    depth
  )
  values (
    p_user_id,
    v_public,
    v_code,
    lower(v_code),
    coalesce(nullif(trim(p_display_name), ''), v_code),
    'approved',
    p_model,
    p_rate_bps,
    (p_model = 'PROFIT_LOSS_35'),
    0,
    p_min_payout,
    p_currency,
    v_parent,
    case when v_parent is null then 0 else 1 end
  )
  returning id into v_id;

  update nova.affiliates
  set approved_at = now()
  where id = v_id;

  perform set_config('nova.affiliate_signup', p_user_id::text, true);

  update nova.profiles
  set is_affiliate = true
  where id = p_user_id;

  if v_parent is not null then
    insert into nova.affiliate_relationships (
      affiliate_id,
      parent_affiliate_id,
      depth,
      path,
      reason
    )
    values (
      v_id,
      v_parent,
      1,
      v_parent::text || '/' || v_id::text,
      'registration'
    );
  end if;

  perform nova.audit_event(
    coalesce(v_actor, p_user_id),
    'affiliate.register',
    'affiliate',
    v_id::text,
    null,
    jsonb_build_object(
      'code', v_code,
      'model', p_model,
      'rate_bps', p_rate_bps,
      'parent', v_parent
    ),
    'self-service registration',
    null,
    '{}'::jsonb
  );

  return jsonb_build_object(
    'ok', true,
    'affiliate_id', v_id,
    'code', v_code,
    'public_id', v_public,
    'status', 'approved',
    'parent_affiliate_id', v_parent
  );
end
$function$;

select '0192 applied: nova.register_affiliate now auto-approves' as result;
