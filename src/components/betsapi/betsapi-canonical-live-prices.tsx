'use client';

import { useEffect, useState } from 'react';
import { useApp } from '@/components/layout/providers';
import { useBetSlip, type SlipItem } from '@/lib/store/betslip';

type OutcomeCode = 'HOME' | 'DRAW' | 'AWAY';
interface Selection {
  selectionId: string;
  code: OutcomeCode;
  oddsScaled: string;
  oddsVersion: number;
}
interface Market {
  matchId: string;
  providerId: string;
  marketId: string;
  home: string;
  away: string;
  expiresAt: string;
  selections: Selection[];
}
interface Envelope {
  ok: boolean;
  data?: { available: boolean; markets: Market[]; reason: string | null };
}

const outcomeLabels: Record<OutcomeCode, { en: string; fa: string }> = {
  HOME: { en: '1', fa: '۱' },
  DRAW: { en: 'X', fa: 'مساوی' },
  AWAY: { en: '2', fa: '۲' },
};

export function BetsApiCanonicalLivePrices({ compact = false, eventId }: { compact?: boolean; eventId?: string | null }) {
  const { locale } = useApp();
  const fa = locale === 'fa';
  const toggle = useBetSlip(s => s.toggle);
  const selected = useBetSlip(s => s.items);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [status, setStatus] = useState<'loading' | 'disabled' | 'ready' | 'empty' | 'error'>('loading');
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const abort = new AbortController();
    let loading = false;
    async function load() {
      if (abort.signal.aborted || loading || document.visibilityState !== 'visible') return;
      loading = true;
      try {
        const response = await fetch('/api/v1/betsapi/canonical-wagers', {
          cache: 'no-store', signal: abort.signal,
        });
        if (!response.ok) throw new Error('UPSTREAM_UNAVAILABLE');
        const envelope = await response.json() as Envelope;
        if (!envelope.ok || !envelope.data) throw new Error('INVALID_RESPONSE');
        if (abort.signal.aborted) return;
        setMarkets(envelope.data.markets);
        setStatus(envelope.data.reason === 'WAGER_INGEST_DISABLED'
          ? 'disabled' : envelope.data.available ? 'ready' : 'empty');
      } catch {
        if (!abort.signal.aborted) { setMarkets([]); setStatus('error'); }
      } finally { loading = false; }
    }
    void load();
    const polling = window.setInterval(() => { void load(); }, 10_000);
    const time = window.setInterval(() => setNow(Date.now()), 1000);
    const onVisible = () => { if (document.visibilityState === 'visible') void load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      abort.abort();
      window.clearInterval(polling);
      window.clearInterval(time);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  const active = markets.filter(m => Date.parse(m.expiresAt) > now + 1000 &&
    (!eventId || (/^[0-9]{1,16}$/.test(eventId) && m.providerId === '1:' + eventId)));
  const choose = (market: Market, selection: Selection) => {
    if (Date.parse(market.expiresAt) <= Date.now() + 1000) return;
    const item: SlipItem = {
      matchId: market.matchId, marketId: market.marketId,
      selectionId: selection.selectionId,
      oddsScaled: selection.oddsScaled,
      oddsVersionSeen: selection.oddsVersion,
      label: selection.code === 'DRAW'
        ? (fa ? 'مساوی' : 'Draw')
        : selection.code === 'HOME' ? market.home : market.away,
      marketLabel: fa ? 'نتیجه نهایی (1X2)' : 'Full-time result (1X2)',
      matchLabel: market.home + ' - ' + market.away,
      sportSlug: 'football', addedAt: Date.now(),
    };
    // The real bet-slip retains all usual signed quote, odds-change,
    // age/account, bankroll, currency and settlement checks. No money here.
    toggle(item);
  };

  if (status === 'disabled' || (compact && active.length === 0)) return null;

  return <section className={compact ? 'mx-3 my-3 space-y-2' : 'space-y-3'}
    aria-label={fa ? 'ضرایب زنده قابل شرط' : 'Live wagerable odds'}>
    <div className="flex items-center justify-between gap-2">
      <h2 className="text-base font-extrabold text-[#243547]">
        {fa ? 'ضرایب زنده قابل انتخاب' : 'Verified live odds'}
      </h2>
      {active.length > 0 && <span className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700">
        {active.length} {fa ? 'مسابقه' : 'matches'}
      </span>}
    </div>
    {active.length === 0 ? (
      <p role="status" className="rounded-xl border border-[#E5EAF0] bg-white p-4 text-xs leading-6 text-[#617184]">
        {status === 'loading'
          ? (fa ? 'در حال دریافت ضرایب معتبر…' : 'Checking verified odds…')
          : status === 'error'
            ? (fa ? 'ارتباط با ضرایب معتبر برقرار نشد؛ دوباره بررسی می‌شود.' : 'Verified odds unavailable; retrying.')
            : (fa ? 'فعلاً ضریب زنده تازه‌ای برای ثبت شرط وجود ندارد. هر ۱۰ ثانیه بررسی می‌شود.' :
                'No current wager-grade live price. Checking again every 10 seconds.')}
      </p>
    ) : <div className={compact
      ? 'grid gap-2 md:grid-cols-2 xl:grid-cols-3'
      : 'grid gap-3 md:grid-cols-2 xl:grid-cols-3'}>
      {active.map(market => <div key={market.matchId + ':' + market.marketId}
        className="overflow-hidden rounded-2xl border border-[#DFE7EF] bg-white shadow-[0_2px_12px_rgba(18,35,51,.05)]">
        <div className="border-b border-[#EDF1F5] bg-[#F6FAFD] px-3 py-2.5">
          <div className="truncate text-sm font-extrabold text-[#253445]">{market.home} — {market.away}</div>
          <p className="mt-1 text-[10px] text-[#7A899A]">
            {fa ? 'فوتبال زنده · نتیجه نهایی' : 'Live football · full-time result'}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 p-2.5">
          {market.selections.map(selection => {
            const isSelected = selected.some(item => item.selectionId === selection.selectionId);
            return <button key={selection.selectionId} type="button"
              onClick={() => choose(market, selection)}
              disabled={Date.parse(market.expiresAt) <= Date.now() + 1000}
              aria-pressed={isSelected}
              aria-label={selection.code + ': ' + (Number(selection.oddsScaled) / 10_000).toFixed(2)}
              className={`flex min-h-[57px] flex-col items-center justify-center rounded-xl border px-1.5 py-2 disabled:opacity-40 ${isSelected
                ? 'border-[#087FF5] bg-[#EAF3FF] text-[#087FF5]'
                : 'border-[#E3EAF1] bg-[#F4F7FA] text-[#243547]'}`}>
              <span className="text-[11px] font-bold">{outcomeLabels[selection.code][fa ? 'fa' : 'en']}</span>
              <strong className="mt-1 text-sm font-black tabular-nums">{(Number(selection.oddsScaled) / 10_000).toFixed(2)}</strong>
            </button>;
          })}
        </div>
      </div>)}
    </div>}
    {active.length > 0 && <p className="text-[11px] text-slate-500">
      {fa ? 'یک ضریب را انتخاب کن تا بت‌اسلیپ باز شود. اگر ضریب تغییر کند، قبل از ثبت شرط باید آن را تأیید کنی.' :
        'Select any price to open the bet slip. Changed prices require your approval before placement.'}
    </p>}
  </section>;
}
