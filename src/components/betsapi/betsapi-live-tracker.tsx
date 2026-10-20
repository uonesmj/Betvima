'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, BarChart3, Clock3, Flag, History, Radio, ShieldAlert, Target, TrendingUp, Zap } from 'lucide-react';
import { TeamLogo } from '@/components/ui/logo';
import { useVerifiedClock } from '@/components/betsapi/verified-clock';
import type { MatchLiveFacts, StatLine } from '@/providers/betsapi-match-facts';

type View = 'pitch' | 'stats' | 'timeline' | 'momentum';
type Side = 'home' | 'away';
type Observation = { id: string; side: Side | null; key: string; labelEn: string; labelFa: string; change: number | null; at: string; minute: number | null };
type TrendPoint = { id: string; home: number | null; away: number | null; at: string };
type Props = { facts: MatchLiveFacts | null; home: string; away: string; homeLogo?: string | null; awayLogo?: string | null; fa: boolean };
const watched = new Set(['corners', 'throwins', 'fouls', 'offsides', 'yellowcards', 'redcards', 'on_target', 'off_target', 'attacks', 'dangerous_attacks', 'freekicks', 'goalkicks']);
const nameFor = (line: StatLine | undefined, fa: boolean, fallback: string) => line ? (fa ? line.fa : line.en) : fallback;
const percent = (home: number | null | undefined, away: number | null | undefined): number | null => {
  if (home == null || away == null || home < 0 || away < 0) return null;
  const total = home + away;
  return total > 0 ? Math.round(home * 100 / total) : null;
};
const formatTime = (value: number | null) => value == null ? '—' : String(Math.floor(value / 60)) + ':' + String(value % 60).padStart(2, '0');
const parseScore = (value: string | null): [number, number] | null => {
  const m = /^(\d{1,3})-(\d{1,3})$/.exec(value ?? '');
  return m ? [Number(m[1]), Number(m[2])] : null;
};

/**
 * Provider-backed match visualization. Aggregated counts describe ATTACKING
 * PRESSURE, never ball coordinates or player locations. New activity markers
 * are observed changes to provider counters, not timestamped match incidents.
 */
