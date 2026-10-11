'use client';

import Link from 'next/link';
import { useApp } from '@/components/layout/providers';

export function LiveEmptyState() {
  const { t, dir } = useApp();

  return (
    <div dir={dir} className="relative overflow-hidden rounded-[28px] border border-emerald-400/20 bg-[#03191d] px-4 py-8 shadow-[0_20px_80px_rgba(0,255,160,0.14)] sm:px-8 sm:py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(0,255,150,0.16),transparent_42%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(ellipse_at_center,rgba(0,255,150,0.12),transparent_68%)]" />
      <div className="relative mx-auto max-w-4xl">
        <div className="relative mx-auto mb-7 h-[260px] max-w-[760px] overflow-hidden rounded-[30px] border border-emerald-400/25 bg-[#020f16] shadow-[0_0_90px_rgba(0,255,150,0.18)]">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_58%,rgba(0,255,150,0.28),transparent_48%)]" />
          <div className="absolute inset-x-0 top-0 h-28 bg-[radial-gradient(ellipse_at_18%_0%,rgba(255,255,255,0.32),transparent_25%),radial-gradient(ellipse_at_82%_0%,rgba(255,255,255,0.32),transparent_25%)]" />
          <div className="absolute left-[4%] top-[-15px] h-36 w-20 rotate-[22deg] bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.9),transparent_62%)] opacity-45 blur-xl" />
          <div className="absolute right-[4%] top-[-15px] h-36 w-20 rotate-[-22deg] bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.9),transparent_62%)] opacity-45 blur-xl" />
          <svg viewBox="0 0 760 260" className="absolute inset-0 h-full w-full" aria-hidden="true">
            <defs>
              <linearGradient id="nova-field" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#073b38" />
                <stop offset="1" stopColor="#02181d" />
              </linearGradient>
              <linearGradient id="nova-screen" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#0b3030" />
                <stop offset="0.5" stopColor="#052023" />
                <stop offset="1" stopColor="#031318" />
              </linearGradient>
              <filter id="nova-glow">
                <feGaussianBlur stdDeviation="5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <path d="M0 205 Q380 105 760 205 L760 260 L0 260Z" fill="url(#nova-field)" />
            <path d="M55 218 Q380 135 705 218" fill="none" stroke="#0b765e" strokeWidth="2" opacity=".55" />
            <path d="M105 230 Q380 165 655 230" fill="none" stroke="#0abf82" strokeWidth="1" opacity=".35" />
            <g opacity=".55">
              <path d="M42 188 L120 135 L120 178 L42 215Z" fill="#08252b" />
              <path d="M718 188 L640 135 L640 178 L718 215Z" fill="#08252b" />
              <path d="M65 175 L145 126" stroke="#14c995" strokeWidth="2" />
              <path d="M695 175 L615 126" stroke="#14c995" strokeWidth="2" />
            </g>
            <g filter="url(#nova-glow)">
              <ellipse cx="380" cy="222" rx="205" ry="25" fill="none" stroke="#00ff9d" strokeWidth="3" opacity=".55" />
              <ellipse cx="380" cy="222" rx="155" ry="17" fill="none" stroke="#00d98a" strokeWidth="2" opacity=".7" />
            </g>
            <g>
              <rect x="258" y="72" width="244" height="112" rx="22" fill="#03151b" stroke="#0b765e" strokeWidth="2" />
              <rect x="272" y="86" width="216" height="84" rx="16" fill="url(#nova-screen)" stroke="#00d98a" strokeWidth="2" opacity=".98" />
              <path d="M288 151 H472" stroke="#0aff9d" strokeWidth="1" opacity=".25" />
              <circle cx="380" cy="104" r="5" fill="#00ff9d" filter="url(#nova-glow)" />
              <text x="380" y="137" textAnchor="middle" fill="#00ff9d" fontSize="36" fontWeight="900" letterSpacing="5">LIVE</text>
            </g>
            <g fill="#0a272d" stroke="#00c98a" strokeWidth="2">
              <rect x="146" y="92" width="62" height="62" rx="17" transform="rotate(-8 177 123)" />
              <rect x="552" y="92" width="62" height="62" rx="17" transform="rotate(8 583 123)" />
              <rect x="205" y="163" width="50" height="50" rx="15" transform="rotate(8 230 188)" />
              <rect x="505" y="163" width="50" height="50" rx="15" transform="rotate(-8 530 188)" />
            </g>
            <g fill="none" stroke="#00ff9d" strokeWidth="2.5">
              <circle cx="177" cy="123" r="18" />
              <circle cx="583" cy="123" r="18" />
              <path d="M164 123 L190 123 M177 110 L177 136" />
              <circle cx="230" cy="188" r="15" />
              <path d="M220 193 L230 180 L240 193" />
              <rect x="518" y="180" width="24" height="16" rx="3" />
            </g>
            <g fill="#00ff9d" filter="url(#nova-glow)">
              <circle cx="380" cy="34" r="4" />
              <circle cx="380" cy="222" r="4" />
              <circle cx="315" cy="48" r="3" />
              <circle cx="445" cy="48" r="3" />
            </g>
            <g fill="#00ff9d" opacity=".7">
              <path d="M380 18 l4 8 8 4-8 4-4 8-4-8-8-4 8-4z" />
              <path d="M380 235 l3 6 6 3-6 3-3 6-3-6-6-3 6-3z" />
            </g>
          </svg>
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#020f16] to-transparent" />
        </div>

        <div className="text-center">
          <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
            {t('live.emptyTitle')} <span className="text-emerald-400">{t('live.emptyAccent')}</span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
            {t('live.emptyDescription')}
            <br className="hidden sm:block" />
            {t('live.emptySecondary')}
          </p>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <Link href="/sports/football" className="flex h-14 items-center justify-center gap-3 rounded-2xl bg-emerald-400 px-5 font-bold text-slate-950 shadow-[0_0_30px_rgba(0,255,150,0.22)] transition hover:bg-emerald-300">
            <svg viewBox="0 0 64 64" className="h-6 w-6 shrink-0" aria-hidden="true">
              <circle cx="32" cy="32" r="29" fill="white" stroke="#0f172a" strokeWidth="2"/>
              <path d="M32 16l9 7-3.5 11h-11L23 23z" fill="#111827"/>
              <path d="M32 16v-6M41 23l9-3M37.5 34l6 9M26.5 34l-6 9M23 23l-9-3" fill="none" stroke="#111827" strokeWidth="3" strokeLinecap="round"/>
              <path d="M23 23l-9 8M41 23l9 8M43.5 43l-3 9M20.5 43l3 9" fill="none" stroke="#111827" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
            {t('live.exploreSports')}
            <span className="text-xl">›</span>
          </Link>
          <Link href="/sports/football" className="flex h-14 items-center justify-center gap-3 rounded-2xl border border-slate-700 bg-slate-950/60 px-5 font-bold text-white transition hover:border-emerald-400/40 hover:bg-slate-900">
            <span className="text-xl">▣</span>
            {t('live.upcomingMatches')}
            <span className="text-xl">›</span>
          </Link>
        </div>

        <div className="mt-8 grid grid-cols-3 border-t border-slate-700/70 pt-7">
          <div className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-2xl text-emerald-400">ϟ</div>
            <p className="mt-3 text-sm font-bold text-slate-300">{t('live.realtime')}</p>
            <p className="text-xs text-slate-500">{t('live.updates')}</p>
          </div>
          <div className="border-x border-slate-700/60 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-2xl text-emerald-400">▥</div>
            <p className="mt-3 text-sm font-bold text-slate-300">{t('live.bestOdds')}</p>
            <p className="text-xs text-slate-500">{t('live.inPlay')}</p>
          </div>
          <div className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-2xl text-emerald-400">◷</div>
            <p className="mt-3 text-sm font-bold text-slate-300">{t('live.wideRange')}</p>
            <p className="text-xs text-slate-500">{t('live.liveEvents')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
