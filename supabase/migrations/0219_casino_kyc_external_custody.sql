-- Casino manual identity approval with documents held only by the operator.
-- Preserve all existing private-upload submissions and their storage paths.
-- Requires a verified database backup and deployment BEFORE the corresponding API.
alter table nova.kyc_submissions
  add column if not exists evidence_source text not null default 'private_upload';
alter table nova.kyc_submissions
  add column if not exists external_evidence_reference text;
alter table nova.kyc_submissions
  alter column document_path drop not null;

-- Explicitly distinguish externally held documents from a file in Supabase.
-- Do not store passport numbers, document content, Telegram handles, or URLs.
alter table nova.kyc_submissions
  add constraint casino_kyc_evidence_custody_check check (
    (evidence_source = 'private_upload'
      and document_path is not null
      and external_evidence_reference is null)
    or
    (evidence_source = 'external_custody'
      and document_path is null
      and selfie_path is null
      and external_evidence_reference is not null
      and length(external_evidence_reference) between 4 and 80
      and status = 'verified'
      and legal_age_confirmed = true
      and reviewed_by is not null
      and reviewed_at is not null)
  );

-- Identity evidence is strictly operator-only. Existing RLS/privileges remain.
alter table nova.kyc_submissions enable row level security;
revoke all on nova.kyc_submissions from anon, authenticated;
comment on column nova.kyc_submissions.external_evidence_reference is
  'Opaque public account reference for an identity document held by the operator outside BetVima; not a path, URL, handle or ID number.';
