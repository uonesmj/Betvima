begin;

alter table nova.profiles
  add column if not exists username text;

alter table nova.profiles
  drop constraint if exists profiles_username_format;

alter table nova.profiles
  add constraint profiles_username_format
  check (
    username is null
    or username ~ '^[a-zA-Z0-9_]{3,32}$'
  );

create unique index if not exists profiles_username_lower_uidx
  on nova.profiles (lower(username))
  where username is not null;

create index if not exists profiles_username_idx
  on nova.profiles (username)
  where username is not null;

commit;
