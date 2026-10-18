'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronLeft, Search, X } from 'lucide-react';
import { LeagueLogo } from '@/components/ui/logo';

type League = { id: string; name: string; country: string | null };
type Envelope = { ok: boolean; data?: { leagues: League[]; error: string | null } };

/** The original sportsbook's league navigation rebuilt for Bet365 league IDs. */
export function BetsApiLeaguePicker({
  sport, selected, onChange, fa,
}: {
  sport: string;
  selected: string | null;
  onChange: (id: string | null) => void;
  fa: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [country, setCountry] = useState<string | null>(null);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    const abort = new AbortController();
    setLeagues([]);
    setLoading(true);
    setError('');
    setCountry(null);
    setSearch('');
    fetch('/api/v1/betsapi/leagues?sport=' + encodeURIComponent(sport),
      { signal: abort.signal, cache: 'no-store' })
      .then(r => { if (!r.ok) throw new Error('FETCH_FAILED'); return r.json() as Promise<Envelope>; })
      .then(response => {
        if (abort.signal.aborted) return;
        if (!response.ok || !response.data || response.data.error) {
          setError(fa ? 'دریافت فهرست لیگ‌ها ممکن نشد.' : 'League list unavailable.');
        } else setLeagues(response.data.leagues);
      }).catch(() => { if (!abort.signal.aborted) setError(fa ? 'خطا در دریافت لیگ‌ها' : 'Unable to load leagues'); })
      .finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => abort.abort();
  }, [sport, fa]);
  const groups = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    const subset = leagues.filter(l => !normalized ||
      l.name.toLowerCase().includes(normalized) || (l.country ?? '').includes(normalized));
    const countries = new Map<string, League[]>();
    for (const league of subset) {
      const key = league.country ?? 'International';
      const items = countries.get(key) ?? [];
      items.push(league);
      countries.set(key, items);
    }
    return [...countries.entries()].sort((a,b) => a[0].localeCompare(b[0]));
  }, [leagues, search]);
  const label = selected ? leagues.find(l => l.id === selected)?.name ?? selected :
    fa ? 'همه لیگ‌ها' : 'All leagues';
  return <div className="relative z-20 rounded-xl border border-[#DDE3EA] bg-white shadow-sm">
    <button type="button" onClick={() => { setOpen(v => !v); setCountry(null); }}
      aria-expanded={open} aria-label={fa ? 'انتخاب لیگ' : 'Choose league'}
      className="flex w-full items-center justify-between gap-3 rounded-xl px-4 py-3 text-left">
      <span className="flex min-w-0 flex-col">
        <strong className="text-sm font-extrabold text-[#243344]">{fa ? 'انتخاب لیگ مسابقات آینده' : 'Choose an upcoming league'}</strong>
        <span className="truncate text-xs text-[#64748B]">{label}</span>
      </span>
      <ChevronDown size={18} className={'shrink-0 text-[#52657A] transition-transform ' + (open ? 'rotate-180' : '')} />
    </button>
    {open && <div className="absolute inset-x-0 top-[calc(100%+5px)] z-30 overflow-hidden rounded-2xl border border-[#243B56] bg-[#0B1A2A] p-3 shadow-2xl">
      <div className="mb-3 flex items-center justify-between text-white">
        <button type="button" onClick={() => setCountry(null)} className="inline-flex items-center gap-1 text-sm font-bold">
          {country && <ChevronLeft size={16}/>}
          {country ?? (fa ? 'کشورها و لیگ‌ها' : 'Countries & leagues')}
        </button>
        <button type="button" aria-label="Close" onClick={() => setOpen(false)}><X size={18}/></button>
      </div>
      <div className="relative mb-3">
        <Search size={15} className="absolute left-3 top-3 text-[#94A3B8]"/>
        <input className="w-full rounded-lg border border-[#284361] bg-[#152D46] py-2 pl-9 pr-3 text-sm text-white outline-none"
          placeholder={fa ? 'جستجوی کشور یا لیگ' : 'Search countries or leagues'}
          value={search} onChange={e => { setSearch(e.target.value); setCountry(null); }}/>
      </div>
      <div className="max-h-[46vh] space-y-1 overflow-y-auto">
        <button type="button" onClick={() => { onChange(null); setOpen(false); }}
          className="w-full rounded-lg bg-[#193A59] px-3 py-2.5 text-left text-sm font-bold text-white">{fa ? 'همه لیگ‌ها' : 'All leagues'}</button>
        {loading && <p className="p-3 text-xs text-[#B9C8D9]">{fa ? 'در حال بارگذاری…' : 'Loading leagues…'}</p>}
        {error && <p role="alert" className="p-3 text-xs text-amber-300">{error}</p>}
        {groups.filter(([key]) => !country || key === country).map(([key, options]) =>
          <div key={key}>
            {!country && <button type="button" onClick={() => setCountry(key)}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm text-[#DFE9F4] hover:bg-[#1C3855]">
              <span>{key.toUpperCase() === 'INTERNATIONAL' ? (fa ? 'بین‌المللی' : 'International') : key.toUpperCase()}</span>
              <span className="text-xs text-[#91A9C0]">{options.length} ›</span>
            </button>}
            {country && options.map(l => <button key={l.id} type="button"
              onClick={() => { onChange(l.id); setOpen(false); }}
              className={'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-white hover:bg-[#1C3855] ' + (selected === l.id ? 'bg-[#206CCC]' : '')}>
              <LeagueLogo name={l.name} sportKey={sport} size={23}/>
              <span className="min-w-0 flex-1 truncate">{l.name}</span>
            </button>)}
          </div>)}
        {!loading && !error && !groups.length &&
          <p className="p-3 text-xs text-[#B9C8D9]">{fa ? 'لیگی یافت نشد' : 'No leagues found'}</p>}
      </div>
    </div>}
  </div>;
}
