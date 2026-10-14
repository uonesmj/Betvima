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
