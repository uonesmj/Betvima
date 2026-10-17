'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Check, ChevronLeft, FileText, Headphones, MoreVertical, Paperclip, Send, Smile, Star, Volume2, VolumeX, X } from 'lucide-react';
import { useApp } from '@/components/layout/providers';

type Status = 'open' | 'waiting_user' | 'waiting_support' | 'resolved' | 'closed';
type Ticket = { id: string; subject: string; status: Status; createdAt: string; updatedAt: string; unreadMessages: number };
type Attachment = { id: string; originalName: string; mimeType: string; sizeBytes: number };
type Message = { id: string; senderRole: 'user' | 'support' | 'system'; body: string; createdAt: string; attachments: Attachment[] };
type Response = { ticket?: Ticket; tickets?: { items?: Ticket[] } | Ticket[]; messages?: Message[]; message?: string };
const active = (ticket: Ticket) => !['closed', 'resolved'].includes(ticket.status);
const allowed = 'image/jpeg,image/png,image/webp,application/pdf';
const emojis = ['😊', '🙂', '❤️', '👍', '🙏', '✅', '😢', '🤝', '🎉', '💙'];
const uuid = /^[a-f\d]{8}-[a-f\d]{4}-[1-8][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i;

async function supportRequest(url: string, options?: RequestInit): Promise<Response> {
  const headers = new Headers(options?.headers);
  if (!(options?.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...options, headers });
  const result = await response.json().catch(() => ({})) as Response & { data?: Response };
  if (!response.ok) throw new Error(result.message || 'Unable to contact support.');
  return result.data || result;
}

function clock(date: string, fa: boolean): string {
  const value = new Date(date);
  return Number.isNaN(value.getTime()) ? '' : value.toLocaleTimeString(fa ? 'fa-IR' : 'en-GB', { hour: '2-digit', minute: '2-digit' });
}

function sound() {
  try {
    const Audio = window.AudioContext;
    if (!Audio) return;
    const ctx = new Audio();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = 660;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.055, ctx.currentTime + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.17);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.18);
    oscillator.onended = () => { void ctx.close(); };
  } catch { /* Audio is optional and must not interrupt the chat. */ }
}

