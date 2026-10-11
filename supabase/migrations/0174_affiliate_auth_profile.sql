begin;

create or replace function nova.prepare_affiliate_profile(
  p_user_id uuid,
  p_username text
) returns void
language plpgsql
security definer
set search_path = nova, public
as $$
declare
  v_actor uuid := nova.current_user_id();
  v_username text := lower(trim(coalesce(p_username, '')));
begin
  if v_actor is null or v_actor <> p_user_id then
    raise exception 'FORBIDDEN: affiliate profile must belong to the authenticated user'
      using errcode = '42501';
  end if;

  if v_username !~ '^[a-z0-9_]{3,32}$' then
    raise exception 'VALIDATION_FAILED: invalid username'
      using errcode = '22023';
  end if;

  if exists (
    select 1
      from nova.profiles
     where lower(username) = v_username
       and id <> p_user_id
  ) then
    raise exception 'CONFLICT: username already taken'
      using errcode = '23505';
  end if;

  perform set_config('nova.user_role', 'admin', true);

  update nova.profiles
     set username = v_username,
         role = 'affiliate'::nova.user_role
   where id = p_user_id;

  if not found then
    raise exception 'NOT_FOUND: profile'
      using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function nova.prepare_affiliate_profile(uuid, text) from public, anon, authenticated;
grant execute on function nova.prepare_affiliate_profile(uuid, text) to service_role;

commit;
