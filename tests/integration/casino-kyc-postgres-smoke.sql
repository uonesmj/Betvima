-- Disposable PostgreSQL-only KYC migration and review smoke test.
-- No production database, actual identity documents, API credentials or wallets.
\set ON_ERROR_STOP on

create schema nova;
create schema storage;
create role anon nologin;
create role authenticated nologin;
create table nova.profiles (id uuid primary key);
create table storage.buckets (
  id text primary key, name text not null, public boolean not null,
  file_size_limit bigint, allowed_mime_types text[]
);
\ir ../../supabase/migrations/0214_casino_kyc_review.sql

-- Existing support attachment metadata must be server-only before staff may
-- approve an identity from a chat attachment. Reproduce old public grants.
create table public.ticket_attachments(id uuid primary key);
grant all on public.ticket_attachments to anon, authenticated;
\ir ../../supabase/migrations/0215_support_attachment_private_metadata.sql
do $support_guard$
begin
  if not (select relrowsecurity from pg_class
    where oid='public.ticket_attachments'::regclass) then
    raise exception 'Support evidence table RLS must be enabled';
  end if;
  if has_table_privilege('anon','public.ticket_attachments','SELECT')
    or has_table_privilege('anon','public.ticket_attachments','INSERT')
    or has_table_privilege('authenticated','public.ticket_attachments','UPDATE')
    or has_table_privilege('authenticated','public.ticket_attachments','DELETE')
  then
    raise exception 'Support evidence can still be modified directly by a client';
  end if;
end $support_guard$;

do $kyc_smoke$
declare
  user_id constant uuid := '11111111-1111-4111-8111-111111111111';
  reviewer_id constant uuid := '22222222-2222-4222-8222-222222222222';
  pending_id uuid;
  replacement_id uuid;
  blocked boolean := false;
begin
  insert into nova.profiles(id) values(user_id), (reviewer_id);

  if to_regclass('nova.kyc_submissions') is null then
    raise exception 'Missing KYC evidence table';
  end if;
  if not exists(select 1 from storage.buckets where id='betvima-kyc'
    and public=false and file_size_limit=8388608
    and allowed_mime_types @> array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
  then
    raise exception 'Identity bucket must be private and size/type restricted';
  end if;
  if not exists(select 1 from pg_class
    where oid='nova.kyc_submissions'::regclass and relrowsecurity)
  then
    raise exception 'KYC RLS is not enabled';
  end if;
  if has_table_privilege('anon', 'nova.kyc_submissions','SELECT')
    or has_table_privilege('authenticated', 'nova.kyc_submissions','SELECT')
    or has_table_privilege('authenticated', 'nova.kyc_submissions','INSERT')
    or has_table_privilege('authenticated', 'nova.kyc_submissions','UPDATE')
  then
    raise exception 'Identity evidence must be inaccessible via customer roles';
  end if;

  insert into nova.kyc_submissions(user_id,document_type,document_path)
    values(user_id,'passport','test-only/private/user/passport.pdf')
    returning id into pending_id;
  if not exists(select 1 from nova.kyc_submissions
    where id=pending_id and status='pending' and legal_age_confirmed=false and reviewed_by is null)
  then
    raise exception 'New submissions must be pending, with no implicit identity or age approval';
  end if;

  begin
    insert into nova.kyc_submissions(user_id,document_type,document_path)
      values(user_id,'national_id','test-only/private/user/duplicate.png');
  exception when unique_violation then
    blocked := true;
  end;
  if not blocked then
    raise exception 'More than one pending submission was accepted';
  end if;

  update nova.kyc_submissions set status='rejected', reviewed_by=reviewer_id,
    reviewed_at=now(), review_note='Synthetic evidence unreadable'
    where id=pending_id;
  insert into nova.kyc_submissions(user_id,document_type,document_path)
    values(user_id,'national_id','test-only/private/user/retry.png')
    returning id into replacement_id;
  if replacement_id = pending_id then
    raise exception 'Retry should be a distinct submission';
  end if;

  update nova.kyc_submissions set status='verified', reviewed_by=reviewer_id,
    reviewed_at=now(), review_note='Synthetic identity and legal age verified',
    legal_age_confirmed=true where id=replacement_id;
  if not exists(select 1 from nova.kyc_submissions
    where id=replacement_id and status='verified' and reviewed_by=reviewer_id
      and reviewed_at is not null and legal_age_confirmed=true)
  then
    raise exception 'Operator approval and verified age were not persisted';
  end if;
  if exists(select 1 from nova.kyc_submissions
    where id=pending_id and status='verified')
  then
    raise exception 'Rejected evidence was incorrectly approved';
  end if;
  raise notice 'PASS: private bucket, RLS, pending uniqueness, rejection/retry, admin identity+age review';
end $kyc_smoke$;
