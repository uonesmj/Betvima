begin;

alter table nova.profiles alter column role drop default;

alter table nova.profiles alter column role type nova.user_role using role::text::nova.user_role;

alter table nova.profiles alter column role set default 'user'::nova.user_role;

commit;
