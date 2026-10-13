"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Status = "open" | "waiting_user" | "waiting_support" | "resolved" | "closed";
type Category = "deposit" | "withdrawal" | "bet" | "login" | "bonus" | "technical" | "other" | "general";
type Ticket = { id: string; subject: string; category: Category; priority: string; status: Status; createdAt: string; updatedAt: string; lastMessageAt: string | null; unreadMessages: number };
type Attachment = { id: string; ticketId: string; messageId: string; uploaderId: string | null; uploaderRole: "user" | "support"; bucketId: string; storagePath: string; originalName: string; mimeType: string; sizeBytes: number; createdAt: string };
type Message = { id: string; ticketId: string; senderId: string | null; senderRole: "user" | "support" | "system"; body: string; createdAt: string; attachments: Attachment[] };
type Data = { ticket?: Ticket; tickets?: { items?: Ticket[] } | Ticket[]; messages?: Message[]; message?: string };

const categories: { value: Category; label: string }[] = [
{ value: "general", label: "General" },
{ value: "deposit", label: "Deposit" },
{ value: "withdrawal", label: "Withdrawal" },
{ value: "bet", label: "Betting" },
{ value: "login", label: "Login" },
{ value: "bonus", label: "Bonus" },
{ value: "technical", label: "Technical" },
{ value: "other", label: "Other" },
];

const labels: Record<Status, string> = { open: "Open", waiting_user: "Pending your response", waiting_support: "Pending Support", resolved: "Resolved", closed: "Closed" };

async function request(url: string, options?: RequestInit): Promise<Data> {
  const headers = new Headers(options?.headers);
  if (!(options?.body instanceof FormData)) headers.set("Content-Type", "application/json");
  const response = await fetch(url, { credentials: "same-origin", cache: "no-store", ...options, headers });
  const payload = (await response.json().catch(() => ({}))) as Data & { data?: Data; message?: string };
  if (response.status < 200 || response.status >= 300) throw new Error(payload.message || "Support request failed.");
  return payload.data ?? payload;
}

