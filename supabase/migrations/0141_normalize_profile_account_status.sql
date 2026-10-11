begin;

alter table nova.profiles
  alter column status drop default;

alter table nova.profiles
  alter column status type nova.account_status
  using status::text::nova.account_status;

alter table nova.profiles
  alter column status set default 'active'::nova.account_status;

drop index if exists nova.profiles_status_idx;

create index if not exists profiles_status_idx
  on nova.profiles(status);

commit;