export function BetsApiLiveTracker({ facts, home, away, homeLogo, awayLogo, fa }: Props) {
  const [view, setView] = useState<View>('pitch');
  const [observations, setObservations] = useState<Observation[]>([]);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [pulse, setPulse] = useState<Observation | null>(null);
  const previous = useRef<MatchLiveFacts | null>(null);
  const stats = facts?.stats ?? [];
  const stat = (key: string) => stats.find(s => s.key === key);
  const clock = useVerifiedClock(facts?.clockSeconds != null ? {
    clockSeconds: facts.clockSeconds,
    clockRunning: facts.clockRunning,
    clockObservedAt: facts.updatedAt,
    minute: facts.minute,
  } : null);
  const time = clock != null ? formatTime(clock) : facts?.minute != null ? String(facts.minute) + '′' : 'LIVE';
  const attacks = stat('dangerous_attacks') ?? stat('attacks');
  const share = percent(attacks?.home, attacks?.away);
  const possession = stat('possession');
  const score = parseScore(facts?.score ?? null);
  const isAvailable = Boolean(facts?.stats.length);

  useEffect(() => {
    if (!facts?.updatedAt || !facts.fi) return;
    const old = previous.current;
    if (old?.fi !== facts.fi) {
      previous.current = facts;
      setObservations([]);
      setTrend([]);
      setPulse(null);
      return;
    }
    if (old.updatedAt === facts.updatedAt) return;
    previous.current = facts;
    const previousMap = new Map(old.stats.map(s => [s.key, s]));
    const fresh: Observation[] = [];
    for (const line of facts.stats) {
      if (!watched.has(line.key)) continue;
      const last = previousMap.get(line.key);
      if (!last) continue;
      for (const side of ['home', 'away'] as const) {
        const before = last[side], after = line[side];
        if (before == null || after == null || after <= before) continue;
        const delta = after - before;
        // A provider correction may change counts dramatically; do not
        // present that as a single event on the pitch.
        if (delta > (line.key.includes('attack') ? 15 : 4)) continue;
        fresh.push({
          id: facts.fi + ':' + facts.updatedAt + ':' + line.key + ':' + side,
          side, key: line.key, labelEn: line.en, labelFa: line.fa,
          change: delta, at: facts.updatedAt, minute: facts.minute,
        });
      }
    }
    const beforeScore = parseScore(old.score);
    const afterScore = parseScore(facts.score);
    if (beforeScore && afterScore) {
      for (let i = 0; i < 2; i++) {
        if (afterScore[i] > beforeScore[i] && afterScore[i] - beforeScore[i] <= 2)
          fresh.unshift({
            id: facts.fi + ':' + facts.updatedAt + ':score:' + i,
            side: i === 0 ? 'home' : 'away', key: 'score',
            labelEn: 'Score updated', labelFa: 'به‌روزرسانی نتیجه',
            change: afterScore[i] - beforeScore[i], at: facts.updatedAt, minute: facts.minute,
          });
      }
    }
    if (fresh.length) {
      setObservations(items => [...fresh, ...items].slice(0, 60));
      setPulse(fresh[0]);
    }
    const currentAttacks = facts.stats.find(s => s.key === 'dangerous_attacks')
      ?? facts.stats.find(s => s.key === 'attacks');
    if (currentAttacks?.home != null && currentAttacks.away != null) {
      setTrend(points => [...points, {
        id: facts.updatedAt,
        home: currentAttacks.home, away: currentAttacks.away, at: facts.updatedAt,
      }].slice(-32));
    }
  }, [facts]);

  useEffect(() => {
    if (!pulse) return;
    const timer = window.setTimeout(() => setPulse(p => p?.id === pulse.id ? null : p), 5500);
    return () => window.clearTimeout(timer);
  }, [pulse]);

  const labels = {
    pitch: fa ? 'زمین زنده' : 'Live pitch',
    stats: fa ? 'آمار' : 'Statistics',
    timeline: fa ? 'رویدادها' : 'Updates',
    momentum: fa ? 'روند حملات' : 'Momentum',
  };
  const tabs: { id: View; icon: typeof Activity }[] = [
    { id: 'pitch', icon: Radio }, { id: 'stats', icon: BarChart3 },
    { id: 'timeline', icon: History }, { id: 'momentum', icon: TrendingUp },
  ];
  const summaryKeys = ['on_target', 'off_target', 'corners', 'yellowcards', 'redcards', 'attacks', 'dangerous_attacks', 'offsides'];
  const timeline = useMemo(() => observations.slice(0, 30), [observations]);
  const liveAge = facts?.updatedAt ? Date.parse(facts.updatedAt) : NaN;
  const hasGoodClock = Number.isFinite(liveAge);
  const lastSeen = hasGoodClock ? new Date(liveAge).toLocaleTimeString(fa ? 'fa-IR' : 'en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';

  return <section className="overflow-hidden rounded-[20px] border border-[#213B49] bg-[#102733] text-white shadow-[0_15px_42px_rgba(13,32,42,.2)]" aria-label={fa ? 'نمایش زنده مسابقه' : 'Live match tracker'}>
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-[#152F3B] px-3 py-2.5 sm:px-4">
      <div className="flex items-center gap-2">
        <span className="relative flex size-2.5 shrink-0">
          {facts?.clockRunning && <span className="absolute inset-0 motion-safe:animate-ping rounded-full bg-[#40DE9D]/50" />}
          <span className="relative size-2.5 rounded-full bg-[#40DE9D]" />
        </span>
        <span className="text-[10px] font-black uppercase tracking-[.15em] text-white/80">{fa ? 'مرکز زنده مسابقه' : 'Live match centre'}</span>
      </div>
      <span className="flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2 py-1 font-mono text-xs font-bold tabular-nums">
        <Clock3 size={13} aria-hidden /> {time}
      </span>
    </div>

    <div className="grid grid-cols-[minmax(0,1fr)_80px_minmax(0,1fr)] items-center gap-2 px-3 py-4 sm:grid-cols-[minmax(0,1fr)_110px_minmax(0,1fr)] sm:px-5">
      <div className="flex min-w-0 items-center gap-2">
        <TeamLogo url={homeLogo ?? null} name={home} theme="dark" size={36} />
        <span className="min-w-0 truncate text-xs font-black sm:text-sm" title={home}>{home}</span>
      </div>
      <div className="text-center">
        <strong className="font-mono text-[22px] font-black tabular-nums tracking-tight sm:text-[28px]">{score ? score[0] + ' : ' + score[1] : '– : –'}</strong>
        <div className="text-[9px] font-bold uppercase tracking-wider text-[#9DB7C5]">{fa ? 'زنده' : 'LIVE'}</div>
      </div>
      <div className="flex min-w-0 items-center justify-end gap-2">
        <span className="min-w-0 truncate text-right text-xs font-black sm:text-sm" title={away}>{away}</span>
        <TeamLogo url={awayLogo ?? null} name={away} theme="dark" size={36} />
      </div>
    </div>

    <div className="grid grid-cols-3 gap-2 border-y border-white/10 bg-[#10222C] px-3 py-2.5 text-center text-[10px]">
      <div><span className="block text-white/50">{fa ? 'مالکیت توپ' : 'Possession'}</span><strong className="tabular-nums">{possession?.home != null ? possession.home + '%' : '—'}</strong></div>
      <div><span className="block text-white/50">{fa ? 'حملات خطرناک' : 'Dangerous attacks'}</span><strong className="tabular-nums">{stat('dangerous_attacks')?.home ?? '—'} : {stat('dangerous_attacks')?.away ?? '—'}</strong></div>
      <div><span className="block text-white/50">{fa ? 'مالکیت توپ' : 'Possession'}</span><strong className="tabular-nums">{possession?.away != null ? possession.away + '%' : '—'}</strong></div>
    </div>

    <div className="grid grid-cols-4 border-b border-white/10" role="tablist" aria-label={fa ? 'نمایش مسابقه' : 'Tracker views'}>
      {tabs.map(({ id, icon: Icon }) => <button key={id} type="button" role="tab" aria-selected={view === id} onClick={() => setView(id)}
        className={'flex min-h-12 flex-col items-center justify-center gap-1 border-b-2 px-1 py-2 text-[10px] font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#5FBBFF] ' +
          (view === id ? 'border-[#3EA6FF] bg-[#1A3C4B] text-white' : 'border-transparent text-white/60 hover:bg-white/5')}>
        <Icon size={17} aria-hidden />{labels[id]}
      </button>)}
    </div>

    {view === 'pitch' && <div role="tabpanel" className="p-2.5 sm:p-4">
      <div className="relative aspect-[1.7/1] w-full overflow-hidden rounded-xl border border-[#3D8F69] bg-[#176942] sm:aspect-[1.9/1]">
        <svg viewBox="0 0 1000 540" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true">
          <defs>
            <pattern id="betvima-pitch-stripes" width="200" height="540" patternUnits="userSpaceOnUse"><rect width="100" height="540" fill="#ffffff" opacity=".035"/></pattern>
            <linearGradient id="betvima-attack-glow" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#52FFBB" stopOpacity=".03"/><stop offset="1" stopColor="#52FFBB" stopOpacity=".31"/></linearGradient>
          </defs>
          <rect width="1000" height="540" fill="url(#betvima-pitch-stripes)"/>
          <g fill="none" stroke="#D8FBE8" strokeWidth="3" opacity=".62">
            <rect x="24" y="22" width="952" height="496"/>
            <path d="M500 22V518"/><circle cx="500" cy="270" r="73"/><circle cx="500" cy="270" r="3" fill="#D8FBE8"/>
            <path d="M24 125H184V415H24 M976 125H816V415H976 M24 188H84V352H24 M976 188H916V352H976"/>
            <path d="M184 208 A73 73 0 0 1 184 332 M816 208 A73 73 0 0 0 816 332"/>
            <path d="M24 242H9V298H24 M976 242H991V298H976"/>
          </g>
          <g fill="#D8FBE8" opacity=".72"><circle cx="122" cy="270" r="4"/><circle cx="878" cy="270" r="4"/></g>
          {pulse?.side && <rect x={pulse.side === 'home' ? 665 : 24} y="22" width="311" height="496"
            fill="url(#betvima-attack-glow)" transform={pulse.side === 'away' ? 'rotate(180 500 270)' : undefined}
            className="motion-safe:animate-pulse"/>}
        </svg>
        {pulse && <div role="status" aria-live="polite" className={'absolute left-1/2 top-1/2 z-10 max-w-[88%] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-[#C1FFE0]/40 bg-[#062D25]/95 px-3 py-2.5 text-center shadow-xl backdrop-blur-sm motion-safe:animate-pulse'}>
          <strong className="block truncate text-xs">{pulse.side === 'home' ? home : pulse.side === 'away' ? away : '—'}</strong>
          <span className="mt-0.5 flex items-center justify-center gap-1 text-[11px] text-[#BFF9DC]"><Zap size={13} /> {fa ? pulse.labelFa : pulse.labelEn} +{pulse.change}</span>
        </div>}
        {!pulse && <div className="absolute bottom-3 left-1/2 max-w-[90%] -translate-x-1/2 rounded-lg bg-black/35 px-3 py-1.5 text-center text-[10px] font-semibold text-white/85 backdrop-blur">
          {isAvailable ? (fa ? 'زمین شماتیک · نمایش نسبی جریان بازی' : 'Schematic pitch · relative match flow') : (fa ? 'در انتظار آمار معتبر مسابقه' : 'Waiting for verified match data')}
        </div>}
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 text-[11px] font-bold">
        <span className="truncate">{home}</span>
        <span className="text-center text-[9px] font-bold uppercase tracking-wider text-white/55">{fa ? 'فشار حملات ثبت‌شده' : 'Reported attacking pressure'}</span>
        <span className="truncate text-right">{away}</span>
      </div>
      <div className="mt-1.5 flex h-2.5 overflow-hidden rounded-full bg-white/10" role="img" aria-label={share == null ? (fa ? 'آمار حملات موجود نیست' : 'Attack data unavailable') : (fa ? 'سهم حملات میزبان ' : 'Home attacking share ') + share + '%' }>
        {share != null && <><div className="h-full bg-[#35DC9A] transition-[width] duration-700" style={{ width: share + '%' }} /><div className="h-full flex-1 bg-[#F6BD5A]"/></>}
      </div>
      <p className="mt-2 text-center text-[10px] leading-4 text-white/55">
        {fa ? 'نشانگرها تغییر آمار دریافتی را نمایش می‌دهند؛ این تصویر ردیابی واقعی توپ و بازیکن نیست.' : 'Highlights show newly received statistics; real ball and player coordinates are not provided.'}
      </p>
    </div>}

    {view === 'stats' && <div role="tabpanel" className="space-y-2 p-3 sm:p-4">
      {stats.length ? stats.map(line => {
        const shareHome = percent(line.home, line.away);
        return <div key={line.key} className="rounded-xl border border-white/10 bg-white/[.045] p-3">
          <div className="mb-2 grid grid-cols-[48px_minmax(0,1fr)_48px] items-center gap-2 text-[11px]">
            <strong className="text-left font-mono text-sm tabular-nums text-[#6CF2BA]">{line.home ?? '—'}</strong>
            <span className="text-center font-semibold text-white/80">{fa ? line.fa : line.en}</span>
            <strong className="text-right font-mono text-sm tabular-nums text-[#FFD78D]">{line.away ?? '—'}</strong>
          </div>
          <div className="flex h-2 overflow-hidden rounded-full bg-white/10">{shareHome != null && <>
            <div className="bg-[#35DC9A] transition-[width] duration-700" style={{ width: shareHome + '%' }}/>
            <div className="flex-1 bg-[#F6BD5A]"/>
          </>}</div>
        </div>;
      }) : <div className="p-6 text-center text-xs text-white/60">{fa ? 'API هنوز آمار معتبری برای این بازی ارسال نکرده است.' : 'The provider has not supplied verified statistics for this fixture.'}</div>}
    </div>}

    {view === 'timeline' && <div role="tabpanel" className="space-y-2 p-3 sm:p-4">
      {timeline.length ? timeline.map(entry => <div key={entry.id} className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[.045] p-3">
        <span className={'grid size-9 shrink-0 place-items-center rounded-full ' + (entry.key === 'score' ? 'bg-[#248D65]/30 text-[#6CF2BA]' : 'bg-white/10 text-white/80')}>
          {entry.key === 'score' ? <Target size={17} /> : entry.key === 'corners' ? <Flag size={17} /> : entry.key.includes('card') ? <ShieldAlert size={17} /> : <Activity size={17} />}
        </span>
        <span className="min-w-0 flex-1"><strong className="block truncate text-xs">{entry.side === 'home' ? home : away}</strong>
          <span className="block text-[11px] text-white/65">{fa ? entry.labelFa : entry.labelEn} +{entry.change}</span></span>
        <time className="shrink-0 font-mono text-[10px] text-white/55" dateTime={entry.at}>{entry.minute == null ? '—' : entry.minute + '′'}</time>
      </div>) : <p className="p-6 text-center text-xs text-white/60">{fa ? 'تغییرات آمار از زمانی که صفحه باز شده اینجا ثبت می‌شود.' : 'Changes received since opening this page will appear here.'}</p>}
      <p className="text-center text-[10px] leading-4 text-white/50">{fa ? 'این فهرست تغییر شمارنده‌هاست؛ گزارش رسمی لحظه وقوع رویداد نیست.' : 'This is a counter-change log, not an official timestamped incident feed.'}</p>
    </div>}

    {view === 'momentum' && <div role="tabpanel" className="p-3 sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-2"><strong className="text-xs">{fa ? 'تغییر فشار حملات' : 'Attacking pressure trend'}</strong>
        <span className="text-[10px] text-white/55">{fa ? 'در همین بازدید' : 'This session'}</span></div>
      {trend.length ? <div className="flex h-28 items-center gap-1 rounded-xl border border-white/10 bg-white/[.035] p-3" role="img" aria-label={fa ? 'نمودار روند حملات' : 'Attacking pressure trend chart'}>
        {trend.map(point => {
          const p = percent(point.home, point.away);
          return <div key={point.id} className="flex h-full min-w-0 flex-1 flex-col justify-end gap-0.5">
            {p == null ? <div className="h-1 w-full bg-white/15" /> : <>
              <div className="min-h-[2px] w-full rounded-t-sm bg-[#35DC9A] transition-[height] duration-700" style={{ height: p + '%' }}/>
              <div className="min-h-[2px] w-full rounded-b-sm bg-[#F6BD5A]" style={{ height: (100 - p) + '%' }}/>
            </>}
          </div>;
        })}
      </div> : <p className="rounded-xl border border-white/10 bg-white/[.035] p-6 text-center text-xs text-white/60">
        {fa ? 'نمودار پس از دریافت چند به‌روزرسانی واقعی شکل می‌گیرد.' : 'A trend will appear as live provider updates arrive.'}
      </p>}
      <div className="mt-3 grid grid-cols-2 gap-2">{summaryKeys.slice(0, 4).map(key => {
        const line = stat(key);
        return <div key={key} className="rounded-lg bg-white/[.055] px-3 py-2 text-center">
          <p className="text-[10px] text-white/55">{nameFor(line, fa, key)}</p><p className="mt-1 font-mono text-xs font-bold tabular-nums">{line?.home ?? '—'} : {line?.away ?? '—'}</p>
        </div>;
      })}</div>
    </div>}

    <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 bg-[#0B202A] px-3 py-2 text-[10px] text-white/50">
      <span className="flex items-center gap-1"><Radio size={12}/>{fa ? 'داده‌های تأییدشده تأمین‌کننده' : 'Provider-reported data'}</span>
      <span>{fa ? 'آخرین دریافت' : 'Last received'}: {lastSeen}</span>
    </footer>
  </section>;
}
