-- Identity evidence is collected through the existing support chat.
-- Metadata must not be modifiable via the public Supabase Data API.
-- The application persists and reads attachments server-side via its privileged DB adapter.
BEGIN;
ALTER TABLE public.ticket_attachments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ticket_attachments FROM anon, authenticated;
COMMIT;