export default function SupportClient() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState<Category>("general");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const loadTickets = useCallback(async () => {
    try {
      const data = await request("/api/v1/support");
      const list = Array.isArray(data.tickets) ? data.tickets : data.tickets?.items || [];
      setTickets(list);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to load support.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMessages = useCallback(async (id: string) => {
    try {
      const data = await request("/api/v1/support/" + id);
      setMessages(data.messages || []);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to load conversation.");
    }
  }, []);

  useEffect(() => { loadTickets(); }, [loadTickets]);
  useEffect(() => {
    if (!selected) return;
    loadMessages(selected.id);
    const timer = window.setInterval(() => loadMessages(selected.id), 3000);
    return () => window.clearInterval(timer);
  }, [selected, loadMessages]);

  async function createTicket() {
    if (busy || subject.trim().length < 3 || text.trim().length < 1) return;
    setBusy(true); setError("");
    try {
      const data = await request("/api/v1/support", { method: "POST", body: JSON.stringify({ subject: subject.trim(), category, body: text.trim() }) });
      setSubject(""); setText("");
      await loadTickets();
      if (data.ticket) { setSelected(data.ticket); setMessages([]); }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to create conversation.");
    } finally {
      setBusy(false);
    }
  }

  async function sendMessage() {
    if (!selected || busy || selected.status === "closed" || (!text.trim() && !file)) return;
    if (file && file.size > 10 * 1024 * 1024) {
      setError("File must be 10MB or smaller.");
      return;
    }
    setBusy(true); setError("");
    try {
      const form = new FormData();
      if (text.trim()) form.append("body", text.trim());
      if (file) form.append("file", file);
      await request("/api/v1/support/" + selected.id + "/messages", { method: "POST", body: form });
      setText("");
      setFile(null);
      await loadMessages(selected.id);
      await loadTickets();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to send message.");
    } finally {
      setBusy(false);
    }
  }

  async function closeTicket() {
    if (!selected || busy || selected.status === "closed") return;
    setBusy(true);
    try {
      const data = await request("/api/v1/support/" + selected.id + "/close", { method: "POST" });
      if (data.ticket) setSelected(data.ticket);
      await loadTickets();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to close conversation.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-emerald-400/20 bg-[#07110f] p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-400">NOVA SUPPORT</p>
            <h2 className="mt-1 text-2xl font-black text-white">24/7 Live Chat</h2>
            <p className="mt-1 text-sm text-slate-400">Chat with the BetVima support team.</p>
          </div>
          <span className="rounded-full bg-emerald-400/10 px-3 py-2 text-xs font-bold text-emerald-300">ONLINE</span>
        </div>
      </section>
      {error ? <div className="rounded-2xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-300">{error}</div> : null}
      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        <aside className="space-y-4">
          <div className="rounded-3xl border border-white/10 bg-[#0b1118] p-4">
            <h3 className="mb-3 font-bold text-white">Start a new chat</h3>
            <input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Subject" className="mb-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-white outline-none" />
            <select value={category} onChange={(event) => setCategory(event.target.value as Category)} className="mb-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-white outline-none">
{categories.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
</select>
            <textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="How can we help?" rows={4} className="mb-3 w-full resize-none rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-white outline-none" />
            <button type="button" onClick={createTicket} disabled={busy} className="w-full rounded-xl bg-emerald-400 px-4 py-3 text-sm font-black text-black disabled:opacity-40">Start chat</button>
          </div>
          <div className="rounded-3xl border border-white/10 bg-[#0b1118] p-3">
            <p className="mb-2 px-2 text-xs font-bold uppercase tracking-wider text-slate-500">Your conversations</p>
            {loading ? <p className="p-3 text-sm text-slate-500">Loading...</p> : tickets.length === 0 ? <p className="p-3 text-sm text-slate-500">No conversations yet.</p> : tickets.map((ticket) => <button type="button" key={ticket.id} onClick={() => setSelected(ticket)} className={"mb-1 w-full rounded-2xl border p-3 text-left " + (selected?.id === ticket.id ? "border-emerald-400/20 bg-emerald-400/10" : "border-transparent hover:bg-white/5")}><div className="truncate text-sm font-bold text-white">{ticket.subject}</div><div className="mt-1 text-xs text-slate-500">{labels[ticket.status]}</div></button>)}
          </div>
        </aside>
        <main className="flex min-h-[520px] flex-col rounded-3xl border border-white/10 bg-[#0b1118]">
          {!selected ? <div className="flex flex-1 flex-col items-center justify-center p-8 text-center"><h3 className="text-lg font-bold text-white">Your support chat</h3><p className="mt-2 text-sm text-slate-500">Start a conversation with NOVA support.</p><Link href="/help" className="mt-4 text-sm font-bold text-emerald-400">Help Centre</Link></div> : <><header className="flex items-center justify-between border-b border-white/10 p-4"><div><h3 className="font-bold text-white">{selected.subject}</h3><p className="mt-1 text-xs text-slate-500">{labels[selected.status]}</p></div>{selected.status !== "closed" ? <button type="button" onClick={closeTicket} disabled={busy} className="rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-slate-300">Close</button> : null}</header><div className="flex-1 space-y-3 overflow-y-auto p-4">{messages.length === 0 ? <p className="py-12 text-center text-sm text-slate-500">No messages yet.</p> : messages.map((message) => <div key={message.id} className={"flex " + (message.senderRole === "user" ? "justify-end" : "justify-start")}><div className={"max-w-[80%] rounded-2xl px-4 py-3 text-sm " + (message.senderRole === "user" ? "bg-emerald-400 text-black" : "bg-[#151d27] text-slate-200")}>{message.body ? <div data-i18n-ignore>{message.body}</div> : null}{message.attachments?.map((attachment) => { const href = "/api/v1/support/" + selected.id + "/attachments/" + attachment.id; const isImage = attachment.mimeType.startsWith("image/"); return isImage ? <a key={attachment.id} href={href} target="_blank" rel="noreferrer" className="mt-2 block"><img src={href} alt={attachment.originalName} className="max-h-64 max-w-full rounded-xl border border-white/10 object-contain" /></a> : <a key={attachment.id} href={href} target="_blank" rel="noreferrer" className="mt-2 block rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/80 hover:bg-white/5">{attachment.originalName} · {(attachment.sizeBytes / 1024 / 1024).toFixed(2)} MB</a>; })}</div></div>)}</div>{selected.status === "closed" ? <div className="border-t border-white/10 p-4 text-center text-sm text-slate-500">This conversation is closed.</div> : <div className="border-t border-white/10 p-4"><div className="mb-2 flex items-center gap-2"><label className="cursor-pointer rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs font-bold text-white/80 hover:bg-white/5">Attach<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" disabled={busy} onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label>{file ? <button type="button" onClick={() => setFile(null)} className="max-w-[70%] truncate text-xs text-white/60 hover:text-white">{file.name}</button> : null}</div><div className="flex gap-2"><input value={text} onChange={(event) => setText(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); sendMessage(); } }} placeholder="Write a message..." className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-white outline-none" /><button type="button" onClick={sendMessage} disabled={busy || (!text.trim() && !file)} className="rounded-xl bg-emerald-400 px-5 py-3 text-sm font-black text-black disabled:opacity-40">Send</button></div></div>}</>}
        </main>
      </div>
    </div>
  );
}
