begin;

create index if not exists idx_tickets_assigned_status_updated
  on public.tickets (assigned_to, status, updated_at desc);

create index if not exists idx_ticket_messages_sender_created
  on public.ticket_messages (sender_id, created_at desc);

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conrelid = 'public.tickets'::regclass
       and conname = 'tickets_assigned_to_fkey'
  ) then
    alter table public.tickets
      add constraint tickets_assigned_to_fkey
      foreign key (assigned_to)
      references auth.users(id)
      on delete set null;
  end if;
end
$$;

commit;
