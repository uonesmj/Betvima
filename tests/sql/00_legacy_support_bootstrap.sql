-- CI-only legacy Supabase objects required by historical support migrations.
-- Never installed in production: existing Supabase support/storage tables live there.
create schema if not exists storage;
create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  assigned_to uuid,
  status text not null default 'waiting_support',
  updated_at timestamptz not null default now()
);
create table if not exists public.ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid references public.tickets(id),
  sender_id uuid,
  created_at timestamptz not null default now()
);
create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);

-- Supabase Auth supplies this helper in production; plain PostgreSQL does not.
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;

-- GoTrue-auth columns used by later 0140 signup trigger in the clean test DB.
alter table auth.users add column if not exists raw_user_meta_data jsonb not null default '{}'::jsonb;
alter table auth.users add column if not exists phone text;
alter table auth.users add column if not exists email_confirmed_at timestamptz;
