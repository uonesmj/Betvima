-- Private operator-reviewed casino identity submissions.
-- Do not expose IDs or document objects through PostgREST, anonymous roles or public buckets.
create table if not exists nova.kyc_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references nova.profiles(id) on delete cascade,
  document_type text not null check (document_type in ('national_id','passport','drivers_license')),
  document_path text not null,
  selfie_path text,
  status text not null default 'pending' check (status in ('pending','verified','rejected')),
  consented_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references nova.profiles(id) on delete set null,
  review_note text,
  legal_age_confirmed boolean not null default false
);
create unique index if not exists kyc_submissions_one_pending_per_user
  on nova.kyc_submissions(user_id) where status = 'pending';
create index if not exists kyc_submissions_queue_idx on nova.kyc_submissions(status,created_at);
alter table nova.kyc_submissions enable row level security;
revoke all on nova.kyc_submissions from anon, authenticated;
-- Server-side service role is the only uploader/viewer; never create client policies.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
  values ('betvima-kyc','betvima-kyc',false,8388608,
          array['image/jpeg','image/png','image/webp','application/pdf'])
  on conflict (id) do update set public=false,
    file_size_limit=excluded.file_size_limit, allowed_mime_types=excluded.allowed_mime_types;
