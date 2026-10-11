create or replace function nova.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_locale text;
  v_currency text;
  v_phone text;
  v_public_id text;
  v_age_verified boolean;
begin
  v_locale :=
    case
      when new.raw_user_meta_data ->> 'locale' in ('fa', 'en')
        then new.raw_user_meta_data ->> 'locale'
      else 'fa'
    end;

  v_currency :=
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'currency'), ''),
      'IRT'
    );

  v_phone :=
    nullif(
      trim(coalesce(new.raw_user_meta_data ->> 'phone', new.phone)),
      ''
    );

  v_public_id := 'usr_' || replace(new.id::text, '-', '');

  begin
    v_age_verified :=
      coalesce(
        nullif(new.raw_user_meta_data ->> 'ageConfirmed', '')::boolean,
        false
      );
  exception when others then
    v_age_verified := false;
  end;

  insert into nova.profiles (
    id,
    public_id,
    email,
    phone,
    preferred_locale,
    preferred_currency,
    timezone,
    email_verified,
    age_verified,
    role,
    status
  )
  values (
    new.id,
    v_public_id,
    new.email,
    v_phone,
    v_locale,
    v_currency,
    'Asia/Tehran',
    new.email_confirmed_at is not null,
    v_age_verified,
    'user',
    'active'
  )
  on conflict (id) do update
  set
    email = coalesce(excluded.email, nova.profiles.email),
    phone = coalesce(excluded.phone, nova.profiles.phone),
    preferred_locale = coalesce(excluded.preferred_locale, nova.profiles.preferred_locale),
    preferred_currency = coalesce(excluded.preferred_currency, nova.profiles.preferred_currency);

  return new;
end;
$$;

revoke all on function nova.handle_new_auth_user() from public;

drop trigger if exists on_auth_user_created_nova_profile on auth.users;

create trigger on_auth_user_created_nova_profile
after insert on auth.users
for each row
execute function nova.handle_new_auth_user();
