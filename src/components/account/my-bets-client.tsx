'use client';

import Link from 'next/link';

import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useApp } from '@/components/layout/providers';
import { Skeleton, ErrorNote } from '@/components/ui/primitives';
import { apiRequest, useApiQuery } from '@/lib/hooks/useApi';
import { formatDateTime, formatMinor, formatOddsScaled } from '@/lib/i18n';
import { TeamLogo } from '@/components/ui/logo';

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
  if (result === 'WIN') return 'WIN';
  if (result === 'LOSS') return 'LOSS';
  if (result === 'REFUNDED') return 'VOID';
  if (result === 'CASH OUT') return 'CASH OUT';
  if (result === 'REVIEW') return 'REVIEW';
  if (result === 'HALF WIN') return 'HALF WIN';
  if (result === 'HALF LOSS') return 'HALF LOSS';
  if (status === 'accepted') return 'OPEN';
  if (status === 'settled') return 'SETTLED';
  if (status === 'partially_settled') return 'PARTIAL';
  return status.replaceAll('_', ' ').toUpperCase();
}
function resultClass(value: string | null) {
  if (value === 'WIN' || value === 'CASH OUT') return 'text-nova-primary';
  if (value === 'LOSS') return 'text-red-400';
  if (value === 'REFUNDED' || value?.includes('HALF') || value === 'REVIEW') return 'text-amber-400';
  return 'text-nova-text';
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
  const { t, locale, session, sessionLoading } = useApp();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<'open' | 'settled' | 'all'>('all');
  const [type, setType] = useState<'ALL' | 'SINGLE' | 'MULTIPLE'>('ALL');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [openTicketId, setOpenTicketId] = useState<string | null>(null);
  const [days, setDays] = useState(0);
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
  const displayRows = useMemo(() => rows.filter((bet) => {
    if (tab === 'open' && !['accepted', 'pending', 'open'].includes(bet.status)) return false;
    if (tab === 'settled' && ['accepted', 'pending', 'open'].includes(bet.status)) return false;
    if (type !== 'ALL' && bet.type.toUpperCase() !== type) return false;
    if (days > 0 && Date.parse(bet.placedAt) < Date.now() - days * 86400000) return false;
    const term = search.trim().toLocaleLowerCase();
    return !term || [bet.publicId, bet.id, ...bet.legs.flatMap((leg) => [
      leg.matchLabel, leg.selectionLabel, leg.marketLabel,
      leg.match.homeTeamName ?? '', leg.match.awayTeamName ?? ''
    ])].some((value) => value.toLocaleLowerCase().includes(term));
  }), [rows, tab, type, days, search]);

  if (sessionLoading) {
    return (
      <section className="space-y-2 pb-2">
        {[0, 1, 2].map((index) => (
          <Skeleton key={index} className="h-56 w-full" />
        ))}
      </section>
    );
  }

  if (!session?.authenticated) {
    return (
      <section className="space-y-5 pb-2">
        <div className="relative overflow-hidden rounded-[24px] border border-[#17243A] bg-[#071021] shadow-[0_22px_50px_rgba(2,8,23,.24)]">
          <div className="absolute -right-24 -top-28 h-72 w-72 rounded-full bg-[#00D47A]/[0.08] blur-[75px]" />
          <div className="absolute -bottom-32 -left-24 h-72 w-72 rounded-full bg-[#087FF5]/[0.08] blur-[80px]" />

          <div className="relative grid items-center gap-7 px-5 py-7 sm:px-8 sm:py-9 lg:grid-cols-[1fr_330px] lg:px-10">
            <div className="max-w-[600px]">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#00D47A]/20 bg-[#00D47A]/[0.08] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-[#00D47A]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#00D47A]" />
                Sign in to view your bets
              </div>

              <h2 className="text-[28px] font-black leading-[1.08] tracking-[-0.03em] text-white sm:text-[36px]">
                Your betting journey
                <span className="block text-[#00D47A]">starts here</span>
              </h2>

              <p className="mt-4 max-w-[520px] text-[14px] font-medium leading-6 text-[#9AA6B7] sm:text-[15px]">
                Log in to view your active bets, follow live results and check your complete betting history.
              </p>

              <div className="mt-7 flex max-w-[430px] flex-col gap-3 sm:flex-row">
                <a
                  href="/auth/login"
                  className="flex min-h-[50px] flex-1 items-center justify-center rounded-[15px] bg-[#00D47A] px-5 text-sm font-black text-[#04130D] shadow-[0_10px_24px_rgba(0,212,122,.18)] transition hover:bg-[#12E68B] active:scale-[.98]"
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

            <div className="relative mx-auto hidden h-[245px] w-full max-w-[300px] lg:block">
              <div className="absolute right-2 top-5 h-44 w-32 rotate-[9deg] rounded-[18px] border border-[#DDE3EA] bg-[#F5F7F9] shadow-[0_18px_35px_rgba(15,23,42,.08)]" />
              <div className="absolute right-12 top-1 h-52 w-36 -rotate-[7deg] rounded-[20px] border border-[#C9D2DC] bg-[#111827] p-3 shadow-[0_22px_45px_rgba(15,23,42,.20)]">
                <div className="flex items-center justify-between rounded-xl bg-[#1A2433] px-3 py-2">
                  <span className="text-[9px] font-black uppercase tracking-widest text-[#9AA6B7]">Bet slip</span>
                  <span className="text-[12px] font-black text-[#00D47A]">N</span>
                </div>
                <div className="mt-4 space-y-3">
                  <div className="h-2 rounded-full bg-white/10" />
                  <div className="h-2 w-4/5 rounded-full bg-white/10" />
                  <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.05] p-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-bold text-white/50">SINGLE</span>
                      <span className="text-[11px] font-black text-[#00D47A]">3.20</span>
                    </div>
                    <div className="mt-2 h-1.5 rounded-full bg-[#00D47A]/20">
                      <div className="h-full w-2/3 rounded-full bg-[#00D47A]" />
                    </div>
                  </div>
                </div>
                <div className="absolute -bottom-5 -right-7 grid h-14 w-14 place-items-center rounded-2xl border-4 border-white bg-[#00D47A] text-[#04130D] shadow-[0_12px_25px_rgba(0,212,122,.25)]">
                  <span className="text-xl font-black">✓</span>
                </div>
              </div>
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
              <h3 className="text-[19px] font-black tracking-tight text-white">Join NOVA today</h3>
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
          title: `BetVima ${bet.publicId}`,
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
    <div className="space-y-2">
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
        <section className="overflow-hidden rounded-[24px] border border-[#00D47A]/35 bg-[radial-gradient(circle_at_50%_38%,rgba(0,212,122,.13),transparent_32%),linear-gradient(145deg,#06111D,#081322_55%,#06101B)] shadow-[0_24px_60px_rgba(0,0,0,.22)]">
          <div className="relative px-5 pb-5 pt-8 sm:px-8 sm:pb-7 sm:pt-10">
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <div className="absolute -left-16 top-16 h-40 w-40 rounded-full bg-[#00D47A]/10 blur-[65px]" />
              <div className="absolute -right-16 top-20 h-44 w-44 rounded-full bg-[#00D47A]/10 blur-[70px]" />
              <div className="absolute inset-x-0 top-0 h-40 bg-[radial-gradient(ellipse_at_center,rgba(0,212,122,.08),transparent_68%)]" />
            </div>

            <div className="relative mx-auto flex max-w-[720px] flex-col items-center text-center">
              <div className="relative mb-6 h-[190px] w-[280px] sm:h-[220px] sm:w-[340px]">
                <div className="absolute left-1/2 top-1/2 h-36 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#00D47A]/10 blur-2xl" />
                <div className="absolute left-[12%] top-[25%] grid h-12 w-12 rotate-[-12deg] place-items-center rounded-xl border border-[#00D47A]/35 bg-[#102235] text-[#00D47A] shadow-[0_0_24px_rgba(0,212,122,.12)]">
                  <svg viewBox="0 0 24 24" className="h-7 w-7 fill-none stroke-current" strokeWidth="1.8">
                    <circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="2.2"/>
                    <path d="M12 3.5v3M12 17.5v3M3.5 12h3M17.5 12h3"/>
                  </svg>
                </div>
                <div className="absolute right-[12%] top-[24%] grid h-12 w-12 rotate-[10deg] place-items-center rounded-xl border border-[#00D47A]/35 bg-[#102235] text-[#00D47A] shadow-[0_0_24px_rgba(0,212,122,.12)]">
                  <svg viewBox="0 0 24 24" className="h-7 w-7 fill-none stroke-current" strokeWidth="1.7">
                    <circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 4.2 6 4.2 9s-1.2 6-4.2 9M12 3c-3 3-4.2 6-4.2 9s1.2 6 4.2 9"/>
                  </svg>
                </div>
                <div className="absolute bottom-[22%] left-[12%] grid h-12 w-12 rotate-[-8deg] place-items-center rounded-xl border border-[#00D47A]/35 bg-[#102235] text-[#00D47A] shadow-[0_0_24px_rgba(0,212,122,.12)]">
                  <svg viewBox="0 0 24 24" className="h-7 w-7 fill-none stroke-current" strokeWidth="1.7">
                    <path d="M7 8h10l2 3v6H5v-6l2-3Z"/><path d="M9 8V6h6v2M9 13h.01M15 13h.01"/>
                  </svg>
                </div>
                <div className="absolute bottom-[20%] right-[12%] grid h-12 w-12 rotate-[8deg] place-items-center rounded-xl border border-[#00D47A]/35 bg-[#102235] text-[#00D47A] shadow-[0_0_24px_rgba(0,212,122,.12)]">
                  <svg viewBox="0 0 24 24" className="h-7 w-7 fill-none stroke-current" strokeWidth="1.7">
                    <path d="M5 7h14M5 12h14M5 17h14"/><circle cx="8" cy="7" r="1.5" fill="currentColor"/><circle cx="16" cy="12" r="1.5" fill="currentColor"/>
                  </svg>
                </div>

                <div className="absolute left-1/2 top-1/2 grid h-32 w-24 -translate-x-1/2 -translate-y-1/2 rotate-[6deg] place-items-center rounded-[18px] border-2 border-[#9AA8B7]/50 bg-gradient-to-br from-[#DCE3E9] via-[#718294] to-[#364555] shadow-[0_18px_35px_rgba(0,0,0,.35)]">
                  <div className="absolute left-[-2px] top-5 h-5 w-2 rounded-r-full bg-[#07111D]" />
                  <div className="absolute left-[-2px] bottom-7 h-5 w-2 rounded-r-full bg-[#07111D]" />
                  <div className="space-y-3">
                    <span className="block h-2.5 w-12 rounded-full bg-[#00D47A] shadow-[0_0_10px_rgba(0,212,122,.55)]" />
                    <span className="block h-2.5 w-10 rounded-full bg-[#00D47A] shadow-[0_0_10px_rgba(0,212,122,.55)]" />
                    <span className="block h-2.5 w-12 rounded-full bg-[#00D47A] shadow-[0_0_10px_rgba(0,212,122,.55)]" />
                  </div>
                </div>

                <span className="absolute left-[35%] top-[15%] text-xl text-[#00D47A]">✦</span>
                <span className="absolute right-[31%] top-[13%] text-2xl text-[#00D47A]">✦</span>
                <span className="absolute left-[30%] bottom-[16%] text-lg text-[#00D47A]">✦</span>
                <span className="absolute right-[30%] bottom-[14%] text-lg text-[#00D47A]">✦</span>
              </div>

              <h2 className="text-[30px] font-black tracking-[-0.035em] text-white sm:text-[38px]">
                No bets yet
              </h2>
              <p className="mt-3 max-w-[520px] text-[14px] font-medium leading-6 text-[#A8B5C7] sm:text-[16px]">
                You haven&apos;t placed your first bet yet.
                <span className="block">Pick a match, choose your odds and your bets will appear here.</span>
              </p>

              <div className="mt-7 flex w-full max-w-[440px] flex-col gap-3">
                <Link
                  href="/sports/football"
                  className="flex min-h-[54px] items-center justify-center gap-3 rounded-[16px] bg-[#00D47A] px-5 text-[15px] font-black text-[#03140D] shadow-[0_12px_28px_rgba(0,212,122,.20)] transition hover:bg-[#12E68B] active:scale-[.98]"
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth="2">
                    <circle cx="12" cy="12" r="9"/><path d="m12 7 2.2 3.2-1.2 3.8h-4l-1.2-3.8L10 7h2ZM4 9l3.8 1.2M20 9l-3.8 1.2M9 20l1-6M15 20l-1-6"/>
                  </svg>
                  Explore sports
                  <span className="text-xl leading-none">›</span>
                </Link>

                <a
                  href="/live"
                  className="flex min-h-[54px] items-center justify-center gap-3 rounded-[16px] border border-[#263650] bg-[#0B1728] px-5 text-[15px] font-bold text-white transition hover:border-[#00D47A]/35 hover:bg-[#101F34] active:scale-[.98]"
                >
                  <span className="grid h-6 w-6 place-items-center rounded-full border border-white/80 text-[11px]">▶</span>
                  View live matches
                  <span className="text-xl leading-none text-white/80">›</span>
                </a>
              </div>

              <div className="mt-7 grid w-full grid-cols-3 border-t border-white/10 pt-6">
                <div className="flex flex-col items-center gap-2 border-r border-white/10 px-2">
                  <span className="grid h-11 w-11 place-items-center rounded-full bg-[#00D47A]/10 text-[#00D47A]">
                    <svg viewBox="0 0 24 24" className="h-6 w-6 fill-none stroke-current" strokeWidth="1.8"><path d="M13 2 5 13h6l-1 9 8-12h-6l1-8Z"/></svg>
                  </span>
                  <span className="text-[11px] font-semibold leading-4 text-[#A8B5C7] sm:text-xs">Wide range<br/>of markets</span>
                </div>
                <div className="flex flex-col items-center gap-2 border-r border-white/10 px-2">
                  <span className="grid h-11 w-11 place-items-center rounded-full bg-[#00D47A]/10 text-[#00D47A]">
                    <svg viewBox="0 0 24 24" className="h-6 w-6 fill-none stroke-current" strokeWidth="1.8"><path d="M4 19V9M10 19V5M16 19v-8M22 19V3"/><path d="M2 19h21"/></svg>
                  </span>
                  <span className="text-[11px] font-semibold leading-4 text-[#A8B5C7] sm:text-xs">Real-time<br/>odds</span>
                </div>
                <div className="flex flex-col items-center gap-2 px-2">
                  <span className="grid h-11 w-11 place-items-center rounded-full bg-[#00D47A]/10 text-[#00D47A]">
                    <svg viewBox="0 0 24 24" className="h-6 w-6 fill-none stroke-current" strokeWidth="1.8"><path d="m12 3 8 3v5c0 5-3.3 8.2-8 10-4.7-1.8-8-5-8-10V6l8-3Z"/><path d="m8.5 12 2.2 2.2 4.8-5"/></svg>
                  </span>
                  <span className="text-[11px] font-semibold leading-4 text-[#A8B5C7] sm:text-xs">Fast and secure<br/>settlements</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <div className="space-y-3 rounded-[22px] bg-[#060E1C] p-2.5 sm:p-5" data-testid="bet-ticket-ledger">
          <div className="space-y-3 pb-1">
            <div className="flex flex-wrap items-center justify-between gap-2 px-1">
              <div>
                <h2 className="text-xl font-black tracking-tight text-white">My Bets</h2>
                <p className="text-xs text-[#97A7BF]">Your tickets, selections and settlements</p>
              </div>
              <span className="rounded-xl border border-[#213750] bg-[#101D30] px-3 py-2 text-xs font-bold text-[#B7C8D9]">
                {displayRows.length} tickets
              </span>
            </div>
            <label className="flex min-h-[45px] items-center gap-2 rounded-[15px] border border-[#26364B] bg-[#152033] px-3 text-[#55A9FF]">
              <span aria-hidden="true" className="text-xl">⌕</span>
              <input type="search" value={search} onChange={(event) => setSearch(event.target.value)}
                placeholder="Search ticket, match or reference"
                aria-label="Search bets" className="w-full min-w-0 bg-transparent text-sm text-white placeholder:text-[#96A5B9] outline-none" />
            </label>
            <div className="grid grid-cols-3 gap-2">
              <label className="min-w-0 rounded-xl border border-[#26364B] bg-[#152033] px-2.5 py-2 text-[10px] text-[#9DAEC5]">
                Status
                <select aria-label="Filter by status" value={tab} onChange={(event) => setTab(event.target.value as 'open' | 'settled' | 'all')}
                  className="mt-1 block w-full bg-transparent text-xs font-bold text-white outline-none">
                  <option value="all">All</option><option value="open">Open</option><option value="settled">Finished</option>
                </select>
              </label>
              <label className="min-w-0 rounded-xl border border-[#26364B] bg-[#152033] px-2.5 py-2 text-[10px] text-[#9DAEC5]">
                Bet type
                <select aria-label="Filter by bet type" value={type} onChange={(event) => setType(event.target.value as 'ALL' | 'SINGLE' | 'MULTIPLE')}
                  className="mt-1 block w-full bg-transparent text-xs font-bold text-white outline-none">
                  <option value="ALL">All</option><option value="SINGLE">Single</option><option value="MULTIPLE">Mix</option>
                </select>
              </label>
              <label className="min-w-0 rounded-xl border border-[#26364B] bg-[#152033] px-2.5 py-2 text-[10px] text-[#9DAEC5]">
                Date
                <select aria-label="Filter by date" value={days} onChange={(event) => setDays(Number(event.target.value))}
                  className="mt-1 block w-full bg-transparent text-xs font-bold text-white outline-none">
                  <option value={0}>Any time</option><option value={7}>7 days</option><option value={30}>30 days</option><option value={90}>90 days</option>
                </select>
              </label>
            </div>
          </div>
          {displayRows.map((bet, index) => {
            const result = betResult(bet);
            const isOpen = openTicketId === null ? index === 0 : openTicketId === bet.id;
            const receiptOpen = Boolean(expanded[bet.id]);
            const isWin = result === 'WIN';
            const isLoss = result === 'LOSS';
            const headerTone = isOpen
              ? 'border-[#00CA86] bg-[linear-gradient(115deg,#006D55,#04AC7C)] text-white'
              : 'border-[#27435F] bg-[linear-gradient(110deg,#102746,#08172C)] text-white';
            const statusTone = isWin
              ? 'bg-[#D7F8E9] text-[#05845C]' : isLoss
              ? 'bg-[#FFE4EA] text-[#C22D4F]' : 'bg-[#DCEAFE] text-[#185AB2]';
            const headerText = bet.type.toUpperCase() === 'MULTIPLE' || bet.legs.length > 1
              ? 'Mix bet (' + bet.legs.length + ' picks)' : 'Single bet';

            return (
              <article key={bet.id} data-testid="bet-row"
                className={'overflow-hidden rounded-[20px] border shadow-[0_10px_30px_rgba(0,0,0,.18)] ' +
                  (highlight === bet.publicId ? 'ring-2 ring-[#00D47A] ' : '') +
                  (isOpen ? 'border-[#00C388] bg-white' : 'border-[#25405F] bg-[#0F1C30]')}>
                <button type="button" aria-expanded={isOpen} aria-controls={'ticket-' + bet.id}
                  onClick={() => setOpenTicketId(isOpen ? '' : bet.id)}
                  className={'flex w-full items-center gap-3 border-b px-3.5 py-3.5 text-left transition-colors sm:px-5 ' + headerTone}>
                  <span aria-hidden="true" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/90 text-xl font-black text-[#058B72]">▣</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-black">{headerText}</span>
                    <span className="block truncate text-[10px] text-white/80">
                      ID {bet.publicId} · {formatDateTime(bet.placedAt, locale)}
                    </span>
                  </span>
                  <span className={'shrink-0 rounded-xl px-2.5 py-2 text-[11px] font-black ' + statusTone}>
                    {betStatusLabel(result, bet.status, locale)}
                  </span>
                  <span aria-hidden="true" className="ml-0.5 shrink-0 text-xl text-white">{isOpen ? '⌃' : '⌄'}</span>
                </button>

                {isOpen ? (
                  <div id={'ticket-' + bet.id} className="text-[#132039]">
                    <div className="grid grid-cols-2 gap-3 px-4 py-4 sm:grid-cols-4 sm:px-5">
                      <div><p className="text-[10px] font-medium text-[#75859C]">Stake</p>
                        <strong className="text-[15px] font-black">{formatMinor(bet.stakeMinor, bet.currency, locale)}</strong></div>
                      <div><p className="text-[10px] font-medium text-[#75859C]">Total odds</p>
                        <strong className="text-[15px] font-black">{formatOddsScaled(bet.combinedOddsScaled)}</strong></div>
                      <div><p className="text-[10px] font-medium text-[#75859C]">{bet.settledPayoutMinor !== null ? 'Confirmed return' : 'Potential return'}</p>
                        <strong className={'text-[15px] font-black ' + (isWin ? 'text-[#05AE71]' : '')}>
                          {formatMinor(bet.settledPayoutMinor ?? bet.potentialPayoutMinor, bet.currency, locale)}
                        </strong></div>
                      <div><p className="text-[10px] font-medium text-[#75859C]">Net result</p>
                        <strong className={'text-[15px] font-black ' + (isWin ? 'text-[#05AE71]' : isLoss ? 'text-red-600' : '')}>
                          {bet.netResultMinor === null ? '—' : formatMinor(bet.netResultMinor, bet.currency, locale)}
                        </strong></div>
                    </div>
                    <div className="mx-3.5 space-y-3 rounded-[15px] border border-[#DDE7E9] bg-white px-3 py-3 sm:mx-5 sm:px-4">
                      {bet.legs.map((leg, legIndex) => {
                        const match = leg.match;
                        const live = matchState(match);
                        const isLive = ['LIVE', 'IN_PLAY'].includes(normalize(match.status));
                        return (
                          <div key={leg.id} className={legIndex ? 'border-t border-dashed border-[#D7E1EC] pt-3' : ''}>
                            <div className="relative isolate overflow-hidden rounded-[13px] border border-[#B9EAD5] bg-[#EAF8F1] p-3.5">
                              <span aria-hidden="true" className="pointer-events-none absolute -right-3 bottom-0 -z-10 select-none text-[clamp(34px,9vw,82px)] font-black tracking-tighter text-[#0C9E74]/[0.065]">BETVIMA</span>
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="text-[9px] font-black tracking-wide text-[#17795B]">YOUR BET · EXACT SELECTION</p>
                                  <p className="mt-1 break-words text-lg font-black text-[#173D2E]">{leg.selectionLabel}</p>
                                </div>
                                <span className="rounded-xl bg-[#B8F4D9] px-3 py-2 text-base font-black text-[#075741]">
                                  {formatOddsScaled(leg.acceptedOddsScaled ?? leg.oddsAtPlacementScaled)}
                                </span>
                              </div>
                              <div className="mt-2 border-t border-[#BAE6D0] pt-2">
                                <p className="text-[9px] font-semibold uppercase text-[#617F73]">Market</p>
                                <p className="text-xs font-bold text-[#244637]">{leg.marketLabel}</p>
                              </div>
                            </div>
                            <div className="mt-3 flex items-center justify-between gap-2 text-[11px]">
                              <span className="min-w-0 truncate font-medium text-[#65788F]">{match.leagueName ?? 'Sports'}</span>
                              <span className={'shrink-0 rounded-lg px-2 py-1 font-bold ' +
                                (isLive ? 'bg-red-50 text-red-600' : 'bg-[#E7F8EF] text-[#08A777]')}>
                                {isLive ? live ?? 'LIVE' : normalize(match.status) === 'FINISHED' ? 'FINISHED' : live ?? 'SCHEDULED'}
                              </span>
                            </div>
                            <div className="mt-2 space-y-2.5">
                              <div className="flex items-center gap-2">
                                <TeamLogo url={match.homeTeamLogoUrl} name={match.homeTeamName ?? 'H'} size={28} theme="light" />
                                <span className="min-w-0 flex-1 truncate text-xs font-bold">{match.homeTeamName ?? 'Home'}</span>
                                <span className="rounded-md bg-[#EBF1F7] px-2 py-1 text-xs font-black">{match.homeScore ?? '—'}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <TeamLogo url={match.awayTeamLogoUrl} name={match.awayTeamName ?? 'A'} size={28} theme="light" />
                                <span className="min-w-0 flex-1 truncate text-xs font-bold">{match.awayTeamName ?? 'Away'}</span>
                                <span className="rounded-md bg-[#EBF1F7] px-2 py-1 text-xs font-black">{match.awayScore ?? '—'}</span>
                              </div>
                              {match.homeScore !== null && match.awayScore !== null ? (
                                <div className="flex items-center justify-between rounded-xl bg-[#F1F5F9] px-3 py-2 text-xs">
                                  <span className="text-[#748399]">Reported score</span>
                                  <strong>{match.homeScore} : {match.awayScore}</strong>
                                </div>
                              ) : null}
                            </div>
                            <div className="mt-2 flex items-center justify-between text-[10px] text-[#66778F]">
                              <span>{gradeLabel(leg.grade ?? leg.status)}</span>
                              <span>{match.scheduledAt ? formatDateTime(match.scheduledAt, locale) : ''}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mx-3.5 my-3 flex flex-wrap items-center justify-between gap-2 border-t border-dashed border-[#CCDAE5] px-1 pt-3 sm:mx-5">
                      <span className="text-[11px] font-bold text-[#6F8197]">{bet.legs.length} picks · Odds {formatOddsScaled(bet.combinedOddsScaled)}</span>
                      <div className="flex flex-wrap items-center gap-2">
                        <button type="button" className="text-xs font-bold text-[#1475CB]" onClick={() => void copyBetId(bet.publicId)}>
                          {copied === bet.publicId ? 'Copied' : 'Copy ID'}
                        </button>
                        <button type="button" className="text-xs font-bold text-[#1475CB]" onClick={() => void shareBet(bet)}>
                          {copied === bet.publicId + ':share' ? 'Copied' : 'Share'}
                        </button>
                        {bet.isCashoutAvailable && bet.status === 'accepted' ? (
                          <button type="button" className="rounded-lg bg-[#06C783] px-3 py-2 text-xs font-black text-white"
                            onClick={() => void requestCashout(bet)}>{t('bets.cashout')}</button>
                        ) : null}
                        <button type="button" aria-expanded={receiptOpen}
                          className="flex items-center gap-1 text-xs font-black text-[#1475CB]"
                          onClick={() => setExpanded((value) => ({ ...value, [bet.id]: !receiptOpen }))}>
                          ▤ {receiptOpen ? 'Hide receipt' : 'Full receipt'} ›
                        </button>
                      </div>
                    </div>
                    {receiptOpen ? (
                      <div className="border-t border-[#DCE6EF] bg-[#F2F6FA] px-4 py-4 text-xs text-[#1D314A] sm:px-5">
                        <h3 className="mb-3 font-black">Ticket receipt · {bet.publicId}</h3>
                        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                          <div><dt className="text-[#7B8DA5]">Placed</dt><dd className="font-bold">{formatDateTime(bet.placedAt, locale)}</dd></div>
                          <div><dt className="text-[#7B8DA5]">Settled</dt><dd className="font-bold">{bet.settledAt ? formatDateTime(bet.settledAt, locale) : 'Pending'}</dd></div>
                          <div><dt className="text-[#7B8DA5]">Revision</dt><dd className="font-bold">{bet.revision}</dd></div>
                          <div><dt className="text-[#7B8DA5]">Status</dt><dd className="font-bold">{betStatusLabel(result, bet.status, locale)}</dd></div>
                        </dl>
                        {bet.legs[0]?.matchId ? (
                          <a className="mt-3 inline-block font-bold text-[#1475CB]" href={'/match/' + bet.legs[0].matchId}>View match ›</a>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </article>
            );
          })}
          {displayRows.length === 0 ? (
            <div className="rounded-2xl border border-[#233D56] bg-[#132238] p-6 text-center text-sm text-[#C0D0E0]">
              No tickets match these filters.
            </div>
          ) : null}
        </div>
      )}

    </div>
  );
}
