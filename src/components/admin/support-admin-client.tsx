'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';

type Status = 'open' | 'waiting_user' | 'waiting_support' | 'resolved' | 'closed';
type Priority = 'low' | 'normal' | 'high' | 'urgent';
type Category = 'deposit' | 'withdrawal' | 'bet' | 'login' | 'bonus' | 'technical' | 'other' | 'general';

type Ticket = {
  id: string;
  userId: string;
  subject: string;
  category: Category;
  priority: Priority;
  status: Status;
  assignedTo: string | null;
  userEmail: string | null;
  userDisplayName: string | null;
  unreadMessages: number;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string | null;
};

type Attachment = {
  id: string;
  ticketId: string;
  messageId: string;
  uploaderId: string | null;
  uploaderRole: 'user' | 'support';
  bucketId: string;
  storagePath: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
};
type Message = {
  id: string;
  ticketId: string;
  senderId: string | null;
  senderRole: 'user' | 'support' | 'system';
  body: string;
  createdAt: string;
  attachments: Attachment[];
};

type TicketListData = {
  tickets?: { items?: Ticket[]; hasMore?: boolean; total?: number } | Ticket[];
};

type TicketDetailData = {
  ticket?: Ticket;
  messages?: Message[];
};

const STATUSES: { value: Status; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'waiting_user', label: 'Waiting user' },
  { value: 'waiting_support', label: 'Waiting support' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];

const PRIORITIES: { value: Priority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

const CATEGORIES: { value: Category; label: string }[] = [
  { value: 'deposit', label: 'Deposit' },
  { value: 'withdrawal', label: 'Withdrawal' },
  { value: 'bet', label: 'Bet' },
  { value: 'login', label: 'Login' },
  { value: 'bonus', label: 'Bonus' },
  { value: 'technical', label: 'Technical' },
  { value: 'other', label: 'Other' },
  { value: 'general', label: 'General' },
];

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: 'same-origin',
    cache: 'no-store',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
  });
  const payload = (await response.json().catch(() => ({}))) as {
    data?: T;
    message?: string;
  };
  if (!response.ok) {
    throw new Error(payload.message || `Request failed (${response.status})`);
  }
  return payload.data ?? (payload as unknown as T);
}

function normalizeTickets(data: TicketListData | null): Ticket[] {
  const value = data?.tickets;
  if (Array.isArray(value)) return value;
  return value?.items ?? [];
}

function statusLabel(status: Status) {
  return STATUSES.find((item) => item.value === status)?.label ?? status;
}

function priorityLabel(priority: Priority) {
  return PRIORITIES.find((item) => item.value === priority)?.label ?? priority;
}

function categoryLabel(category: Category) {
  return CATEGORIES.find((item) => item.value === category)?.label ?? category;
}

function statusClass(status: Status) {
  if (status === 'waiting_support') return 'border-nova-primary/40 bg-nova-primary/10 text-nova-primary';
  if (status === 'waiting_user') return 'border-blue-400/30 bg-blue-400/10 text-blue-300';
  if (status === 'resolved') return 'border-yellow-400/30 bg-yellow-400/10 text-yellow-300';
  if (status === 'closed') return 'border-nova-line bg-nova-surface2 nova-muted';
  return 'border-nova-line bg-nova-surface2 text-nova-text';
}

function priorityClass(priority: Priority) {
  if (priority === 'urgent') return 'text-nova-danger';
  if (priority === 'high') return 'text-yellow-300';
  if (priority === 'low') return 'nova-muted';
  return 'text-nova-text';
}

