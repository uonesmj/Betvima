'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Archive, Bell, CalendarClock, Check, CheckCircle2, Copy, Eye, Plus, RefreshCw, Send, Users, X } from 'lucide-react';
import { apiRequest } from '@/lib/hooks/useApi';

type Audience = 'general' | 'personal';
type Mode = 'send' | 'schedule' | 'draft';
type Campaign = {
  id: string; title: string; body: string; audience: Audience; target_user_id: string | null;
  action_label: string | null; action_path: string | null; locale: 'fa' | 'en';
  status: 'draft' | 'sent' | 'scheduled' | 'archived';
  scheduled_at: string | null; created_at: string; delivered: string | number;
  read_count: string | number;
};
type Fields = {
  title: string; body: string; audience: Audience; targetUserId: string;
  ctaLabel: string; ctaHref: string; locale: 'fa'|'en'; scheduledAt: string;
};
const initial: Fields = {
  title: '', body: '', audience: 'general', targetUserId: '',
  ctaLabel: '', ctaHref: '', locale: 'fa', scheduledAt: '',
};
const baseInput = 'mt-1.5 w-full rounded-xl border border-[#D8E0E8] bg-white px-3.5 py-3 text-sm text-[#142433] outline-none transition focus:border-[#087CF5] focus:ring-2 focus:ring-blue-200';
const surface = 'rounded-[20px] border border-[#E6EBF0] bg-white p-5 shadow-[0_8px_25px_rgba(19,39,65,.045)]';

function when(date: string | null): string {
  if (!date) return '—';
  const value = new Date(date);
  return Number.isNaN(value.getTime()) ? '—' :
    new Intl.DateTimeFormat('en-GB', { dateStyle:'medium', timeStyle:'short' }).format(value);
}

