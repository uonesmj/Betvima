-- Confirmed read receipts and observed staff presence; no fabricated online status.
alter table public.ticket_messages
  add column if not exists read_at timestamptz;

create index if not exists idx_ticket_messages_unread_by_sender
  on public.ticket_messages(ticket_id, sender_role) where read_at is null;

create table if not exists public.support_agent_presence (
  agent_id uuid primary key,
  last_seen timestamptz not null default now()
);
create index if not exists idx_support_presence_last_seen
  on public.support_agent_presence(last_seen desc);

-- All access is via authenticated server routes, not direct client table reads.
alter table public.support_agent_presence enable row level security;
revoke all on public.support_agent_presence from anon, authenticated;
