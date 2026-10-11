'use client';
import Link from 'next/link';

import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useApp } from '@/components/layout/providers';
import { EmptyState, Skeleton, ErrorNote } from '@/components/ui/primitives';
import { apiRequest, useApiQuery } from '@/lib/hooks/useApi';
import { formatDateTime, formatMinor, formatOddsScaled } from '@/lib/i18n';

interface MatchInfo {
  leagueName: string | null;
  leagueLogoUrl: string | null;
  homeTeamName: string | null;
  homeTeamShortName: string | null;
  homeTeamLogoUrl: string | null;
  awayTeamName: string | null;
  awayTeamShortName: string | null;
  awayTeamLogoUrl: string | null;
  scheduledAt: string | null;
  status: string | null;
  clock: string | null;
  minute: number | null;
  period: string | null;
  homeScore: number | null;
  awayScore: number | null;
  venue: string | null;
}

interface BetLeg {
  id: string;
  matchId: string;
  matchLabel: string;
  marketLabel: string;
  selectionLabel: string;
  oddsAtPlacementScaled: string;
  acceptedOddsScaled: string | null;
  status: string;
  grade: string | null;
  match: MatchInfo;
}

interface BetRow {
  id: string;
  publicId: string;
  type: string;
  status: string;
  currency: string;
  stakeMinor: string;
  potentialPayoutMinor: string;
  settledPayoutMinor: string | null;
  netResultMinor: string | null;
  combinedOddsScaled: string;
  placedAt: string;
  settledAt: string | null;
  revision: number;
  isCashoutAvailable: boolean;
  legs: BetLeg[];
}

function normalize(value: string | null | undefined) {
  return String(value ?? '').toUpperCase().replace(/-/g, '_');
}

function gradeLabel(value: string | null | undefined) {
  switch (normalize(value)) {
    case 'WON': return 'WIN';
    case 'LOST': return 'LOSS';
    case 'VOID':
    case 'REFUNDED': return 'VOID';
    case 'HALF_WON': return 'HALF WIN';
    case 'HALF_LOST': return 'HALF LOSS';
    case 'MANUAL_REVIEW':
    case 'PENDING_REVIEW': return 'REVIEW';
    default: return value ?? 'PENDING';
  }
}

function betResult(bet: BetRow) {
  if (bet.status === 'cashed_out') return 'CASH OUT';
  if (['cancelled', 'refunded', 'void'].includes(bet.status)) return 'REFUNDED';
  if (bet.status === 'manual_review') return 'REVIEW';
  if (!['settled', 'partially_settled'].includes(bet.status)) return null;

  const grades = bet.legs.map((leg) => normalize(leg.grade ?? leg.status));
  if (grades.some((g) => ['MANUAL_REVIEW', 'PENDING_REVIEW'].includes(g))) return 'REVIEW';
  if (grades.some((g) => g === 'HALF_WON')) return 'HALF WIN';
  if (grades.some((g) => g === 'HALF_LOST')) return 'HALF LOSS';
  if (grades.length && grades.every((g) => g === 'WON')) return 'WIN';
  if (grades.some((g) => g === 'LOST')) return 'LOSS';
  if (grades.length && grades.every((g) => ['VOID', 'REFUNDED'].includes(g))) return 'REFUNDED';
  return null;
}

function betStatusLabel(result: string | null, status: string, locale: string) {
  const fa = locale.startsWith('fa');
  if (result === 'WIN') return fa ? 'برنده' : 'WIN';
  if (result === 'LOSS') return fa ? 'باخت' : 'LOSS';
  if (result === 'REFUNDED') return fa ? 'برگشت وجه' : 'VOID';
  if (result === 'CASH OUT') return fa ? 'کش‌اوت' : 'CASH OUT';
  if (result === 'REVIEW') return fa ? 'بررسی' : 'REVIEW';
  if (result === 'HALF WIN') return fa ? 'نیم‌برد' : 'HALF WIN';
  if (result === 'HALF LOSS') return fa ? 'نیم‌باخت' : 'HALF LOSS';
  if (status === 'accepted') return fa ? 'باز' : 'OPEN';
  if (status === 'settled') return fa ? 'تسویه‌شده' : 'SETTLED';
  if (status === 'partially_settled') return fa ? 'تسویه ناقص' : 'PARTIAL';
  return status.replaceAll('_', ' ').toUpperCase();
}
function resultClass(value: string | null) {
  if (value === 'WIN' || value === 'CASH OUT') return 'text-nova-primary';
  if (value === 'LOSS') return 'text-red-400';
  if (value === 'REFUNDED' || value?.includes('HALF') || value === 'REVIEW') return 'text-amber-400';
  return 'text-nova-text';
}

