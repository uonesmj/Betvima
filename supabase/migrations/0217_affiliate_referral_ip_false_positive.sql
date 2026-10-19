-- 0217: Avoid false-positive SAME_IP reviews from a user's own referral click.
-- Existing review cases remain unchanged and require the usual independent review.
create or replace function nova.attach_attribution(
  p_user_id uuid,
  p_code text,
  p_click_id uuid default null,
  p_ip_hash text default null,
  p_device text default null
) returns jsonb
language plpgsql
security definer
set search_path = nova, public
as $function$
declare
  v_aff nova.affiliates%rowtype;
  v_existing nova.affiliate_attributions%rowtype;
  v_profile nova.profiles%rowtype;
  v_link_id uuid;
  v_campaign text;
  v_signals text[] := '{}';
  v_status attribution_status := 'confirmed';
  v_id uuid;
begin
  select a.*
    into v_aff
    from nova.affiliates a
   where upper(a.code) = upper(p_code)
      or lower(a.slug) = lower(p_code)
      or exists (
        select 1
          from nova.affiliate_links l
         where l.affiliate_id = a.id
           and upper(l.code) = upper(p_code)
           and l.is_active
      )
   order by case when upper(a.code) = upper(p_code) or lower(a.slug) = lower(p_code) then 0 else 1 end
   limit 1;

  if found then
    select l.id, l.campaign
      into v_link_id, v_campaign
      from nova.affiliate_links l
     where l.affiliate_id = v_aff.id
       and upper(l.code) = upper(p_code)
       and l.is_active
     order by l.created_at desc
     limit 1;
  end if;

  if v_aff.id is null then
    return jsonb_build_object('attributed', false, 'reason', 'UNKNOWN_CODE');
  end if;

  if v_aff.status <> 'approved' then
    return jsonb_build_object('attributed', false, 'reason', 'AFFILIATE_NOT_APPROVED');
  end if;

  select * into v_existing from nova.affiliate_attributions where user_id = p_user_id;
  if found then
    return jsonb_build_object('attributed', false, 'reason', 'ALREADY_ATTRIBUTED', 'affiliate_id', v_existing.affiliate_id);
  end if;

  select * into v_profile from nova.profiles where id = p_user_id;
  if not found then
    raise exception 'USER_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_profile.id = v_aff.user_id then
    insert into nova.affiliate_fraud_flags
      (affiliate_id, user_id, signal, severity, status, details)
    values
      (v_aff.id, p_user_id, 'SELF_REFERRAL', 'critical', 'blocked',
       jsonb_build_object('code', p_code, 'ip_hash', p_ip_hash));
    return jsonb_build_object('attributed', false, 'reason', 'SELF_REFERRAL_BLOCKED');
  end if;

  if v_profile.email_hash is not null and exists (
    select 1
      from nova.profiles ap
     where ap.id = v_aff.user_id
       and ap.email_hash = v_profile.email_hash
  ) then
    insert into nova.affiliate_fraud_flags
      (affiliate_id, user_id, signal, severity, status, details)
    values
      (v_aff.id, p_user_id, 'SELF_REFERRAL_EMAIL_MATCH', 'critical', 'blocked',
       jsonb_build_object('code', p_code));
    return jsonb_build_object('attributed', false, 'reason', 'SELF_REFERRAL_BLOCKED');
  end if;

  if p_device is not null and exists (
    select 1
      from nova.affiliate_attributions a
     where a.affiliate_id = v_aff.id
       and a.device_fingerprint = p_device
  ) then
    v_signals := array_append(v_signals, 'SAME_DEVICE');
    v_status := 'review';
  end if;

  -- A visitor must ordinarily register from the same IP as their own
  -- referral click. Only repeat registrations from an already attributed IP
  -- are a risk signal; merely visiting the link is not.
  if p_ip_hash is not null and exists (
    select 1
      from nova.affiliate_attributions prior
     where prior.affiliate_id = v_aff.id
       and prior.user_id <> p_user_id
       and prior.ip_hash = p_ip_hash
       and prior.created_at > now() - interval '1 day'
  ) then
    v_signals := array_append(v_signals, 'SAME_IP');
    if v_status = 'confirmed' then
      v_status := 'review';
    end if;
  end if;

  if v_link_id is null then
    select id, campaign
      into v_link_id, v_campaign
      from nova.affiliate_links
     where affiliate_id = v_aff.id
       and upper(code) = upper(p_code)
       and is_active
     order by created_at desc
     limit 1;
  end if;

  insert into nova.affiliate_attributions (
    affiliate_id, link_id, user_id, code, campaign, status, click_id,
    ip_hash, device_fingerprint, signals, is_immutable, confirmed_at, locked_at
  )
  values (
    v_aff.id, v_link_id, p_user_id, upper(p_code), v_campaign, v_status, p_click_id,
    p_ip_hash, p_device, v_signals, v_status = 'confirmed',
    case when v_status = 'confirmed' then now() end,
    case when v_status = 'confirmed' then now() end
  )
  returning id into v_id;

  if array_length(v_signals, 1) > 0 then
    insert into nova.affiliate_fraud_flags
      (affiliate_id, user_id, signal, severity, status, details)
    values (
      v_aff.id, p_user_id, v_signals[1], 'medium',
      case when v_status = 'review' then 'review' else 'suspicious' end,
      jsonb_build_object('signals', v_signals)
    );
  end if;

  perform nova.audit_event(
    null,
    'affiliate.attribution.attach',
    'affiliate_attribution',
    v_id::text,
    null,
    jsonb_build_object(
      'affiliate_id', v_aff.id,
      'status', v_status,
      'signals', v_signals
    ),
    null,
    null
  );

  return jsonb_build_object(
    'attributed', true,
    'attribution_id', v_id,
    'affiliate_id', v_aff.id,
    'status', v_status,
    'signals', v_signals
  );
end
$function$;

grant execute on function nova.attach_attribution(uuid, text, uuid, text, text) to authenticated;