function formatTime(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function SupportAdminClient() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [assignedTo, setAssignedTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingTicket, setLoadingTicket] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredTickets = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return tickets;
    return tickets.filter((item) =>
      [
        item.subject,
        item.userEmail ?? '',
        item.userDisplayName ?? '',
        item.id,
        item.userId,
      ].some((value) => value.toLowerCase().includes(query)),
    );
  }, [tickets, search]);

  async function loadTickets(keepSelection = true) {
    setLoadingList(true);
    try {
      const query = new URLSearchParams({ page: '1', pageSize: '50' });
      if (statusFilter) query.set('status', statusFilter);
      if (categoryFilter) query.set('category', categoryFilter);
      if (priorityFilter) query.set('priority', priorityFilter);
      const data = await request<TicketListData>(`/api/v1/admin/support?${query.toString()}`);
      const next = normalizeTickets(data);
      setTickets(next);
      if (!keepSelection && next[0]) setSelectedId(next[0].id);
      if (selectedId && !next.some((item) => item.id === selectedId)) {
        setSelectedId(next[0]?.id ?? null);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load support tickets.');
    } finally {
      setLoadingList(false);
    }
  }

  async function loadTicket(id: string, silent = false) {
    if (!silent) setLoadingTicket(true);
    try {
      const data = await request<TicketDetailData>(`/api/v1/admin/support/${id}`);
      setTicket(data.ticket ?? null);
      setMessages(data.messages ?? []);
      setAssignedTo(data.ticket?.assignedTo ?? '');
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load this support conversation.');
    } finally {
      if (!silent) setLoadingTicket(false);
    }
  }

  useEffect(() => {
    void loadTickets(false);
  }, [statusFilter, categoryFilter, priorityFilter]);

  useEffect(() => {
    if (!selectedId) {
      setTicket(null);
      setMessages([]);
      return;
    }
    void loadTicket(selectedId);
  }, [selectedId]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void loadTickets(true);
      if (selectedId) void loadTicket(selectedId, true);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [selectedId, statusFilter, categoryFilter, priorityFilter]);

  async function updateTicket(patch: Record<string, unknown>) {
    if (!selectedId) return;
    setBusy(true);
    try {
      const data = await request<TicketDetailData>(`/api/v1/admin/support/${selectedId}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      if (data.ticket) {
        setTicket(data.ticket);
        setAssignedTo(data.ticket.assignedTo ?? '');
      }
      await loadTickets(true);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to update the ticket.');
    } finally {
      setBusy(false);
    }
  }

  async function sendReply(event: FormEvent) {
    event.preventDefault();
    if (!selectedId || !draft.trim() || busy) return;
    setBusy(true);
    try {
      await request(`/api/v1/admin/support/${selectedId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ body: draft.trim() }),
      });
      setDraft('');
      await loadTicket(selectedId, true);
      await loadTickets(true);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to send the reply.');
    } finally {
      setBusy(false);
    }
  }

  async function applyAssignment() {
    if (!selectedId) return;
    await updateTicket({ assignedTo: assignedTo.trim() || null });
  }

  return (
    <div className="space-y-3">
      {error ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-nova-danger/30 bg-nova-danger/10 px-3 py-2 text-xs text-nova-danger">
          <span>{error}</span>
          <button type="button" className="nova-btn-ghost !px-2 !py-1 text-[11px]" onClick={() => setError(null)}>Dismiss</button>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <input
          className="nova-input min-w-[220px] flex-1"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search subject, email, user ID..."
        />
        <select className="nova-input !w-auto" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="">All statuses</option>
          {STATUSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
        <select className="nova-input !w-auto" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
          <option value="">All categories</option>
          {CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
        <select className="nova-input !w-auto" value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}>
          <option value="">All priorities</option>
          {PRIORITIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
        <button type="button" className="nova-btn-ghost" onClick={() => void loadTickets(true)}>Refresh</button>
      </div>

      <div className="grid min-h-[680px] gap-3 lg:grid-cols-[360px_minmax(0,1fr)]">
        <section className="overflow-hidden rounded-xl border border-nova-line bg-nova-surface">
          <div className="flex items-center justify-between border-b border-nova-line px-3 py-3">
            <div>
              <h2 className="text-sm font-bold">Customer conversations</h2>
              <p className="mt-0.5 text-[11px] nova-muted">{filteredTickets.length} visible tickets</p>
            </div>
            <span className="rounded-full border border-nova-primary/30 bg-nova-primary/10 px-2 py-1 text-[10px] text-nova-primary">LIVE</span>
          </div>
          <div className="max-h-[625px] overflow-y-auto">
            {loadingList && tickets.length === 0 ? (
              <div className="p-4 text-xs nova-muted">Loading conversations…</div>
            ) : filteredTickets.length === 0 ? (
              <div className="p-4 text-xs nova-muted">No support tickets found.</div>
            ) : (
              filteredTickets.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className={`block w-full border-b border-nova-line/70 px-3 py-3 text-start transition ${selectedId === item.id ? 'bg-nova-surface2' : 'hover:bg-nova-surface2/60'}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="min-w-0 truncate text-sm font-semibold">{item.subject}</span>
                    {item.unreadMessages > 0 ? (
                      <span className="shrink-0 rounded-full bg-nova-primary px-1.5 py-0.5 text-[9px] font-bold text-[#04140C]">{item.unreadMessages}</span>
                    ) : null}
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2 text-[10px]">
                    <span className="truncate nova-muted">{item.userEmail || item.userDisplayName || item.userId}</span>
                    <span className="shrink-0 nova-muted">{formatTime(item.lastMessageAt || item.updatedAt)}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className={`rounded-full border px-1.5 py-0.5 text-[9px] ${statusClass(item.status)}`}>{statusLabel(item.status)}</span>
                    <span className={`text-[9px] font-semibold ${priorityClass(item.priority)}`}>{priorityLabel(item.priority)}</span>
                    <span className="text-[9px] nova-muted">{categoryLabel(item.category)}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </section>

        <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-nova-line bg-nova-surface">
          {!selectedId ? (
            <div className="flex min-h-[680px] items-center justify-center p-6 text-center">
              <div>
                <div className="text-sm font-semibold">Select a conversation</div>
                <p className="mt-1 text-xs nova-muted">Choose a customer ticket to view and reply.</p>
              </div>
            </div>
          ) : loadingTicket && !ticket ? (
            <div className="p-6 text-xs nova-muted">Loading conversation…</div>
          ) : ticket ? (
            <>
              <div className="border-b border-nova-line p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-bold">{ticket.subject}</h2>
                    <p className="mt-1 text-[11px] nova-muted">
                      {ticket.userEmail || ticket.userDisplayName || ticket.userId} · {formatTime(ticket.createdAt)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      className="nova-input !w-auto !py-1.5 text-xs"
                      value={ticket.status}
                      disabled={busy}
                      onChange={(event) => void updateTicket({ status: event.target.value })}
                      aria-label="Ticket status"
                    >
                      {STATUSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                    </select>
                    <select
                      className="nova-input !w-auto !py-1.5 text-xs"
                      value={ticket.priority}
                      disabled={busy}
                      onChange={(event) => void updateTicket({ priority: event.target.value })}
                      aria-label="Ticket priority"
                    >
                      {PRIORITIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                    </select>
                    <select
                      className="nova-input !w-auto !py-1.5 text-xs"
                      value={ticket.category}
                      disabled={busy}
                      onChange={(event) => void updateTicket({ category: event.target.value })}
                      aria-label="Ticket category"
                    >
                      {CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                    </select>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <input
                    className="nova-input min-w-[250px] flex-1 !py-1.5 text-xs"
                    value={assignedTo}
                    onChange={(event) => setAssignedTo(event.target.value)}
                    placeholder="Support agent UUID (optional)"
                    aria-label="Assigned support agent"
                  />
                  <button type="button" className="nova-btn-ghost !py-1.5 text-xs" disabled={busy} onClick={() => void applyAssignment()}>
                    {assignedTo.trim() ? 'Assign' : 'Unassign'}
                  </button>
                  {ticket.assignedTo ? <span className="text-[10px] nova-muted">Assigned: {ticket.assignedTo}</span> : <span className="text-[10px] nova-muted">Unassigned</span>}
                </div>
              </div>

              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
                {messages.length === 0 ? (
                  <div className="text-xs nova-muted">No messages.</div>
                ) : (
                  messages.map((message) => (
                    <div key={message.id} className={`flex ${message.senderRole === 'support' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[78%] rounded-2xl border px-3 py-2 ${message.senderRole === 'support' ? 'border-nova-primary/30 bg-nova-primary/10' : message.senderRole === 'system' ? 'border-yellow-400/20 bg-yellow-400/5' : 'border-nova-line bg-nova-bg'}`}>
                        <div className="mb-1 text-[9px] font-semibold uppercase tracking-wide nova-muted">{message.senderRole}</div>
                        {message.body ? <div className="whitespace-pre-wrap text-sm leading-6">{message.body}</div> : null}
                        {message.attachments?.map((attachment) => {
                          const href = "/api/v1/admin/support/" + selectedId + "/attachments/" + attachment.id;
                          const isImage = attachment.mimeType.startsWith("image/");
                          return isImage ? (
                            <a key={attachment.id} href={href} target="_blank" rel="noreferrer" className="mt-2 block">
                              <img src={href} alt={attachment.originalName} className="max-h-64 max-w-full rounded-xl border border-nova-line object-contain" />
                            </a>
                          ) : (
                            <a key={attachment.id} href={href} target="_blank" rel="noreferrer" className="mt-2 block rounded-xl border border-nova-line bg-nova-bg px-3 py-2 text-xs nova-muted hover:bg-white/5">
                              {attachment.originalName} · {(attachment.sizeBytes / 1024 / 1024).toFixed(2)} MB
                            </a>
                          );
                        })}
                        <div className="mt-1 text-[9px] nova-muted">{formatTime(message.createdAt)}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <form onSubmit={sendReply} className="border-t border-nova-line p-3">
                {ticket.status === 'closed' ? (
                  <div className="rounded-xl border border-nova-line bg-nova-bg px-3 py-3 text-xs nova-muted">
                    This ticket is closed. Change the status above before replying.
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <div className="min-w-0 flex-1">
                      <textarea
                        className="nova-input min-h-[72px] w-full resize-none"
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        placeholder="Write a reply to the customer…"
                        maxLength={5000}
                      />
                      <div className="mt-2 flex items-center gap-2">
                        <label className="cursor-pointer rounded-xl border border-nova-line bg-nova-bg px-3 py-2 text-xs font-semibold nova-muted hover:bg-white/5">
                          Attach
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp,application/pdf"
                            className="hidden"
                            disabled={busy}
                            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                          />
                        </label>
                        {file ? (
                          <button type="button" onClick={() => setFile(null)} className="max-w-[70%] truncate text-xs nova-muted hover:text-white">
                            {file.name}
                          </button>
                        ) : null}
                      </div>
                    </div>
                    <button type="submit" className="nova-btn-primary self-end" disabled={busy || (!draft.trim() && !file)}>
                      {busy ? 'Sending…' : 'Reply'}
                    </button>
                  </div>
                )}
              </form>
            </>
          ) : (
            <div className="p-6 text-xs nova-muted">Ticket unavailable.</div>
          )}
        </section>
      </div>
    </div>
  );
}
