-- 0162 - Stable numeric user id
-- Public-facing numeric account id. Internal UUID/public_id remain unchanged.

create sequence if not exists nova.user_numeric_id_seq
  start with 1000
  increment by 1
  minvalue 1000
  no cycle;

alter table nova.profiles
  add column if not exists numeric_id bigint;

with numbered as (
  select
    id,
    999 + row_number() over (order by created_at asc, id asc) as assigned_numeric_id
  from nova.profiles
  where numeric_id is null
)
update nova.profiles p
set numeric_id = n.assigned_numeric_id
from numbered n
where p.id = n.id;

select setval(
  'nova.user_numeric_id_seq'::regclass,
  greatest(
    coalesce((select max(numeric_id) from nova.profiles), 999),
    999
  ),
  true
);

alter table nova.profiles
  alter column numeric_id set default nextval('nova.user_numeric_id_seq'::regclass);

alter table nova.profiles
  alter column numeric_id set not null;

create unique index if not exists profiles_numeric_id_uidx
  on nova.profiles (numeric_id);

comment on column nova.profiles.numeric_id is
  'Stable numeric public-facing user account ID, allocated from 1000 upward.';

