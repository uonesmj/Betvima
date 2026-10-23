-- Casino permission is reviewed by authorized support staff, independently from
-- the optional document-submission/KYC workflow used elsewhere in BetVima.
-- This table does NOT claim regulatory KYC completion or authorize a territory.
-- A review must be based on a lawful age/identity verification procedure.
CREATE TABLE IF NOT EXISTS nova.casino_support_approvals (
  user_id uuid PRIMARY KEY REFERENCES nova.profiles(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('approved','revoked')),
  legal_age_confirmed boolean NOT NULL DEFAULT false,
  reviewed_by uuid NOT NULL REFERENCES nova.profiles(id),
  ticket_id uuid NOT NULL,
  review_note text NOT NULL CHECK (length(trim(review_note)) BETWEEN 8 AND 500),
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT casino_support_approval_age
    CHECK (status <> 'approved' OR legal_age_confirmed = true)
);

-- Deliberately no anon/authenticated grants or RLS policies: only the
-- privileged application backend may write, review or revoke approvals.
ALTER TABLE nova.casino_support_approvals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON nova.casino_support_approvals FROM PUBLIC, anon, authenticated;
CREATE INDEX IF NOT EXISTS casino_support_approvals_status_idx
  ON nova.casino_support_approvals(status, reviewed_at DESC);