export function NotificationsAdminClient() {
  const [form, setForm] = useState<Fields>(initial);
  const [mode, setMode] = useState<Mode>('send');
  const [items, setItems] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [confirming, setConfirming] = useState(false);

  const load = useCallback(async () => {
    try {
      const query = new URLSearchParams();
      if (search.trim()) query.set('search', search.trim());
      if (filter) query.set('status', filter);
      const data = await apiRequest<{ items: Campaign[] }>(`/api/v1/admin/notifications?${query}`);
      setItems(data.items || []);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load notifications');
    } finally { setLoading(false); }
  }, [search,filter]);

  useEffect(() => { void load(); }, [load]);

  const metrics = useMemo(() => {
    const sent = items.filter(x => x.status === 'sent' || x.status === 'scheduled');
    const delivered = sent.reduce((sum,x) => sum + Number(x.delivered || 0),0);
    const read = sent.reduce((sum,x) => sum + Number(x.read_count || 0),0);
    return { sent: sent.length, delivered, read, rate: delivered ? Math.round(read / delivered * 100) : 0 };
  }, [items]);

  const update = <K extends keyof Fields>(key: K, value: Fields[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setNotice('');
  };

  const validate = (): string | null => {
    if (!form.title.trim() || !form.body.trim()) return 'A title and message are required.';
    if (form.title.length > 100 || form.body.length > 500) return 'Title or message is too long.';
    if (form.audience === 'personal' && !/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(form.targetUserId))
      return 'Enter a valid target user UUID.';
    if (Boolean(form.ctaLabel.trim()) !== Boolean(form.ctaHref.trim()))
      return 'CTA label and destination are required together.';
    if (form.ctaHref && (!/^\/(?!\/)[a-zA-Z0-9/_?=&.%#-]*$/.test(form.ctaHref) || form.ctaHref.includes('\\')))
      return 'CTA destination must be an internal BetVima path (e.g. /bonuses).';
    if (mode === 'schedule' && (!form.scheduledAt || new Date(form.scheduledAt).getTime() <= Date.now()))
      return 'Select a future delivery time.';
    return null;
  };
  async function submit(confirmed = false) {
    const validation = validate();
    if (validation) { setError(validation); setConfirming(false); return; }
    if (mode !== 'draft' && !confirmed) { setConfirming(true); return; }
    setConfirming(false); setBusy(true); setError(''); setNotice('');
    try {
      const result = await apiRequest<{ campaign: { id:string; status:string; recipients:number } }>(
        '/api/v1/admin/notifications', {
        method:'POST',
        json:{
          title:form.title.trim(), body:form.body.trim(), audience:form.audience,
          targetUserId:form.audience === 'personal' ? form.targetUserId : null,
          ctaLabel:form.ctaLabel.trim(), ctaHref:form.ctaHref.trim(), locale:form.locale,
          mode, scheduledAt:mode === 'schedule' ? new Date(form.scheduledAt).toISOString() : null,
        },
      });
      const count = Number(result.campaign?.recipients || 0);
      setNotice(mode === 'draft' ? 'Draft saved.' :
        `${mode === 'schedule' ? 'Scheduled' : 'Sent'} for ${count.toLocaleString()} recipient(s).`);
      setForm(initial); setMode('send');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send notification.');
    } finally { setBusy(false); }
  }

  async function takeAction(id:string,action:'publish'|'archive') {
    if (!window.confirm(action === 'publish' ? 'Send this draft to its intended recipients?' :
      'Archive this campaign? Future deliveries will be cancelled.')) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await apiRequest<{ campaign?: { recipients:number } }>(
        `/api/v1/admin/notifications/${id}`, { method:'PATCH',json:{action} });
      setNotice(action === 'archive' ? 'Campaign archived.' :
        `Draft published to ${Number(result.campaign?.recipients || 0)} recipient(s).`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed.');
    } finally { setBusy(false); }
  }

  const styleByStatus: Record<Campaign['status'], string> = {
    sent:'bg-emerald-50 text-emerald-700', scheduled:'bg-indigo-50 text-indigo-700',
    draft:'bg-amber-50 text-amber-700',archived:'bg-slate-100 text-slate-500',
  };
  return <div className="space-y-5 text-[#182333]">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <p className="text-sm text-[#6B778A]">Create, schedule and manage real in-app notifications for BetVima members.</p>
      <button type="button" onClick={() => document.getElementById('notification-compose')?.scrollIntoView({behavior:'smooth'})}
        className="inline-flex items-center gap-2 rounded-xl bg-[#087CF5] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#006BE5]">
        <Plus size={17} /> Create notification
      </button>
    </div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[
        {name:'Campaigns on this page',value:items.length,Icon:Send},
        {name:'Published or scheduled',value:metrics.sent,Icon:Users},
        {name:'User inbox entries',value:metrics.delivered,Icon:Bell},
        {name:'Recorded read rate',value:`${metrics.rate}%`,Icon:Eye},
      ].map(({name,value,Icon}) => <div key={name} className={surface}>
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[#087CF5]"><Icon size={19}/></span>
        <p className="mt-3 text-2xl font-black">{typeof value === 'number' ? value.toLocaleString() : value}</p>
        <p className="text-xs text-[#778397]">{name}</p>
      </div>)}
    </div>
    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
    {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</p>}
    <div id="notification-compose" className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(300px,1fr)]">
      <section className={surface}>
        <h2 className="text-lg font-black">Create Notification</h2>
        <p className="mt-1 text-xs text-[#6F7A89]">In-app delivery. No SMS/email is sent by this form.</p>
        <form onSubmit={event => {event.preventDefault(); void submit();}} className="mt-5 space-y-4">
          <label className="block text-sm font-semibold">Title * <span className="float-right text-xs text-[#8793A2]">{form.title.length}/100</span>
            <input required maxLength={100} value={form.title} onChange={e => update('title',e.target.value)}
              placeholder="New BetVima update" className={baseInput} />
          </label>
          <label className="block text-sm font-semibold">Message * <span className="float-right text-xs text-[#8793A2]">{form.body.length}/500</span>
            <textarea required maxLength={500} rows={4} value={form.body} onChange={e => update('body',e.target.value)}
              placeholder="Write the notification message…" className={baseInput} />
          </label>
          <div>
            <p className="text-sm font-semibold">Audience</p>
            <div className="mt-2 grid grid-cols-2 gap-2 rounded-xl bg-[#F3F4F7] p-1">
              {(['general','personal'] as const).map(a => <button key={a} type="button"
                aria-pressed={form.audience === a} onClick={() => update('audience',a)}
                className={`rounded-lg px-2 py-2.5 text-sm font-bold capitalize transition ${form.audience === a ?
                  'bg-[#087CF5] text-white shadow-sm' : 'text-[#354459] hover:bg-white'}`}>{a === 'general' ? 'General · all members' : 'Personal · one member'}</button>)}
            </div>
            {form.audience === 'personal' &&
              <label className="mt-3 block text-sm font-semibold">Recipient user UUID *
                <input required value={form.targetUserId} onChange={e => update('targetUserId',e.target.value)}
                  placeholder="User ID from Admin → Users" className={baseInput} />
              </label>}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-semibold">Action button label
              <input maxLength={50} value={form.ctaLabel} onChange={e => update('ctaLabel',e.target.value)}
                placeholder="View details" className={baseInput} />
            </label>
            <label className="block text-sm font-semibold">Destination path
              <input maxLength={240} value={form.ctaHref} onChange={e => update('ctaHref',e.target.value)}
                placeholder="/bonuses" className={baseInput} />
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-semibold">Language
              <select value={form.locale} onChange={e => update('locale',e.target.value as 'fa'|'en')}
                className={baseInput}><option value="fa">فارسی</option><option value="en">English</option></select>
            </label>
            <label className="block text-sm font-semibold">Delivery
              <select value={mode} onChange={e => setMode(e.target.value as Mode)}
                className={baseInput}>
                <option value="send">Send now</option><option value="schedule">Schedule</option>
                <option value="draft">Save draft</option></select>
            </label>
          </div>
          {mode === 'schedule' && <label className="block text-sm font-semibold">Scheduled time
            <input type="datetime-local" required value={form.scheduledAt}
              onChange={e => update('scheduledAt',e.target.value)} className={baseInput} />
          </label>}
          <div className="flex justify-between gap-3 border-t border-[#EDF0F3] pt-4">
            <button type="button" disabled={busy} onClick={() => {setMode('draft');void (async()=>{
              const oldMode = mode; // Save through the shared endpoint without sending.
              try {
                setBusy(true);setError('');
                await apiRequest('/api/v1/admin/notifications', { method:'POST',json:{
                  title:form.title.trim(),body:form.body.trim(),audience:form.audience,
                  targetUserId:form.audience === 'personal' ? form.targetUserId : null,
                  ctaLabel:form.ctaLabel.trim(), ctaHref:form.ctaHref.trim(),
                  locale:form.locale,mode:'draft',
                }});
                setNotice('Draft saved.');setForm(initial);setMode('send');await load();
              } catch(e) {setMode(oldMode);setError(e instanceof Error?e.message:'Unable to save draft');}
              finally {setBusy(false);}
            })();}}
              className="rounded-xl bg-[#F0F2F5] px-4 py-3 text-sm font-bold text-[#263B54] hover:bg-[#E5E9EF] disabled:opacity-50">Save draft</button>
            <button type="submit" disabled={busy}
              className="inline-flex items-center gap-2 rounded-xl bg-[#087CF5] px-5 py-3 text-sm font-bold text-white hover:bg-[#006BE5] disabled:opacity-50">
              {mode === 'schedule' ? <CalendarClock size={17}/> : <Send size={17}/>}
              {busy ? 'Working…' : mode === 'draft' ? 'Save draft' : mode === 'schedule' ? 'Schedule' : 'Send now'}
            </button>
          </div>
        </form>
      </section>
      <section className={surface}>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-black">Live Preview</h2>
          <span className="text-xs text-emerald-700"><CheckCircle2 size={14} className="inline" /> Preview only</span>
        </div>
        <div className="mt-4 rounded-[20px] bg-[#141C29] p-3 sm:p-5">
          <div className="rounded-[20px] bg-white p-4 shadow-xl">
            <h3 className="text-xl font-black">Notifications</h3>
            <div className="mt-3 grid grid-cols-3 rounded-xl bg-[#F2F3F5] p-1 text-center text-xs font-bold">
              <div className="rounded-lg bg-[#087CF5] py-2.5 text-white">All</div>
              <div className="py-2.5">Personal</div><div className="py-2.5">General</div>
            </div>
            <div className="mt-3 rounded-2xl bg-[#EDEEF1] p-4">
              <div className="flex justify-between text-xs text-[#697384]">
                <span>{when(new Date().toISOString())}</span><span className="rounded-full bg-[#FF632D] px-2 py-1 font-bold text-white">New</span>
              </div>
              <p dir="auto" className="mt-2 break-words font-black">{form.title || 'Notification title'}</p>
              <p dir="auto" className="mt-2 whitespace-pre-wrap break-words text-sm text-[#68717D]">{form.body || 'Your notification text appears here.'}</p>
              {form.ctaLabel && <div className="mt-3 rounded-xl bg-[#087CF5] px-3 py-3 text-center text-sm font-bold text-white">{form.ctaLabel}</div>}
            </div>
          </div>
        </div>
        <p className="mt-3 text-xs leading-5 text-[#7F8B9A]">Preview only; no notification is sent until you confirm. Campaigns and actual read receipts are stored by the platform.</p>
      </section>
    </div>
    <section className={surface}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-lg font-black">Notification History</h2>
          <p className="text-xs text-[#7A8697]">Real campaigns and read receipts. Latest 30 per page.</p></div>
        <div className="flex flex-wrap items-center gap-2">
          <input aria-label="Search notification title" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search…" className="h-10 w-36 rounded-xl border border-[#DFE5EC] px-3 text-sm outline-none focus:border-blue-400"/>
          <select aria-label="Status" value={filter} onChange={e => setFilter(e.target.value)}
            className="h-10 rounded-xl border border-[#DFE5EC] px-3 text-sm">
            <option value="">All statuses</option><option value="draft">Draft</option>
            <option value="sent">Sent</option><option value="scheduled">Scheduled</option><option value="archived">Archived</option>
          </select>
          <button type="button" aria-label="Refresh notification history" onClick={() => void load()}
            className="grid h-10 w-10 place-items-center rounded-xl border border-[#DFE5EC] hover:bg-blue-50">
            <RefreshCw size={17}/></button>
        </div>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[770px] text-left text-[13px]">
          <thead className="bg-[#F4F6F8] text-[#607086]">
            <tr>{['Title','Audience','Status','Created','Read / Delivered','Actions'].map(t => <th key={t} className="px-3 py-3 font-bold">{t}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-[#EDF0F4]">
            {items.map(item => {
              const total = Number(item.delivered || 0), read = Number(item.read_count || 0);
              return <tr key={item.id} className="hover:bg-[#F8FAFD]">
                <td className="max-w-[245px] px-3 py-3">
                  <p dir="auto" className="truncate font-bold">{item.title}</p>
                  <p dir="auto" className="max-w-[220px] truncate text-xs text-[#8A96A6]">{item.body}</p>
                </td>
                <td className="px-3 py-3 capitalize">{item.audience}</td>
                <td className="px-3 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${styleByStatus[item.status]}`}>{item.status}</span></td>
                <td className="whitespace-nowrap px-3 py-3 text-[#778496]">{when(item.created_at)}</td>
                <td className="whitespace-nowrap px-3 py-3 font-semibold">{read.toLocaleString()} / {total.toLocaleString()}</td>
                <td className="px-3 py-3"><div className="flex items-center gap-1">
                  {item.status === 'draft' && <button title="Publish draft" aria-label="Publish draft" disabled={busy}
                    onClick={() => void takeAction(item.id,'publish')} className="rounded-lg p-2 hover:bg-blue-100"><Send size={17}/></button>}
                  {item.status !== 'archived' && <button title="Archive" aria-label="Archive" disabled={busy}
                    onClick={() => void takeAction(item.id,'archive')} className="rounded-lg p-2 hover:bg-slate-200"><Archive size={17}/></button>}
                  <button title="Copy text into composer" aria-label="Duplicate to composer"
                    onClick={() => {
                      setForm({ title:item.title,body:item.body,audience:item.audience,
                        targetUserId:item.target_user_id || '', ctaLabel:item.action_label || '',
                        ctaHref:item.action_path || '', locale:item.locale, scheduledAt:'' });
                      window.scrollTo({top:0,behavior:'smooth'});
                    }} className="rounded-lg p-2 hover:bg-blue-100"><Copy size={17}/></button>
                </div></td>
              </tr>;
            })}
            {!loading && !items.length && <tr><td colSpan={6} className="py-12 text-center text-[#748195]">No notification campaigns found.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
    {confirming && <div className="fixed inset-0 z-[200] grid place-items-center bg-black/60 p-4">
      <section role="alertdialog" aria-modal="true" aria-labelledby="notification-send-confirm"
        className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex justify-between"><h2 id="notification-send-confirm" className="text-xl font-black">Confirm delivery</h2>
          <button aria-label="Cancel" onClick={() => setConfirming(false)}><X size={22}/></button></div>
        <p className="mt-4 text-sm leading-6 text-[#607082]">
          {mode === 'schedule' ? 'This message will appear at the scheduled time.' :
            'This will place a notification in each eligible recipient’s inbox.'}
          {form.audience === 'general' ? ' Audience: all active members.' : ' Audience: one selected member.'}
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button onClick={() => setConfirming(false)} className="rounded-xl bg-slate-100 px-4 py-2.5 font-bold">Cancel</button>
          <button onClick={() => void submit(true)} disabled={busy}
            className="rounded-xl bg-[#087CF5] px-4 py-2.5 font-bold text-white">
            <Check size={17} className="mr-1 inline"/> Confirm
          </button>
        </div>
      </section>
    </div>}
  </div>;
}
