'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

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
  userNumericId: number | null;
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
  if (status === 'waiting_user') return 'border-blue-400/30 bg-blue-400/10 text-blue-700';
  if (status === 'resolved') return 'border-yellow-400/30 bg-yellow-400/10 text-amber-700';
  if (status === 'closed') return 'border-nova-line bg-nova-surface2 text-[#6E7C91]';
  return 'border-nova-line bg-nova-surface2 text-nova-text';
}

function priorityClass(priority: Priority) {
  if (priority === 'urgent') return 'text-nova-danger';
  if (priority === 'high') return 'text-amber-700';
  if (priority === 'low') return 'text-[#6E7C91]';
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
  const [matchingUsers, setMatchingUsers] = useState<{ id: string; numericId: number; email: string | null; username: string | null }[]>([]);
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
        item.userNumericId?.toString() ?? '',
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
      if (search.trim()) query.set('search', search.trim());
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

  // Support agents can resolve any existing player by their public-facing
  // numeric account number or email, including users who have no open ticket.
  // Access still passes the server-side users.view permission check.
  useEffect(() => {
    const q = search.trim();
    if (q.length < 3) { setMatchingUsers([]); return; }
    let active = true;
    const timer = window.setTimeout(async () => {
      try {
        const matches = await request<{ items: { id: string; numericId: number; email: string | null; username: string | null }[] }>(
          `/api/v1/admin/users?role=user,affiliate&pageSize=10&q=${encodeURIComponent(q)}`);
        if (active) setMatchingUsers(matches.items ?? []);
      } catch {
        if (active) setMatchingUsers([]);
      }
    }, 350);
    return () => { active = false; window.clearTimeout(timer); };
  }, [search]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadTickets(true); }, 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  async function loadTicket(id: string, silent = false) {
    if (!silent) setLoadingTicket(true);
    try {
      const data = await request<TicketDetailData>(`/api/v1/admin/support/${id}`);
      setTicket(data.ticket ?? null);
      setMessages(data.messages ?? []);
      if (document.visibilityState === 'visible') {
        void request(`/api/v1/admin/support/${id}/read`, { method: 'POST' }).catch(() => {});
      }
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
    const heartbeat = () => {
      if (document.visibilityState === 'visible')
        void request('/api/v1/admin/support/presence', { method: 'POST' }).catch(() => {});
    };
    heartbeat();
    const timer = window.setInterval(heartbeat, 20000);
    document.addEventListener('visibilitychange', heartbeat);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', heartbeat); };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void loadTickets(true);
      if (selectedId) void loadTicket(selectedId, true);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [selectedId, statusFilter, categoryFilter, priorityFilter, search]);

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
      const result = await request<{ notificationQueued?: boolean }>(`/api/v1/admin/support/${selectedId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ body: draft.trim() }),
      });
      setDraft('');
      await loadTicket(selectedId, true);
      await loadTickets(true);
      setError(result.notificationQueued === false
        ? 'Reply sent, but the customer notification could not be queued. Check the notification service.'
        : null);
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
    <div className="min-w-0 space-y-3 text-[#27364A]">
      {error ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-nova-danger/30 bg-nova-danger/10 px-3 py-2 text-xs text-nova-danger">
          <span>{error}</span>
          <button type="button" className="nova-btn-ghost !px-2 !py-1 text-[11px]" onClick={() => setError(null)}>Dismiss</button>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <input
          className="nova-input min-w-0 flex-[1_1_220px]"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="جست‌وجو با شناسه عددی (مثل 1100) یا ایمیل..."
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
      {search.trim().length >= 3 && matchingUsers.length > 0 ? (
        <div className="rounded-xl border border-nova-primary/30 bg-[#F4FAFF] p-3">
          <p className="mb-2 text-xs font-semibold">نتیجه جست‌وجوی کاربران — ورود به پرونده</p>
          <div className="flex flex-wrap gap-2">
            {matchingUsers.map((user) => (
              <Link key={user.id} href={`/admin/users/${user.id}`}
                className="rounded-lg border border-[#D6E3F6] bg-white px-3 py-2 text-xs hover:bg-[#EAF2FF]">
                <strong dir="ltr">ID {user.numericId}</strong> · {user.email || user.username || 'کاربر'}
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid min-w-0 grid-cols-1 items-start gap-3 xl:min-h-[620px] xl:grid-cols-[minmax(260px,325px)_minmax(0,1fr)]">
        <section className={`${selectedId ? 'hidden xl:block' : 'block'} min-w-0 overflow-hidden rounded-xl border border-[#DEE6F0] bg-[#FFFFFF]`}>
          <div className="flex items-center justify-between border-b border-nova-line px-3 py-3">
            <div>
              <h2 className="text-sm font-bold">Customer conversations</h2>
              <p className="mt-0.5 text-[11px] text-[#6E7C91]">{filteredTickets.length} visible tickets</p>
            </div>
            <span className="rounded-full border border-nova-primary/30 bg-nova-primary/10 px-2 py-1 text-[10px] text-nova-primary">LIVE</span>
          </div>
          <div className="max-h-[min(70dvh,620px)] overflow-y-auto overscroll-contain xl:max-h-[750px]">
            {loadingList && tickets.length === 0 ? (
              <div className="p-4 text-xs text-[#6E7C91]">Loading conversations…</div>
            ) : filteredTickets.length === 0 ? (
              <div className="p-4 text-xs text-[#6E7C91]">No support tickets found.</div>
            ) : (
              filteredTickets.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className={`block w-full border-b border-[#DEE6F0] px-3 py-3 text-start text-[#243247] transition ${selectedId === item.id ? 'bg-[#EAF2FF]' : 'hover:bg-[#F1F6FD]'}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="min-w-0 truncate text-sm font-semibold">{item.subject}</span>
                    {item.unreadMessages > 0 ? (
                      <span className="shrink-0 rounded-full bg-nova-primary px-1.5 py-0.5 text-[9px] font-bold text-[#04140C]">{item.unreadMessages}</span>
                    ) : null}
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2 text-[10px]">
                    <span className="truncate text-[#6E7C91]">{item.userNumericId != null ? `ID ${item.userNumericId}` : 'شناسه نامشخص'} · {item.userEmail || item.userDisplayName || '—'}</span>
                    <span className="shrink-0 text-[#6E7C91]">{formatTime(item.lastMessageAt || item.updatedAt)}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className={`rounded-full border px-1.5 py-0.5 text-[9px] ${statusClass(item.status)}`}>{statusLabel(item.status)}</span>
                    <span className={`text-[9px] font-semibold ${priorityClass(item.priority)}`}>{priorityLabel(item.priority)}</span>
                    <span className="text-[9px] text-[#6E7C91]">{categoryLabel(item.category)}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </section>

        <section className={`${selectedId ? 'flex' : 'hidden xl:flex'} min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-[#DEE6F0] bg-[#FFFFFF]`}>
          {!selectedId ? (
            <div className="flex min-h-[320px] items-center justify-center p-6 text-center xl:min-h-[640px]">
              <div>
                <div className="text-sm font-semibold">Select a conversation</div>
                <p className="mt-1 text-xs text-[#6E7C91]">Choose a customer ticket to view and reply.</p>
              </div>
            </div>
          ) : loadingTicket && !ticket ? (
            <div className="p-6 text-xs text-[#6E7C91]">Loading conversation…</div>
          ) : ticket ? (
            <>
              <button type="button" className="flex items-center gap-2 border-b border-[#DEE6F1] bg-[#F4F8FE] px-4 py-3 text-left text-xs font-semibold text-[#2563EB] xl:hidden" onClick={() => setSelectedId(null)}>
                <span aria-hidden="true">←</span> Back to conversations
              </button>
              <div className="border-b border-nova-line p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 data-i18n-ignore className="truncate text-base font-bold">{ticket.subject}</h2>
                    <p className="mt-1 text-[11px] text-[#6E7C91]">
                      {ticket.userNumericId != null ? `ID ${ticket.userNumericId}` : 'شناسه نامشخص'} · {ticket.userEmail || ticket.userDisplayName || '—'} · {formatTime(ticket.createdAt)}
                    </p>
                  </div>
                  <div className="mt-2">
                    <Link href={`/admin/users/${ticket.userId}`} className="text-xs font-semibold text-[#2563EB] underline">
                      مشاهده پرونده کاربر {ticket.userNumericId != null ? ticket.userNumericId : ''}
                    </Link>
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
                    className="nova-input min-w-0 flex-1 !py-1.5 text-xs"
                    value={assignedTo}
                    onChange={(event) => setAssignedTo(event.target.value)}
                    placeholder="Support agent UUID (optional)"
                    aria-label="Assigned support agent"
                  />
                  <button type="button" className="nova-btn-ghost !py-1.5 text-xs" disabled={busy} onClick={() => void applyAssignment()}>
                    {assignedTo.trim() ? 'Assign' : 'Unassign'}
                  </button>
                  {ticket.assignedTo ? <span className="text-[10px] text-[#6E7C91]">Assigned: {ticket.assignedTo}</span> : <span className="text-[10px] text-[#6E7C91]">Unassigned</span>}
                </div>
              </div>

              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
                {messages.length === 0 ? (
                  <div className="text-xs text-[#6E7C91]">No messages.</div>
                ) : (
                  messages.map((message) => (
                    <div key={message.id} className={`flex ${message.senderRole === 'support' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[78%] rounded-2xl border px-3 py-2 ${message.senderRole === 'support' ? 'border-nova-primary/30 bg-nova-primary/10' : message.senderRole === 'system' ? 'border-yellow-400/20 bg-yellow-400/5' : 'border-nova-line bg-nova-bg'}`}>
                        <div className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-[#6E7C91]">{message.senderRole}</div>
                        {message.body ? <div data-i18n-ignore className="whitespace-pre-wrap text-sm leading-6">{message.body}</div> : null}
                        {message.attachments?.map((attachment) => {
                          const href = "/api/v1/admin/support/" + selectedId + "/attachments/" + attachment.id;
                          const isImage = attachment.mimeType.startsWith("image/");
                          return isImage ? (
                            <a key={attachment.id} href={href} target="_blank" rel="noreferrer" className="mt-2 block">
                              <img src={href} alt={attachment.originalName} className="max-h-64 max-w-full rounded-xl border border-nova-line object-contain" />
                            </a>
                          ) : (
                            <a key={attachment.id} href={href} target="_blank" rel="noreferrer" className="mt-2 block rounded-xl border border-nova-line bg-nova-bg px-3 py-2 text-xs text-[#6E7C91] hover:bg-[#EAF2FF]">
                              {attachment.originalName} · {(attachment.sizeBytes / 1024 / 1024).toFixed(2)} MB
                            </a>
                          );
                        })}
                        <div className="mt-1 flex items-center justify-end gap-1 text-[9px] text-[#6E7C91]">{message.senderRole === 'support' ? (message.readAt ? '✓✓ Read' : '✓ Sent') : null} {formatTime(message.createdAt)}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <form onSubmit={sendReply} className="border-t border-nova-line p-3">
                {ticket.status === 'closed' ? (
                  <div className="rounded-xl border border-nova-line bg-nova-bg px-3 py-3 text-xs text-[#6E7C91]">
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
                        <label className="cursor-pointer rounded-xl border border-nova-line bg-nova-bg px-3 py-2 text-xs font-semibold text-[#6E7C91] hover:bg-[#EAF2FF]">
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
                          <button type="button" onClick={() => setFile(null)} className="max-w-[70%] truncate text-xs text-[#6E7C91] hover:text-[#1F55B5]">
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
            <div className="p-6 text-xs text-[#6E7C91]">Ticket unavailable.</div>
          )}
        </section>
      </div>
    </div>
  );
}
