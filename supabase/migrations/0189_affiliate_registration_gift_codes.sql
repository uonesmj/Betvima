create table if not exists nova.affiliate_registration_gift_codes (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references nova.affiliates(id) on delete cascade,
  code text not null,
  is_active boolean not null default true,
  usage_count bigint not null default 0,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  constraint affiliate_registration_gift_codes_code_format
    check (code = upper(code) and code ~ '^[A-Z0-9]{4,8}$'),
  constraint affiliate_registration_gift_codes_usage_nonnegative
    check (usage_count >= 0)
);

create unique index if not exists affiliate_registration_gift_codes_code_uq
  on nova.affiliate_registration_gift_codes (lower(code));

create index if not exists affiliate_registration_gift_codes_affiliate_idx
  on nova.affiliate_registration_gift_codes (affiliate_id, created_at desc);

create or replace function nova.create_affiliate_registration_gift_code(
  p_affiliate_id uuid,
  p_code text
) returns jsonb
language plpgsql
security definer
set search_path = nova, public
as $$
declare
  v_aff nova.affiliates%rowtype;
  v_code text := upper(trim(p_code));
  v_id uuid;
begin
  select * into v_aff
    from nova.affiliates
   where id = p_affiliate_id
   for update;

  if not found then
    raise exception 'AFFILIATE_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_aff.user_id is distinct from auth.uid()
     and auth.uid() is not null then
    raise exception 'AFFILIATE_ACCESS_DENIED' using errcode = '42501';
  end if;

  if v_aff.status <> 'approved' then
    raise exception 'AFFILIATE_NOT_APPROVED' using errcode = 'P0001';
  end if;

  if v_code !~ '^[A-Z0-9]{4,8}$' then
    raise exception 'GIFT_CODE_INVALID_FORMAT' using errcode = '22023';
  end if;

  if (
    select count(*)
      from nova.affiliate_registration_gift_codes
     where affiliate_id = v_aff.id
  ) >= 10 then
    raise exception 'GIFT_CODE_LIMIT_REACHED' using errcode = 'P0001';
  end if;

  if exists (
    select 1
      from nova.affiliate_registration_gift_codes
     where lower(code) = lower(v_code)
  ) then
    raise exception 'GIFT_CODE_UNAVAILABLE' using errcode = '23505';
  end if;

  insert into nova.affiliate_registration_gift_codes
    (affiliate_id, code)
  values
    (v_aff.id, v_code)
  returning id into v_id;

  return jsonb_build_object(
    'id', v_id,
    'affiliate_id', v_aff.id,
    'code', v_code,
    'is_active', true,
    'usage_count', 0
  );
end
$$;

create or replace function nova.attach_gift_registration_code(
  p_user_id uuid,
  p_code text,
  p_ip_hash text default null,
  p_device text default null
) returns jsonb
language plpgsql
security definer
set search_path = nova, public
as $$
declare
  v_gift nova.affiliate_registration_gift_codes%rowtype;
  v_aff nova.affiliates%rowtype;
  v_result jsonb;
  v_attributed boolean;
begin
  select * into v_gift
    from nova.affiliate_registration_gift_codes
   where is_active
     and lower(code) = lower(trim(p_code))
   limit 1
   for update;

  if not found then
    return jsonb_build_object(
      'gift_code_found', false,
      'attributed', false,
      'reason', 'UNKNOWN_GIFT_CODE'
    );
  end if;

  select * into v_aff
    from nova.affiliates
   where id = v_gift.affiliate_id;

  if not found or v_aff.status <> 'approved' then
    return jsonb_build_object(
      'gift_code_found', true,
      'attributed', false,
      'reason', 'AFFILIATE_NOT_APPROVED'
    );
  end if;

  v_result := nova.attach_attribution(
    p_user_id,
    v_aff.code,
    null,
    p_ip_hash,
    p_device
  );

  v_attributed := coalesce((v_result ->> 'attributed')::boolean, false);

  if v_attributed then
    update nova.affiliate_registration_gift_codes
       set usage_count = usage_count + 1,
           last_used_at = now()
     where id = v_gift.id;
  end if;

  return v_result
    || jsonb_build_object(
      'gift_code_found', true,
      'gift_code', v_gift.code,
      'gift_code_id', v_gift.id
    );
end
$$;

grant execute on function nova.create_affiliate_registration_gift_code(uuid, text)
  to authenticated, service_role;

grant execute on function nova.attach_gift_registration_code(uuid, text, text, text)
  to authenticated, service_role;

alter table nova.affiliate_registration_gift_codes enable row level security;

drop policy if exists affiliate_registration_gift_codes_own_select
  on nova.affiliate_registration_gift_codes;

create policy affiliate_registration_gift_codes_own_select
  on nova.affiliate_registration_gift_codes
  for select
  to authenticated
  using (
    exists (
      select 1
        from nova.affiliates a
       where a.id = affiliate_registration_gift_codes.affiliate_id
         and a.user_id = auth.uid()
    )
  );
