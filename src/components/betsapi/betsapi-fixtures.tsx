'use client';

import { useEffect, useMemo, useState } from 'react';
import { MatchCard, type MatchView } from '@/components/betting/match-card';
import { useApp } from '@/components/layout/providers';
import { BETSAPI_SPORTS, type BetsMode } from '@/lib/betsapi-sports-map';
import Link from 'next/link';
import { BetsApiLeaguePicker } from '@/components/betsapi/betsapi-league-picker';
import { BetsApiCanonicalLivePrices } from '@/components/betsapi/betsapi-canonical-live-prices';

type Listing = { matches: MatchView[]; total: number | null; pageCount: number | null;
  error: string | null; sportKey: string; page: number };
type Envelope = { ok: boolean; data?: Listing };
export function BetsApiFixtures({ mode, initialSport = 'football' }: { mode: BetsMode; initialSport?: string }) {
  const { locale } = useApp();
  const [sport, setSport] = useState(initialSport === 'hockey' ? 'ice-hockey' : initialSport);
  const [page, setPage] = useState(1);
  const [leagueId, setLeagueId] = useState<string | null>(null);
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    let mounted = true;
    const load = async () => {
      if (mounted) { setLoading(true); setMessage(''); }
      try {
        const q = new URLSearchParams({ mode, sport, page: String(page) });
        if (mode === 'upcoming' && leagueId) q.set('leagueId', leagueId);
        const res = await fetch('/api/v1/betsapi/catalogue?' + q, { signal: controller.signal, cache: 'no-store' });
        if (!res.ok) throw new Error('BAD_RESPONSE');
        const body = await res.json() as Envelope;
        if (!body.ok || !body.data) throw new Error('INVALID_RESPONSE');
        if (mounted) setListing(body.data);
      } catch {
        if (mounted) { setListing(null); setMessage(locale === 'fa' ? 'دریافت مسابقات از BetsAPI ممکن نشد.' : 'BetsAPI fixtures could not be loaded.'); }
      } finally { if (mounted) setLoading(false); }
    };
    void load();
    // Public source is coalesced and cached server-side; do not flood the trial quota.
    const timer = mode === 'live' ? setInterval(() => { if (document.visibilityState === 'visible') void load(); }, 10000) : null;
    return () => { mounted = false; controller.abort(); if (timer) clearInterval(timer); };
  }, [mode, sport, page, locale, leagueId]);
  const items = useMemo(() => listing?.matches ?? [], [listing]);
  return <section className="mx-3 my-3 space-y-4 pb-20" aria-label="BetsAPI sports fixtures">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h1 className="text-xl font-extrabold text-[#20242A]">{mode === 'live' ? (locale === 'fa' ? 'مسابقات زنده' : 'Live matches') : (locale === 'fa' ? 'مسابقات آینده' : 'Upcoming matches')}</h1>
      <span className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-500">BetsAPI / Bet365</span>
    </div>
    <div className="flex gap-2 overflow-x-auto pb-2">
      {BETSAPI_SPORTS.map(s => <button key={s.id} type="button" onClick={() => { setSport(s.key); setPage(1); setLeagueId(null); setListing(null); }}
        className={`shrink-0 rounded-xl border px-3 py-2 text-xs font-bold ${sport === s.key ? 'border-[#087FF5] bg-[#EAF3FF] text-[#087FF5]' : 'border-slate-200 bg-white text-slate-600'}`}>{s.name}</button>)}
    </div>
    {mode === 'upcoming' && <BetsApiLeaguePicker sport={sport} fa={locale === 'fa'}
      selected={leagueId} onChange={id => { setLeagueId(id); setPage(1); setListing(null); }} />}
    {mode === 'live' && <p className="text-[11px] font-medium text-[#657B94]">
      {locale === 'fa' ? 'مسابقات هر ۱۰ ثانیه بررسی می‌شوند؛ تغییر ضریب بسته به محدودیت API است.' :
        'Fixtures checked every 10s · prices refresh according to provider quota.'}
    </p>}
    {mode === 'live' && sport === 'football' && <BetsApiCanonicalLivePrices />}
    {loading && !listing && <p className="py-8 text-center text-sm text-slate-500">{locale === 'fa' ? 'در حال بارگذاری مسابقات…' : 'Loading fixtures…'}</p>}
    {message && <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{message}</p>}
    {listing?.error && <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{locale === 'fa' ? 'خطا در منبع مسابقات' : 'Sports feed unavailable'}: {listing.error}</p>}
    {listing && !listing.error && <>
      <p className="text-xs text-slate-500">{locale === 'fa' ? 'تعداد گزارش‌شده توسط API' : 'Provider reported'}: <strong>{listing.total ?? '—'}</strong> · {locale === 'fa' ? 'نمایش در این صفحه' : 'Displayed on this page'}: {items.length}</p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {items.map(match => <MatchCard key={match.id} match={match} />)}
      </div>
      {!items.length && <p className="rounded-xl bg-white p-6 text-sm text-slate-500">{locale === 'fa' ? 'مسابقه‌ای در این رشته ثبت نشده است.' : 'No fixtures returned for this sport.'}</p>}
      {mode === 'upcoming' && <div className="flex items-center justify-center gap-3">
        <button type="button" disabled={page === 1 || loading} onClick={() => setPage(p => Math.max(1,p-1))} className="rounded-lg border bg-white px-4 py-2 disabled:opacity-40">Previous</button>
        <span className="text-sm text-slate-600">{page}{listing.pageCount ? ' / ' + listing.pageCount : ''}</span>
        <button type="button" disabled={loading || items.length === 0 || !!listing.pageCount && page >= listing.pageCount} onClick={() => setPage(p => p+1)} className="rounded-lg border bg-white px-4 py-2 disabled:opacity-40">Next</button>
      </div>}
    </>}
    <p className="text-xs text-slate-500">{locale === 'fa' ? 'فقط ضرایب تازه و تأییدشده در بخش «ضرایب زنده قابل انتخاب» یا جزئیات مسابقه قابل شرط هستند؛ سایر ضرایب صرفاً نمایشی‌اند.' : 'Only current, verified odds can be selected in the live betting section or match details. Other offers are for viewing only.'}</p>
    <Link href="/" className="text-xs font-semibold text-[#087FF5]">{locale === 'fa' ? 'صفحه اصلی' : 'Home'}</Link>
  </section>;
}