function TeamLogo({ url, name }: { url: string | null; name: string }) {
  if (url) {
    return <img src={url} alt="" loading="lazy" className="h-10 w-10 shrink-0 object-contain" />;
  }
  return (
    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#F0F2F4] text-xs font-black text-[#8A929B] dark:bg-white/10">
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

function matchState(match: MatchInfo) {
  const status = normalize(match.status);
  if (status === 'LIVE' || status === 'IN_PLAY') {
    return match.clock ?? (match.minute != null ? `${match.minute}'` : 'LIVE');
  }
  if (status === 'FINISHED' || status === 'COMPLETED') return 'FT';
  return null;
}

function legStateClass(value: string | null | undefined) {
  const state = normalize(value);
  if (state === 'WON') return 'border-nova-primary/30 bg-nova-primary/10 text-nova-primary';
  if (state === 'LOST') return 'border-red-500/20 bg-red-500/10 text-red-500';
  if (state === 'VOID' || state === 'REFUNDED') return 'border-amber-500/20 bg-amber-500/10 text-amber-500';
  if (state === 'HALF_WON' || state === 'HALF_LOST') return 'border-amber-500/20 bg-amber-500/10 text-amber-500';
  return 'border-nova-line bg-white/60 nova-muted dark:bg-white/5';
}

function legStateIcon(value: string | null | undefined) {
  const state = normalize(value);
  if (state === 'WON') return '✓';
  if (state === 'LOST') return '×';
  if (state === 'VOID' || state === 'REFUNDED') return '↺';
  if (state === 'HALF_WON' || state === 'HALF_LOST') return '½';
  return '•';
}

export function MyBetsClient() {
  const { t, locale, session } = useApp();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<'all' | 'open' | 'won' | 'lost'>('all');
  const [type, setType] = useState<'ALL' | 'SINGLE' | 'MULTIPLE'>('ALL');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const [cashout, setCashout] = useState<{
    betId: string;
    offerMinor: string | null;
    available: boolean;
    reason?: string;
    quoteId?: string;
  } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const highlight = searchParams.get('highlight');

  const path = session?.authenticated ? `/api/v1/bets?page=1&pageSize=100` : null;
  const { data, loading, error, reload } = useApiQuery<{
    items: BetRow[];
    total: number;
    page: number;
    pageSize: number;
  }>(path);

  const rows = useMemo(() => data?.items ?? [], [data]);
  const openCount = useMemo(() => rows.filter((bet) => bet.status === "accepted").length, [rows]);
  const wonCount = useMemo(() => rows.filter((bet) => betResult(bet) === "WIN").length, [rows]);
  const lostCount = useMemo(() => rows.filter((bet) => betResult(bet) === "LOSS").length, [rows]);
  const visibleRows = useMemo(() => {
    if (tab === "open") return rows.filter((bet) => bet.status === "accepted");
    if (tab === "won") return rows.filter((bet) => betResult(bet) === "WIN");
    if (tab === "lost") return rows.filter((bet) => betResult(bet) === "LOSS");
    return rows;
  }, [rows, tab]);

  if (!session?.authenticated) {
    return (
      <section className="space-y-5 pb-2">
        <div className="relative overflow-hidden rounded-[24px] border border-[#173B35] bg-[#06101F] shadow-[0_22px_50px_rgba(2,8,23,.24)]">
          <div className="absolute -right-28 -top-28 h-80 w-80 rounded-full bg-[#00D47A]/[0.12] blur-[85px]" />
          <div className="absolute -bottom-32 -left-24 h-80 w-80 rounded-full bg-[#087FF5]/[0.08] blur-[90px]" />

          <div className="relative grid items-center gap-4 px-5 py-6 sm:px-8 sm:py-8 lg:grid-cols-[1fr_410px] lg:px-9 lg:py-7">
            <div className="relative z-10 max-w-[570px]">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#00D47A]/25 bg-[#00D47A]/[0.08] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-[#00D47A]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#00D47A] shadow-[0_0_10px_rgba(0,212,122,.8)]" />
                Your betting journey
              </div>

              <h2 className="text-[30px] font-black leading-[1.03] tracking-[-0.04em] text-white sm:text-[40px]">
                All your bets
                <span className="block text-[#00D47A]">in one place</span>
              </h2>

              <p className="mt-4 max-w-[500px] text-[14px] font-medium leading-6 text-[#9AA6B7] sm:text-[15px]">
                Log in to view your active bets, follow live results and check your complete betting history.
              </p>

              <div className="mt-5 flex max-w-[500px] flex-col gap-2.5 sm:flex-row">
                <a
                  href="/auth/login"
                  className="flex min-h-[50px] flex-1 items-center justify-center rounded-[15px] bg-[#00D47A] px-5 text-sm font-black text-[#04130D] shadow-[0_10px_28px_rgba(0,212,122,.20)] transition hover:bg-[#12E68B] active:scale-[.98]"
                >
                  {t("nav.login")}
                </a>
                <a
                  href="/auth/register"
                  className="flex min-h-[50px] flex-1 items-center justify-center rounded-[15px] border border-[#25334A] bg-[#111B2D] px-5 text-sm font-black text-white transition hover:border-[#00D47A]/40 hover:bg-[#172338] active:scale-[.98]"
                >
                  Create an account
                </a>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-[410px] lg:-mr-4">
              <svg viewBox="0 0 460 390" className="block h-auto w-full drop-shadow-[0_24px_45px_rgba(0,212,122,.12)]" role="img" aria-label="Betting dashboard illustration">
                <defs>
                  <linearGradient id="betHeroBg" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#071C20" />
                    <stop offset="55%" stopColor="#071426" />
                    <stop offset="100%" stopColor="#031019" />
                  </linearGradient>
                  <linearGradient id="betHeroGlow" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#00D47A" stopOpacity=".65" />
                    <stop offset="100%" stopColor="#00D47A" stopOpacity="0" />
                  </linearGradient>
                  <filter id="betHeroBlur">
                    <feGaussianBlur stdDeviation="18" />
                  </filter>
                </defs>

                <ellipse cx="310" cy="205" rx="150" ry="120" fill="#00D47A" opacity=".10" filter="url(#betHeroBlur)" />
                <path d="M250 65 C335 15 430 55 455 125" fill="none" stroke="url(#betHeroGlow)" strokeWidth="3" opacity=".8" />
                <path d="M215 310 C305 345 385 320 455 250" fill="none" stroke="#00D47A" strokeWidth="2" opacity=".22" />

                <g transform="translate(245 18) rotate(8 90 175)">
                  <rect x="0" y="0" width="174" height="342" rx="28" fill="#07101C" stroke="#24364A" strokeWidth="2" />
                  <rect x="10" y="11" width="154" height="320" rx="21" fill="url(#betHeroBg)" />
                  <rect x="58" y="20" width="58" height="7" rx="4" fill="#27364A" />

                  <text x="24" y="58" fill="#00D47A" fontSize="16" fontWeight="900">BET66</text>
                  <rect x="23" y="72" width="128" height="32" rx="10" fill="#102034" />
                  <text x="34" y="92" fill="#A8B4C5" fontSize="9" fontWeight="700">MY BETS</text>
                  <text x="116" y="92" fill="#00D47A" fontSize="9" fontWeight="800">LIVE</text>

                  <rect x="23" y="116" width="128" height="63" rx="12" fill="#0E1B2B" stroke="#1D3143" />
                  <circle cx="37" cy="134" r="5" fill="#00D47A" />
                  <text x="49" y="137" fill="#B7C1CE" fontSize="8" fontWeight="700">WON</text>
                  <text x="128" y="137" textAnchor="end" fill="#FFFFFF" fontSize="10" fontWeight="900">2.35</text>
                  <text x="34" y="157" fill="#68788D" fontSize="7">12 Dec, 18:24</text>
                  <text x="128" y="157" textAnchor="end" fill="#00D47A" fontSize="8" fontWeight="800">$120.00</text>

                  <rect x="23" y="190" width="128" height="63" rx="12" fill="#0E1B2B" stroke="#1D3143" />
                  <circle cx="37" cy="208" r="5" fill="#FF5B5B" />
                  <text x="49" y="211" fill="#B7C1CE" fontSize="8" fontWeight="700">LIVE</text>
                  <text x="128" y="211" textAnchor="end" fill="#FFFFFF" fontSize="10" fontWeight="900">1.80</text>
                  <text x="34" y="231" fill="#68788D" fontSize="7">2nd Half 73&apos;</text>
                  <text x="128" y="231" textAnchor="end" fill="#B7C1CE" fontSize="8" fontWeight="800">$50.00</text>

                  <rect x="23" y="264" width="128" height="50" rx="12" fill="#0E1B2B" stroke="#1D3143" />
                  <circle cx="37" cy="281" r="5" fill="#00D47A" />
                  <text x="49" y="284" fill="#B7C1CE" fontSize="8" fontWeight="700">SETTLED</text>
                  <text x="128" y="284" textAnchor="end" fill="#FFFFFF" fontSize="10" fontWeight="900">4.20</text>
                  <text x="34" y="301" fill="#68788D" fontSize="7">Won • $75.00</text>
                </g>

                <g transform="translate(44 255)">
                  <circle cx="47" cy="47" r="47" fill="#071725" stroke="#183A3D" strokeWidth="2" />
                  <circle cx="47" cy="47" r="39" fill="#0B2430" />
                  <path d="M25 36 L39 26 L55 30 L68 43 L62 60 L45 68 L28 57 Z" fill="none" stroke="#00D47A" strokeWidth="2.5" opacity=".8" />
                  <path d="M39 26 L45 43 L68 43 M45 43 L45 68 M45 43 L28 57" fill="none" stroke="#00D47A" strokeWidth="2" opacity=".65" />
                </g>

                <g transform="translate(118 58)">
                  <path d="M20 35 L36 18 L58 23 L66 43 L49 57 L28 52 Z" fill="none" stroke="#00D47A" strokeWidth="3" opacity=".75" />
                  <path d="M36 18 L41 36 L66 43 M41 36 L28 52" fill="none" stroke="#00D47A" strokeWidth="2" opacity=".55" />
                </g>

                <text x="78" y="195" fill="#00D47A" fontSize="12" fontWeight="900" letterSpacing="2">MORE THAN A BET</text>
              </svg>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { icon: "▥", title: "Track your bets", text: "View active and settled bets" },
            { icon: "◷", title: "Live updates", text: "Follow your bets in real time" },
            { icon: "≡", title: "Full history", text: "Check results and settlements" },
            { icon: "●", title: "Get notified", text: "Stay updated on your bets" },
          ].map((item) => (
            <div key={item.title} className="rounded-[18px] border border-[#17243A] bg-[#0B1627] px-4 py-5 text-center shadow-[0_6px_20px_rgba(15,23,42,.035)]">
              <div className="mx-auto grid h-11 w-11 place-items-center rounded-[14px] border border-[#00D47A]/15 bg-[#00D47A]/[0.08] text-lg font-black text-[#00D47A]">
                {item.icon}
              </div>
              <h3 className="mt-3 text-[13px] font-black text-white">{item.title}</h3>
              <p className="mt-1 text-[11px] font-medium leading-5 text-[#8E9AAF]">{item.text}</p>
            </div>
          ))}
        </div>

        <div className="relative overflow-hidden rounded-[20px] border border-[#173B35] bg-gradient-to-r from-[#071F1A] to-[#0A1424] px-5 py-5 sm:px-7">
          <div className="absolute -right-10 -top-16 h-36 w-36 rounded-full bg-[#00D47A]/[0.08] blur-[45px]" />
          <div className="relative flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h3 className="text-[19px] font-black tracking-tight text-white">Join BET66 today</h3>
              <p className="mt-1 text-[12px] font-medium text-[#9AA6B7]">Fast registration, secure betting and a better experience.</p>
            </div>
            <a
              href="/auth/register"
              className="inline-flex min-h-[46px] items-center justify-center rounded-[14px] bg-[#00D47A] px-6 text-sm font-black text-[#04130D] shadow-[0_8px_20px_rgba(0,212,122,.16)] transition hover:bg-[#12E68B]"
            >
              Create an account
            </a>
          </div>
        </div>
      </section>
    );
  }

  const requestCashout = async (bet: BetRow) => {
    try {
      const result = await apiRequest<{
        quote: { offerMinor: string | null; available: boolean; reason?: string; quoteId?: string };
      }>(`/api/v1/bets/${bet.id}/cashout`);
      setCashout({ betId: bet.id, ...result.quote });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t('common.error'));
    }
  };

  const acceptCashout = async () => {
    if (!cashout?.quoteId) return;
    try {
      await apiRequest(`/api/v1/bets/${cashout.betId}/cashout?quoteId=${cashout.quoteId}`, {
        method: 'POST',
        idempotencyKey: crypto.randomUUID(),
      });
      setCashout(null);
      await reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t('common.error'));
    }
  };

  const copyBetId = async (id: string) => {
    try {
      await navigator.clipboard.writeText(id);
      setCopied(id);
      window.setTimeout(() => setCopied(null), 1400);
    } catch {}
  };

  const shareBet = async (bet: BetRow) => {
    const shareUrl = `${window.location.origin}/bets?highlight=${encodeURIComponent(bet.publicId)}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `NOVA ${bet.publicId}`,
          text: `${bet.type} · ${bet.publicId}`,
          url: shareUrl,
        });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(`${bet.publicId}:share`);
        window.setTimeout(() => setCopied(null), 1400);
      }
    } catch {}
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {([
            { key: "all" as const, label: locale.startsWith("fa") ? "همه" : "All", count: rows.length },
            { key: "open" as const, label: locale.startsWith("fa") ? "باز" : "Open", count: openCount },
            { key: "won" as const, label: locale.startsWith("fa") ? "برنده" : "Won", count: wonCount },
            { key: "lost" as const, label: locale.startsWith("fa") ? "باخته" : "Lost", count: lostCount },
          ]).map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={`inline-flex h-10 items-center gap-2 rounded-full border px-4 text-xs font-black transition active:scale-[.98] ${
                tab === item.key
                  ? "border-[#101820] bg-[#101820] text-white shadow-[0_5px_16px_rgba(16,24,32,.14)]"
                  : "border-[#D9DEE5] bg-white text-[#4F5D70] hover:border-[#B8C0CB] hover:bg-[#F7F8FA]"
              }`}
            >
              <span>{item.label}</span>
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                tab === item.key ? "bg-white/15 text-white" : "bg-[#EEF1F4] text-[#657286]"
              }`}>
                {item.count}
              </span>
            </button>
          ))}
        </div>
        <button
          type="button"
          className="inline-flex h-10 items-center justify-center gap-2 self-start rounded-xl border border-[#D9DEE5] bg-white px-4 text-xs font-black text-[#273344] shadow-[0_3px_12px_rgba(15,23,42,.04)]"
        >
          <span className="text-base leading-none">↕</span>
          {locale.startsWith("fa") ? "جدیدترین" : "Newest"}
          <span className="text-sm">⌄</span>
        </button>
      </div>
      <ErrorNote
        message={actionError ?? error}
        retryLabel=""
      />

      <ErrorNote
        message={actionError ?? error}
        retryLabel=""
      />

      {cashout ? (
        <div className="nova-card border-nova-primary/40 bg-nova-primary/10 p-3 text-sm">
          {cashout.available ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>
                {t('bets.cashoutOffer')}:{' '}
                <strong>
                  {cashout.offerMinor
                    ? formatMinor(cashout.offerMinor, session.user?.currency ?? 'IRT', locale)
                    : '—'}
                </strong>
              </span>
              <div className="flex gap-2">
                <button type="button" className="nova-btn-primary !py-1 text-xs" onClick={() => void acceptCashout()}>
                  {t('common.confirm')}
                </button>
                <button type="button" className="nova-btn-ghost !py-1 text-xs" onClick={() => setCashout(null)}>
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          ) : (
            <span>{cashout.reason ?? 'Cash-out unavailable'}</span>
          )}
        </div>
      ) : null}

      {loading && rows.length === 0 ? (
        <div className="space-y-2">
          {[0, 1, 2].map((index) => <Skeleton key={index} className="h-56 w-full" />)}
        </div>
      ) : rows.length === 0 ? (
        <div className="flex min-h-[52vh] flex-col items-center justify-center rounded-[24px] bg-[#071021] px-4 py-10 text-center"><div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#24324A] bg-[#0B1627]"><svg viewBox="0 0 24 24" className="h-7 w-7 text-[#00D47A]" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M6 3.5h9l3 3v14H6z"/><path d="M15 3.5v4h4M9 12h6M9 16h4"/></svg></div><h2 className="text-xl font-black text-white">You haven&apos;t placed any bets yet</h2><p className="mt-2 max-w-sm text-sm text-[#9AA6B7]">Explore sports, choose your picks, and place your first bet.</p><Link href="/sports/football" className="mt-5 inline-flex h-11 items-center justify-center rounded-xl bg-[#00D47A] px-6 text-sm font-black text-[#03130D] transition hover:bg-[#16E58E]">Explore sports <span className="ml-2">→</span></Link></div>
      ) : (
        <div className="space-y-2">
          {visibleRows.map((bet, index) => {
            const first = bet.legs[0]?.match;
            const result = betResult(bet);
            const isExpanded = index === 0 || Boolean(expanded[bet.id]) || highlight === bet.publicId;
            const settledCount = bet.legs.filter((leg) => ['WON','LOST','VOID','REFUNDED','HALF_WON','HALF_LOST'].includes(normalize(leg.grade))).length;

            return (
              <article
                key={bet.id}
                data-testid="bet-row"
                className={`nova-card overflow-hidden border-[#E0E5EA] bg-white text-[#101820] shadow-[0_8px_28px_rgba(15,23,42,.08)] ${highlight === bet.publicId ? "border-nova-primary ring-2 ring-nova-primary/20" : "border-[#E0E5EA]"}`}
              >
                <div
                  className={`border-b border-[#E7EBEF] bg-white px-3 py-3 sm:px-4 sm:py-3.5 select-none ${index === 0 ? "" : "cursor-pointer hover:bg-[#FAFBFC]"}`}
                  role="button"
                  tabIndex={index === 0 ? -1 : 0}
                  aria-expanded={isExpanded}
                  onClick={() => {
                    if (index !== 0) {
                      setExpanded((value) => ({ ...value, [bet.id]: !isExpanded }));
                    }
                  }}
                  onKeyDown={(event) => {
                    if (index !== 0 && (event.key === "Enter" || event.key === " ")) {
                      event.preventDefault();
                      setExpanded((value) => ({ ...value, [bet.id]: !isExpanded }));
                    }
                  }}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center rounded-full border border-[#DCE2E8] bg-[#F1F4F6] px-2.5 py-1 text-[11px] font-black text-[#111820]`}>{betStatusLabel(result, bet.status, locale)}</span>
                      <span className="nova-chip">{bet.type}</span>
                      <span className="text-xs text-slate-400">{formatDateTime(bet.placedAt, locale)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <strong className={`text-xs font-black ${resultClass(result)}`}>
                        {result ?? (bet.status === "accepted" ? "OPEN" : bet.status.replaceAll("_", " ").toUpperCase())}
                      </strong>
                      <span className="grid h-7 w-7 place-items-center rounded-full border border-[#DCE2E8] bg-[#F7F8FA] text-sm font-black text-[#273344]">
                        {isExpanded ? "⌃" : "⌄"}
                      </span>
                    </div>
                  </div>

                  <div className="mt-1.5 flex flex-wrap items-center justify-between gap-1.5">
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[#DCE2E8] bg-[#F4F6F8]">
                        {first?.leagueLogoUrl
                          ? <img src={first.leagueLogoUrl} alt="" loading="lazy" className="h-7 w-7 object-contain" />
                          : <span className="text-[10px] font-black nova-muted">SP</span>}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-xs font-bold">{first?.leagueName ?? 'Sports'}</div>
                        <div className="truncate text-[11px] text-slate-400">{first?.venue ?? (locale.startsWith('fa') ? 'مسابقه' : 'Match')}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-[#68768A]">
                      <span>{bet.legs.length} {bet.legs.length === 1 ? 'Selection' : 'Selections'}</span>
                      {bet.type === 'MULTIPLE' ? <span>{settledCount}/{bet.legs.length} {locale.startsWith('fa') ? 'تسویه' : 'settled'}</span> : null}
                      <button
                        type="button"
                        className="nova-btn-ghost !px-2 !py-1 text-[11px] text-[#536276]"
                        onClick={(event) => { event.stopPropagation(); void copyBetId(bet.publicId); }}
                      >
                        {copied === bet.publicId ? (locale.startsWith('fa') ? 'کپی شد' : 'Copied') : bet.publicId}
                      </button>
                    </div>
                  </div>
                </div>

                {isExpanded ? (
                  <> 
                    <div className="divide-y divide-[#E8ECF0] bg-white text-[#101820]">
                  {bet.legs.map((leg) => {
                    const match = leg.match;
                    const live = matchState(match);
      const isLive = ["LIVE", "IN_PLAY"].includes(normalize(match.status));

                    return (
                      <div key={leg.id} className="p-2.5 sm:p-3">
                        <div className="mb-2 flex items-center justify-between gap-2 text-[11px] text-[#68768A]">
                          <span className="truncate">{match.leagueName ?? (locale.startsWith('fa') ? 'مسابقه' : 'Match')}</span>
                          <span className="shrink-0">
                            {live
                              ? <strong className="text-red-400">{live}</strong>
                              : match.scheduledAt
                                ? formatDateTime(match.scheduledAt, locale)
                                : '—'}
                          </span>
                        </div>

                        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5 sm:gap-4">
                          <div className="flex min-w-0 items-center gap-2">
                            <TeamLogo url={match.homeTeamLogoUrl} name={match.homeTeamName ?? 'H'} />
                            <div className="min-w-0">
                              <div className="truncate text-sm font-extrabold text-white">{match.homeTeamName ?? 'Home'}</div>
                              {match.homeScore != null ? <div className="text-base font-black">{match.homeScore}</div> : null}
                            </div>
                          </div>

                          <div className="text-center">
                            <div className="text-[10px] font-black nova-muted">{isLive ? <span className="text-red-400">LIVE{match.minute != null ? ` · ${match.minute}'` : live ? ` · ${live}` : ''}</span> : (live ?? 'VS')}</div>
                            {match.period ? <div className="text-[10px] nova-muted">{match.period}</div> : null}
                          </div>

                          <div className="flex min-w-0 items-center justify-end gap-2 text-right">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-extrabold text-white">{match.awayTeamName ?? 'Away'}</div>
                              {match.awayScore != null ? <div className="text-base font-black">{match.awayScore}</div> : null}
                            </div>
                            <TeamLogo url={match.awayTeamLogoUrl} name={match.awayTeamName ?? 'A'} />
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-[#151E2D] p-1.5">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border text-xs font-black ${legStateClass(leg.grade ?? leg.status)}`}>
                              {legStateIcon(leg.grade ?? leg.status)}
                            </span>
                            <div className="min-w-0">
                              <div className="truncate text-sm font-extrabold text-white">{leg.selectionLabel}</div>
                              <div className="truncate text-[11px] text-slate-400">
                                {leg.marketLabel} · {gradeLabel(leg.grade ?? leg.status)}
                              </div>
                            </div>
                          </div>
                          <strong className="rounded-lg border border-nova-primary/25 bg-nova-primary/10 px-2 py-1 text-sm font-black text-nova-primary shadow-sm">
                            @ {formatOddsScaled(leg.acceptedOddsScaled ?? leg.oddsAtPlacementScaled)}
                          </strong>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="grid grid-cols-2 gap-px border-t border-white/10 bg-white/10 sm:grid-cols-4">
                  <div className="bg-[#0B111C] p-2">
                    <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{locale.startsWith('fa') ? 'مبلغ شرط' : 'Stake'}</div>
                    <strong className="text-sm font-black text-white">{formatMinor(bet.stakeMinor, bet.currency, locale)}</strong>
                  </div>
                  <div className="bg-[#0B111C] p-2">
                    <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{locale.startsWith('fa') ? 'ضریب کل' : 'Total odds'}</div>
                    <strong className="text-sm font-black text-white">{formatOddsScaled(bet.combinedOddsScaled)}</strong>
                  </div>
                  <div className="bg-[#0B111C] p-2">
                    <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                      {bet.settledPayoutMinor !== null ? 'Payout' : 'Potential payout'}
                    </div>
                    <strong className={`text-sm font-black ${bet.settledPayoutMinor !== null ? 'text-nova-primary' : 'text-white'}`}>
                      {formatMinor(bet.settledPayoutMinor ?? bet.potentialPayoutMinor, bet.currency, locale)}
                    </strong>
                  </div>
                  <div className="bg-[#0B111C] p-2">
                    <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{locale.startsWith('fa') ? 'سود/زیان خالص' : 'Net result'}</div>
                    <strong className={`text-sm ${bet.netResultMinor !== null && BigInt(bet.netResultMinor) > 0n ? 'text-nova-primary' : ''}`}>
                      {bet.netResultMinor === null ? '—' : formatMinor(bet.netResultMinor, bet.currency, locale)}
                    </strong>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#1E2936] bg-[#101820] p-3">
                  <button
                    type="button"
                    className="nova-btn-ghost !py-1 text-xs"
                    onClick={() => setExpanded((value) => ({ ...value, [bet.id]: !isExpanded }))}
                  >
                    {isExpanded ? (locale.startsWith('fa') ? 'بستن جزئیات' : 'Hide details') : (locale.startsWith('fa') ? 'مشاهده جزئیات' : 'View details')}
                  </button>

                  <div className="flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      className="nova-btn-ghost !py-1 text-xs"
                      onClick={() => void shareBet(bet)}
                    >
                      {copied === `${bet.publicId}:share`
                        ? (locale.startsWith('fa') ? 'لینک کپی شد' : 'Link copied')
                        : (locale.startsWith('fa') ? 'اشتراک' : 'Share')}
                    </button>
                    {bet.isCashoutAvailable && bet.status === 'accepted' ? (
                      <button type="button" className="nova-btn-primary !py-1 text-xs" onClick={() => void requestCashout(bet)}>
                        {t('bets.cashout')}
                      </button>
                    ) : null}

                    {bet.legs[0]?.matchId ? (
                      <a className="nova-btn-ghost !py-1 text-xs" href={`/match/${bet.legs[0].matchId}`}>
                        {locale.startsWith('fa') ? 'مسابقه' : 'Match'}
                      </a>
                    ) : null}
                  </div>
                </div>

                {isExpanded ? (
                  <div className="border-t border-[#E2E7EC] bg-[#F7F8FA] p-3 sm:p-4">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <div>
                        <div className="text-sm font-extrabold text-white">
                          {locale.startsWith('fa') ? 'جزئیات برگه پیش‌بینی' : 'Bet details'}
                        </div>
                        <div className="mt-0.5 text-[11px] text-slate-500">
                          {locale.startsWith('fa') ? 'اطلاعات کامل ثبت و تسویه' : 'Complete placement and settlement information'}
                        </div>
                      </div>
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-black text-slate-400">
                        {bet.type}
                      </span>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                        <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{locale.startsWith('fa') ? 'شماره شرط' : 'Bet ID'}</div>
                        <div className="mt-1 break-all text-xs font-extrabold text-white">{bet.publicId}</div>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                        <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{locale.startsWith('fa') ? 'وضعیت' : 'Status'}</div>
                        <div className={`mt-1 text-xs font-extrabold ${resultClass(result)}`}>
                          {result ?? (bet.status === 'accepted' ? (locale.startsWith('fa') ? 'باز' : 'OPEN') : bet.status.replaceAll('_', ' ').toUpperCase())}
                        </div>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                        <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{locale.startsWith('fa') ? 'نسخه' : 'Revision'}</div>
                        <div className="mt-1 text-xs font-extrabold text-white">{bet.revision}</div>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                        <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{locale.startsWith('fa') ? 'ثبت شده' : 'Placed'}</div>
                        <div className="mt-1 text-xs font-extrabold text-white">{formatDateTime(bet.placedAt, locale)}</div>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 sm:col-span-2">
                        <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{locale.startsWith('fa') ? 'تسویه' : 'Settled'}</div>
                        <div className="mt-1 text-xs font-extrabold text-white">
                          {bet.settledAt ? formatDateTime(bet.settledAt, locale) : (locale.startsWith('fa') ? 'در انتظار' : 'Pending')}
                        </div>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                        <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{locale.startsWith('fa') ? 'مبلغ شرط' : 'Stake'}</div>
                        <div className="mt-1 text-xs font-extrabold text-white">{formatMinor(bet.stakeMinor, bet.currency, locale)}</div>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                        <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{locale.startsWith('fa') ? 'ضریب کل' : 'Total odds'}</div>
                        <div className="mt-1 text-xs font-extrabold text-nova-primary">{formatOddsScaled(bet.combinedOddsScaled)}</div>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                        <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                          {bet.settledPayoutMinor !== null ? (locale.startsWith('fa') ? 'پرداختی' : 'Payout') : (locale.startsWith('fa') ? 'برد احتمالی' : 'Potential payout')}
                        </div>
                        <div className="mt-1 text-xs font-extrabold text-white">
                          {formatMinor(bet.settledPayoutMinor ?? bet.potentialPayoutMinor, bet.currency, locale)}
                        </div>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                        <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{locale.startsWith('fa') ? 'سود/زیان خالص' : 'Net result'}</div>
                        <div className={`mt-1 text-xs font-extrabold ${bet.netResultMinor !== null && BigInt(bet.netResultMinor) > 0n ? 'text-nova-primary' : bet.netResultMinor !== null && BigInt(bet.netResultMinor) < 0n ? 'text-red-400' : 'text-white'}`}>
                          {bet.netResultMinor === null ? '—' : formatMinor(bet.netResultMinor, bet.currency, locale)}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4">
                      <div className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                        {locale.startsWith('fa') ? 'انتخاب‌ها و نتایج' : 'Selections & results'}
                      </div>
                      <div className="space-y-2">
                        {bet.legs.map((leg) => {
                          const match = leg.match;
                          const grade = normalize(leg.grade ?? leg.status);
                          const gradeTone =
                            grade === 'WON'
                              ? 'border-nova-primary/20 bg-nova-primary/10 text-nova-primary'
                              : grade === 'LOST'
                                ? 'border-red-500/20 bg-red-500/10 text-red-400'
                                : grade === 'VOID' || grade === 'REFUNDED'
                                  ? 'border-amber-500/20 bg-amber-500/10 text-amber-400'
                                  : 'border-white/10 bg-white/[0.04] text-slate-300';

                          return (
                            <div key={leg.id} className="rounded-2xl border border-white/10 bg-white/[0.025] p-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex min-w-0 items-center gap-2">
                                  <TeamLogo url={match.homeTeamLogoUrl} name={match.homeTeamName ?? 'H'} />
                                  <div className="min-w-0">
                                    <div className="truncate text-xs font-extrabold text-white">
                                      {match.homeTeamName ?? 'Home'} <span className="px-1 text-slate-600">vs</span> {match.awayTeamName ?? 'Away'}
                                    </div>
                                    <div className="mt-0.5 truncate text-[10px] text-slate-500">
                                      {match.leagueName ?? 'Sports'} · {leg.marketLabel}
                                    </div>
                                  </div>
                                  <TeamLogo url={match.awayTeamLogoUrl} name={match.awayTeamName ?? 'A'} />
                                </div>
                                <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black ${gradeTone}`}>
                                  {legStateIcon(leg.grade ?? leg.status)} {gradeLabel(leg.grade ?? leg.status)}
                                </span>
                              </div>

                              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                                <div className="rounded-lg bg-black/10 p-2">
                                  <div className="text-[9px] uppercase tracking-wide text-slate-500">{locale.startsWith('fa') ? 'انتخاب' : 'Selection'}</div>
                                  <div className="mt-0.5 truncate text-[11px] font-bold text-white">{leg.selectionLabel}</div>
                                </div>
                                <div className="rounded-lg bg-black/10 p-2">
                                  <div className="text-[9px] uppercase tracking-wide text-slate-500">{locale.startsWith('fa') ? 'ضریب ثبت' : 'Placed odds'}</div>
                                  <div className="mt-0.5 text-[11px] font-bold text-white">@ {formatOddsScaled(leg.oddsAtPlacementScaled)}</div>
                                </div>
                                <div className="rounded-lg bg-black/10 p-2">
                                  <div className="text-[9px] uppercase tracking-wide text-slate-500">{locale.startsWith('fa') ? 'ضریب پذیرفته' : 'Accepted odds'}</div>
                                  <div className="mt-0.5 text-[11px] font-bold text-nova-primary">
                                    {leg.acceptedOddsScaled ? `@ ${formatOddsScaled(leg.acceptedOddsScaled)}` : '—'}
                                  </div>
                                </div>
                                <div className="rounded-lg bg-black/10 p-2">
                                  <div className="text-[9px] uppercase tracking-wide text-slate-500">{locale.startsWith('fa') ? 'زمان بازی' : 'Match time'}</div>
                                  <div className="mt-0.5 text-[11px] font-bold text-white">
                                    {match.scheduledAt ? formatDateTime(match.scheduledAt, locale) : '—'}
                                  </div>
                                </div>
                              </div>

                              {(match.homeScore != null || match.awayScore != null) ? (
                                <div className="mt-2 flex items-center justify-center gap-2 text-[11px] font-bold text-slate-400">
                                  <span>{match.homeTeamName ?? 'Home'}</span>
                                  <strong className="rounded-md bg-white/[0.06] px-2 py-1 text-white">
                                    {match.homeScore ?? 0} - {match.awayScore ?? 0}
                                  </strong>
                                  <span>{match.awayTeamName ?? 'Away'}</span>
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}
              </article>
            );
          })}
        </div>
      )}

    </div>
  );
}