export default function SupportClient({ onClose }: { onClose?: () => void }) {
  const router = useRouter();
  const { locale } = useApp();
  const fa = locale === 'fa';
  const copy = (en: string, persian: string) => fa ? persian : en;
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [startNew, setStartNew] = useState(false);
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [menu, setMenu] = useState(false);
  const [history, setHistory] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [muted, setMuted] = useState(false);
  const [rating, setRating] = useState(0);
  const [rateOpen, setRateOpen] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [confirmEnd, setConfirmEnd] = useState(false);
  const lastSupportMessage = useRef<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const initialized = useRef(false);
  const selectedId = selected?.id;

  useEffect(() => {
    setMuted(window.localStorage.getItem('betvima:support-muted') === 'true');
  }, []);

  const getTickets = useCallback(async (initial = false) => {
    try {
      const data = await supportRequest('/api/v1/support?page=1&pageSize=100');
      const list = Array.isArray(data.tickets) ? data.tickets : data.tickets?.items || [];
      setTickets(list);
      if (initial && !initialized.current) {
        initialized.current = true;
        const requested = new URLSearchParams(window.location.search).get('ticket');
        const target = requested && uuid.test(requested) ? list.find(item => item.id === requested) : null;
        // Resuming an existing active conversation MUST NOT create a fresh ticket.
        setSelected(target || list.find(active) || list[0] || null);
      }
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load support conversations.');
    } finally { if (initial) setLoading(false); }
  }, []);

  const markVisibleReplyRead = useCallback(async (ticketId: string) => {
    if (document.visibilityState !== 'visible') return;
    try {
      const response = await fetch('/api/v1/notifications?page=1&pageSize=50&unreadOnly=true', { credentials: 'same-origin', cache: 'no-store' });
      if (!response.ok) return;
      const payload = await response.json() as { data?: { items?: { id: string; eventKey: string; data?: { ticketId?: string } }[] } };
      const ids = (payload.data?.items || []).filter(item => item.eventKey === 'support.reply' && item.data?.ticketId === ticketId).map(item => item.id);
      if (ids.length) await fetch('/api/v1/notifications', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }),
      });
    } catch { /* The chat remains usable if the notification service is offline. */ }
  }, []);

  const getMessages = useCallback(async (ticketId: string, first = false) => {
    try {
      const data = await supportRequest('/api/v1/support/' + encodeURIComponent(ticketId));
      if (data.ticket) setSelected(current => current?.id === ticketId ? data.ticket! : current);
      if (first) lastSupportMessage.current = null;
      const last = (data.messages || []).filter(item => item.senderRole === 'support').at(-1)?.id || null;
      if (!first && last && lastSupportMessage.current && last !== lastSupportMessage.current &&
          !muted && document.visibilityState === 'visible') sound();
      lastSupportMessage.current = last;
      setMessages(data.messages || []);
    } catch (err) { if (first) setError(err instanceof Error ? err.message : 'Unable to load conversation.'); }
  }, [muted]);

  useEffect(() => { void getTickets(true); }, [getTickets]);

  useEffect(() => {
    if (!selectedId || startNew) return;
    void getMessages(selectedId, true);
    void markVisibleReplyRead(selectedId);
    const poll = window.setInterval(() => {
      if (document.visibilityState === 'visible') void getMessages(selectedId);
    }, 4500);
    const markPoll = window.setInterval(() => void markVisibleReplyRead(selectedId), 12000);
    const focus = () => { void getMessages(selectedId); void markVisibleReplyRead(selectedId); };
    window.addEventListener('focus', focus);
    return () => { window.clearInterval(poll); window.clearInterval(markPoll); window.removeEventListener('focus', focus); };
  }, [selectedId, startNew, getMessages, markVisibleReplyRead]);

  useEffect(() => { bottom.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }); }, [messages.length, selectedId]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (rateOpen) setRateOpen(false);
      else if (confirmEnd) setConfirmEnd(false);
      else if (history) setHistory(false);
      else if (menu) setMenu(false);
      else leave();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  function leave() { if (onClose) onClose(); else router.push('/'); }
  function toggleSound() {
    setMuted(current => {
      window.localStorage.setItem('betvima:support-muted', String(!current));
      if (current) sound();
      return !current;
    });
    setMenu(false);
  }
  function choose(ticket: Ticket) {
    setSelected(ticket); setStartNew(false); setText(''); setFile(null); setHistory(false); setMenu(false); setError(''); setMessages([]);
    window.history.replaceState(null, '', '/support?ticket=' + ticket.id);
  }
  function validateFile(next: File | null) {
    if (next && (next.size > 10 * 1024 * 1024 || !allowed.split(',').includes(next.type))) {
      setError(copy('Only JPG, PNG, WEBP or PDF files up to 10MB are supported.', 'فقط فایل‌های JPG، PNG، WEBP و PDF تا ۱۰ مگابایت مجاز هستند.'));
      return;
    }
    setFile(next); setError('');
  }
  async function attachTo(ticketId: string, note: string, attachment: File | null) {
    const form = new FormData();
    if (note.trim()) form.set('body', note.trim());
    if (attachment) form.set('file', attachment);
    await supportRequest('/api/v1/support/' + ticketId + '/messages', { method: 'POST', body: form });
  }
  async function send() {
    if (busy || !active(selected!) || (!text.trim() && !file)) return;
    setBusy(true); setError('');
    const ticketId = selected!.id;
    try {
      await attachTo(ticketId, text, file);
      setText(''); setFile(null); setEmojiOpen(false);
      await Promise.all([getMessages(ticketId), getTickets()]);
    } catch (err) { setError(err instanceof Error ? err.message : 'Message could not be sent.'); }
    finally { setBusy(false); }
  }
  async function create() {
    if (busy || !text.trim()) return;
    setBusy(true); setError('');
    try {
      const body = name.trim() ? 'Name: ' + name.trim().slice(0, 80) + '\n\n' + text.trim() : text.trim();
      const data = await supportRequest('/api/v1/support', {
        method: 'POST', body: JSON.stringify({ subject: 'Online Support', category: 'general', body: body.slice(0, 5000) }),
      });
      if (!data.ticket) throw new Error('Conversation was not returned by support.');
      const ticket = data.ticket;
      // Switch into the existing conversation even if uploading the first attachment fails.
      setSelected(ticket); setStartNew(false); setText(''); setName(''); setMessages([]); setFile(null);
      window.history.replaceState(null, '', '/support?ticket=' + ticket.id);
      await getTickets();
      if (file) {
        try { await attachTo(ticket.id, '', file); }
        catch (err) { setError(copy('Chat started, but the attachment failed. Please attach it again.', 'گفت‌وگو ایجاد شد، اما ارسال فایل ناموفق بود؛ دوباره فایل را بفرستید.')); }
      }
      await getMessages(ticket.id, true);
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not start chat.'); }
    finally { setBusy(false); }
  }
  async function endConversation() {
    if (!selected || busy) return;
    setBusy(true); setError('');
    try {
      const data = await supportRequest('/api/v1/support/' + selected.id + '/close', { method: 'POST' });
      if (data.ticket) setSelected(data.ticket);
      setConfirmEnd(false); await getTickets();
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to end conversation.'); }
    finally { setBusy(false); }
  }
  async function sendRating() {
    if (!selected || !active(selected) || busy || rating < 1) return;
    setBusy(true); setError('');
    try {
      const body = 'Support rating: ' + rating + '/5' + (feedback.trim() ? '\n' + feedback.trim().slice(0, 500) : '');
      await attachTo(selected.id, body, null);
      setRating(0); setFeedback(''); setRateOpen(false);
      await getMessages(selected.id);
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not submit feedback.'); }
    finally { setBusy(false); }
  }

  const conversation = selected && !startNew;
  const canWrite = conversation && active(selected);
  const isIntro = !conversation;
  return (
    <div className="relative flex h-full min-h-0 w-full flex-col overflow-hidden bg-[#FAFAFB] text-[#17191E]" dir={fa ? 'rtl' : 'ltr'}>
      {isIntro ? (
        <>
          <div className="relative shrink-0 bg-gradient-to-br from-[#516A83] to-[#273C50] px-6 pb-7 pt-[max(32px,env(safe-area-inset-top))] text-white sm:px-10">
            <div className="flex items-start justify-between gap-4">
              <div><h2 className="text-[24px] font-semibold">•{copy('Online Support','پشتیبانی آنلاین')}•</h2>
                <p className="mt-5 max-w-[500px] text-[15px] leading-6">{copy('We are ready to help you 24/7. Please enter your contact information and your question.', 'در تمام ساعات شبانه‌روز پاسخگوی شما هستیم. نام و پیام خود را وارد کنید.')}</p>
              </div>
              <button type="button" onClick={leave} aria-label={copy('Close chat','بستن چت')} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#1D3247]/60 text-white"><X size={24}/></button>
            </div>
          </div>
          <div className="relative -mt-3 flex min-h-0 flex-1 flex-col rounded-t-[34px] bg-[#FAFAFB] px-6 pb-6 pt-7 sm:px-10">
            {loading ? <p className="text-sm text-[#87909D]">{copy('Loading conversations...', 'در حال بارگذاری گفتگوها...')}</p> : null}
            {tickets.some(active) && <button type="button" onClick={() => { setStartNew(false); setSelected(tickets.find(active) || null); }} className="mb-4 self-start text-sm font-semibold text-[#087FF5]">{copy('Continue your previous chat', 'ادامه گفت‌وگوی قبلی')}</button>}
            <input aria-label={copy('Your name (optional)','نام شما (اختیاری)')} value={name} onChange={e => setName(e.target.value)} maxLength={80} placeholder={copy('Your name (optional)','نام شما (اختیاری)')} className="h-[74px] shrink-0 rounded-[20px] bg-[#F0F0F0] px-6 text-[17px] outline-none focus:ring-2 focus:ring-[#80B8FA]"/>
            <div className="mt-4 flex min-h-[74px] items-center gap-2 rounded-[20px] bg-[#F0F0F0] px-5">
              <input value={text} onChange={e => setText(e.target.value)} maxLength={4800} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void create(); } }} placeholder={copy('Message','پیام')} aria-label={copy('Message','پیام')} className="min-w-0 flex-1 bg-transparent text-[17px] outline-none"/>
              <button type="button" onClick={() => fileInput.current?.click()} aria-label={copy('Attach a file','پیوست فایل')} className="text-[#747983]"><Paperclip size={23}/></button>
              <button type="button" onClick={() => setEmojiOpen(v => !v)} aria-label={copy('Choose emoji','انتخاب شکلک')} className="text-[#747983]"><Smile size={23}/></button>
            </div>
            {file && <button type="button" onClick={() => setFile(null)} className="mt-2 self-start text-xs text-[#087FF5]">{file.name} ×</button>}
            {emojiOpen && <div className="mt-2 flex flex-wrap gap-2 rounded-xl bg-white p-3">{emojis.map(emoji => <button key={emoji} type="button" onClick={() => { setText(v => v + emoji); setEmojiOpen(false); }} className="text-xl">{emoji}</button>)}</div>}
            <button type="button" onClick={() => void create()} disabled={busy || !text.trim()} className="mt-6 min-h-[62px] shrink-0 rounded-[18px] bg-[#80B7FA] text-[17px] font-semibold text-white disabled:opacity-50">{busy ? copy('Starting...', 'در حال شروع...') : copy('Start chat','شروع گفت‌وگو')}</button>
            {tickets.length > 0 && <button type="button" onClick={() => setHistory(true)} className="mt-5 text-sm text-[#6B7889] underline">{copy('Previous conversations','گفت‌وگوهای قبلی')}</button>}
            {error && <p role="alert" className="mt-4 text-sm text-red-600">{error}</p>}
          </div>
        </>
      ) : (
        <>
          <header className="flex min-h-[104px] shrink-0 items-center gap-3 border-b border-[#EEEEF0] bg-[#FAFAFB] px-5 pt-[env(safe-area-inset-top)] sm:px-8">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-tr from-[#1464D7] to-[#82B9FC] text-sm font-black text-white">BV</span>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-[20px] font-semibold">{copy('BetVima Support','پشتیبانی بت‌ویما')}</h2>
              <p className="text-[13px] text-black">•{copy('Online Support', 'پشتیبانی آنلاین')}•</p>
            </div>
            <button type="button" aria-label={copy('Chat options','تنظیمات چت')} aria-expanded={menu} onClick={() => setMenu(v => !v)} className="grid h-10 w-9 place-items-center"><MoreVertical size={23}/></button>
            <button type="button" aria-label={copy('Close chat','بستن چت')} onClick={leave} className="grid h-10 w-10 place-items-center"><X size={25}/></button>
          </header>
          {menu && <div className="absolute right-5 top-[98px] z-30 w-[min(340px,calc(100%-40px))] rounded-2xl bg-white p-2 shadow-[0_8px_28px_rgba(0,0,0,.15)]" dir={fa ? 'rtl' : 'ltr'}>
            <button type="button" onClick={toggleSound} className="flex min-h-12 w-full items-center gap-4 rounded-xl px-3 text-left hover:bg-[#F2F3F6]">{muted ? <VolumeX size={20}/> : <Volume2 size={20}/>}<span>{muted ? copy('Switch on sound','فعال کردن صدا') : copy('Switch off sound','خاموش کردن صدا')}</span></button>
            <button type="button" onClick={() => { setMenu(false); setRateOpen(true); }} disabled={!canWrite} className="flex min-h-12 w-full items-center gap-4 rounded-xl px-3 text-left hover:bg-[#F2F3F6] disabled:opacity-40"><Star size={20}/><span>{copy('Rate the manager','امتیاز به پشتیبان')}</span></button>
            <button type="button" onClick={() => { setMenu(false); setHistory(true); }} className="flex min-h-12 w-full items-center gap-4 rounded-xl px-3 text-left hover:bg-[#F2F3F6]"><Bell size={20}/><span>{copy('Previous conversations','گفت‌وگوهای قبلی')}</span></button>
            {canWrite && <button type="button" onClick={() => { setMenu(false); setConfirmEnd(true); }} className="flex min-h-12 w-full items-center gap-4 rounded-xl px-3 text-left text-red-600 hover:bg-red-50"><X size={20}/><span>{copy('End conversation','پایان گفت‌وگو')}</span></button>}
          </div>}
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-5 sm:px-8" onClick={() => menu && setMenu(false)}>
            <div className="mx-auto w-fit rounded-full bg-[#EEEFF2] px-4 py-2 text-xs text-[#696E7D]">{clock(selected.createdAt, fa)}</div>
            {messages.map(message => {
              const mine = message.senderRole === 'user';
              return <div key={message.id} className={'flex ' + (mine ? 'justify-end' : 'justify-start')}>
                <div className={'relative max-w-[83%] rounded-[22px] px-5 py-3 text-[16px] leading-6 shadow-sm sm:max-w-[65%] ' + (mine ? 'rounded-br-[5px] bg-[#087FF5] text-white' : 'rounded-bl-[5px] bg-[#EEEEEF] text-[#191A1C]')}>
                  {message.body && <div className="whitespace-pre-wrap break-words" dir="auto">{message.body}</div>}
                  {(message.attachments || []).map(attachment => {
                    const url = '/api/v1/support/' + selected.id + '/attachments/' + attachment.id;
                    return <a key={attachment.id} href={url} target="_blank" rel="noopener noreferrer" className={'mt-2 flex items-center gap-2 break-all rounded-xl px-2 py-2 text-xs underline ' + (mine ? 'bg-white/10' : 'bg-white/70')}><FileText size={16}/>{attachment.originalName}</a>;
                  })}
                  <div className={'mt-1 flex items-center justify-end gap-1 text-[11px] ' + (mine ? 'text-blue-100' : 'text-[#737780]')}>{mine && <Check size={13}/>}<span>{clock(message.createdAt, fa)}</span></div>
                </div>
              </div>;
            })}
            {messages.length === 0 && <p className="mt-8 text-center text-sm text-[#9EA2AA]">{copy('Your conversation will appear here.','پیام‌های شما اینجا نمایش داده می‌شوند.')}</p>}
            <div ref={bottom}/>
          </div>
          {error && <p role="alert" className="shrink-0 px-6 py-2 text-sm text-red-600">{error}</p>}
          {canWrite ? <div className="shrink-0 bg-[#FAFAFB] px-4 pb-[max(18px,env(safe-area-inset-bottom))] pt-2 sm:px-7">
            {file && <button type="button" onClick={() => setFile(null)} className="mb-2 max-w-full truncate rounded-full bg-[#EAF2FF] px-3 py-2 text-xs text-[#1461B6]">{file.name} ×</button>}
            {emojiOpen && <div className="mb-2 flex flex-wrap gap-2 rounded-xl bg-white p-3 shadow-md">{emojis.map(emoji => <button key={emoji} type="button" onClick={() => { setText(v => v + emoji); setEmojiOpen(false); }} className="text-xl">{emoji}</button>)}</div>}
            <div className="flex items-center gap-3">
              <div className="flex min-h-[60px] min-w-0 flex-1 items-center gap-2 rounded-[18px] bg-[#F0F0F1] px-4 focus-within:ring-2 focus-within:ring-[#8BBEFC]">
                <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }} maxLength={5000} placeholder={copy('Text...', 'پیام...')} aria-label={copy('Write a message','نوشتن پیام')} className="min-w-0 flex-1 bg-transparent text-[16px] outline-none"/>
                <button type="button" onClick={() => fileInput.current?.click()} aria-label={copy('Attach a file','پیوست فایل')} className="text-[#747983]"><Paperclip size={23}/></button>
                <button type="button" onClick={() => setEmojiOpen(v => !v)} aria-label={copy('Choose emoji','انتخاب شکلک')} className="text-[#747983]"><Smile size={23}/></button>
              </div>
              <button type="button" onClick={() => void send()} disabled={busy || (!text.trim() && !file)} aria-label={copy('Send message','ارسال پیام')} className="grid h-[60px] w-[64px] shrink-0 place-items-center rounded-[18px] bg-[#80B7FA] text-white disabled:opacity-50"><Send size={25}/></button>
            </div>
          </div> : <div className="shrink-0 px-5 pb-7 pt-4 text-center text-sm text-[#7A8292]">{copy('This conversation has ended.', 'این گفت‌وگو پایان یافته است.')} <button type="button" className="font-bold text-[#087FF5]" onClick={() => { setStartNew(true); setSelected(null); }}>{copy('Start a new chat','شروع گفت‌وگوی جدید')}</button></div>}
        </>
      )}
      <input ref={fileInput} type="file" accept={allowed} className="hidden" onChange={e => { validateFile(e.target.files?.[0] || null); e.target.value = ''; }}/>
      {history && <div className="absolute inset-0 z-40 flex flex-col bg-white">
        <div className="flex items-center gap-4 border-b border-[#ECEEF0] px-5 py-6"><button type="button" onClick={() => setHistory(false)} aria-label={copy('Back','بازگشت')}><ChevronLeft size={25}/></button><h3 className="text-xl font-bold">{copy('Your conversations','گفت‌وگوهای شما')}</h3></div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{tickets.map(ticket => <button type="button" key={ticket.id} onClick={() => choose(ticket)} className="mb-2 flex w-full items-center justify-between gap-2 rounded-xl border border-[#ECEEF2] px-4 py-4 text-left"><span><span className="block text-sm font-semibold">{ticket.subject}</span><span className="text-xs text-[#818792]">{clock(ticket.updatedAt,fa)} · {active(ticket) ? copy('Active','فعال') : copy('Ended','پایان‌یافته')}</span></span>{ticket.id === selectedId && <Check className="text-[#087FF5]"/>}</button>)}</div>
        <button type="button" onClick={() => { setHistory(false); setStartNew(true); setSelected(null); setText(''); }} className="m-5 rounded-xl bg-[#80B7FA] px-4 py-4 font-bold text-white">{copy('New conversation','گفت‌وگوی جدید')}</button>
      </div>}
      {rateOpen && <div className="absolute inset-0 z-50 grid place-items-center bg-black/30 p-5"><div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
        <h3 className="text-lg font-bold">{copy('Rate the support manager','امتیاز به پشتیبان')}</h3>
        <div className="mt-5 flex justify-center gap-3">{[1,2,3,4,5].map(number => <button key={number} type="button" aria-label={number + ' stars'} onClick={() => setRating(number)}><Star size={36} className={number <= rating ? 'fill-[#F4BA43] text-[#F4BA43]' : 'text-[#BCC3CC]'}/></button>)}</div>
        <textarea value={feedback} onChange={e => setFeedback(e.target.value)} maxLength={500} rows={3} placeholder={copy('Feedback (optional)','نظر شما (اختیاری)')} className="mt-5 w-full rounded-xl border border-[#DDD] p-3 text-sm outline-none"/>
        <div className="mt-5 flex gap-2"><button type="button" onClick={() => setRateOpen(false)} className="flex-1 rounded-xl border p-3">{copy('Cancel','انصراف')}</button><button type="button" disabled={busy || rating < 1} onClick={() => void sendRating()} className="flex-1 rounded-xl bg-[#80B7FA] p-3 font-bold text-white disabled:opacity-40">{copy('Submit','ثبت')}</button></div>
      </div></div>}
      {confirmEnd && <div className="absolute inset-0 z-50 grid place-items-center bg-black/30 p-5"><div className="w-full max-w-sm rounded-3xl bg-white p-6">
        <h3 className="text-lg font-bold">{copy('End this conversation?','پایان گفت‌وگو؟')}</h3><p className="mt-2 text-sm text-[#7B8190]">{copy('Closing the window never ends your ticket. End the conversation only when your issue is resolved.', 'بستن پنجره تیکت را پایان نمی‌دهد؛ فقط وقتی مشکلتان حل شد گفت‌وگو را پایان دهید.')}</p>
        <div className="mt-5 flex gap-2"><button type="button" onClick={() => setConfirmEnd(false)} className="flex-1 rounded-xl border p-3">{copy('Keep chatting','ادامه چت')}</button><button type="button" onClick={() => void endConversation()} disabled={busy} className="flex-1 rounded-xl bg-red-600 p-3 font-bold text-white">{copy('End chat','پایان چت')}</button></div>
      </div></div>}
    </div>
  );
}
