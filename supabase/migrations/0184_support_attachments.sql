begin;
create table if not exists public.ticket_attachments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  message_id uuid not null references public.ticket_messages(id) on delete cascade,
  uploader_id uuid,
  uploader_role text not null check (uploader_role in ('user','support')),
  bucket_id text not null default 'support-attachments',
  storage_path text not null unique,
  original_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 10485760),
  created_at timestamptz not null default now()
);
create index if not exists idx_ticket_attachments_ticket_created on public.ticket_attachments (ticket_id, created_at asc);
create index if not exists idx_ticket_attachments_message on public.ticket_attachments (message_id);
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('support-attachments','support-attachments',false,10485760,array['image/jpeg','image/png','image/webp','application/pdf']::text[])
on conflict (id) do update set public=false,file_size_limit=10485760,allowed_mime_types=excluded.allowed_mime_types;
commit;
