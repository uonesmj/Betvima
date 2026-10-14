'use client';

import { useEffect, useMemo, useState } from 'react';
import { translateVisibleText } from '@/lib/i18n/ui-phrases';
import { useApp } from '@/components/layout/providers';
import { Card, EmptyState, ErrorNote, Skeleton, Stat, StatusPill } from '@/components/ui/primitives';
import { useApiQuery } from '@/lib/hooks/useApi';
import { formatDateTime, formatMinor } from '@/lib/i18n';
import { settlementWindow, WEEKDAYS } from '@/lib/timezone';

interface Overview {
  affiliate: { id: string; code: string; displayName: string; status: string; commissionModel: string; commissionRateBps: number; minPayoutMinor: string; currency: string; settlementDay: number; settlementHour: number; settlementMinute: number; settlementTimezone: string };
  payable: { payableMinor: string; rawMinor: string; carryForwardMinor: string; suppressedMinor: string; floorApplied: boolean };
  stats: { clicks: number; registrations: number; firstDeposits: number; activeUsers: number; settledBets: number; totalReferredUsers: number; totalDepositMinor: string; playerNetResultMinor: string; panelShareMinor: string; wageredMinor: string; netRevenueMinor: string; commissionMinor: string; payableMinor: string; carryForwardMinor: string; paidMinor: string };
  payouts: { items: { id: string; publicId: string; amountMinor: string; status: string; requestedAt: string }[] };
  hierarchy: { id: string; code: string; displayName: string; status: string; depth: number }[];
  dailyStats: { day: string; currency: string; clicks: number; registrations: number; firstDeposits: number; activeUsers: number; settledBets: number; turnoverMinor: string; userWinsMinor: string; userLossesMinor: string; commissionMinor: string }[];
  note: string;
  period: { start: string; end: string };
}


function isoDateLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function shiftDate(date: Date, days: number): string {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return isoDateLocal(next);
}

function daysBetweenInclusive(from: string, to: string): number {
  return Math.floor(
    (Date.parse(`${to}T00:00:00`) - Date.parse(`${from}T00:00:00`)) / 86400000,
  ) + 1;
}

type AffiliateSummary = {
  period: { from: string; to: string; days: number };
  summary: {
    clicks: number;
    users: number;
    registrations: number;
    firstDeposits: number;
    activeUsers: number;
    withdrawals: number;
    totalDepositMinor: string;
    totalWithdrawalMinor: string;
    netDepositMinor: string;
    settledBets: number;
    turnoverMinor: string;
    playerNetResultMinor: string;
    commissionMinor: string;
    panelShareMinor: string;
    currency: string;
  };
};

export function AffiliateDashboardClient() {
  const { t, locale, session } = useApp();
  const tr = (value: string | number | undefined) => { const copy = String(value ?? ''); return locale === 'fa' ? translateVisibleText(copy) : copy; };
  const [range, setRange] = useState(1);
  const [copied, setCopied] = useState(false);
  const today = useMemo(() => isoDateLocal(new Date()), []);
  const [summaryFrom, setSummaryFrom] = useState(() => isoDateLocal(new Date()));
  const [summaryTo, setSummaryTo] = useState(() => isoDateLocal(new Date()));
  const [summary, setSummary] = useState<AffiliateSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const loadSummary = async (from: string, to: string) => {
    const days = daysBetweenInclusive(from, to);
    if (days < 1 || days > 366) {
      setSummaryError('Select a period between 1 day and 1 year.');
      return;
    }
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const response = await fetch(
        `/api/v1/affiliate/summary?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
        { cache: 'no-store' },
      );
      const payload = await response.json();
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error?.message ?? 'Unable to load summary');
      }
      setSummary(payload.data as AffiliateSummary);
    } catch (error) {
      setSummaryError(error instanceof Error ? error.message : 'Unable to load summary');
    } finally {
      setSummaryLoading(false);
    }
  };

  useEffect(() => {
    void loadSummary(today, today);
  }, [today]);

  const applySummaryPreset = (days: number) => {
    const from = days === 1 ? today : shiftDate(new Date(), -(days - 1));
    setSummaryFrom(from);
    setSummaryTo(today);
    void loadSummary(from, today);
  };

  const overviewPath = useMemo(() => {
    if (!session?.authenticated) return null;
    if (range === 1) return '/api/v1/affiliate/overview';
    return `/api/v1/affiliate/overview?from=${encodeURIComponent(new Date(Date.now() - range * 864e5).toISOString())}`;
  }, [session?.authenticated, range]);
  const { data, loading, error, reload } = useApiQuery<Overview>(overviewPath);
  const { data: referrals } = useApiQuery<{ items: { userId: string; code: string; status: string; confirmedAt: string | null; wageredMinor: string; netRevenueMinor: string; commissionMinor: string; depositMinor: string; withdrawalMinor: string; panelShareMinor: string }[] }>(session?.authenticated ? '/api/v1/affiliate/referrals?page=1&pageSize=8' : null);
  const { data: giftCodes, reload: reloadGiftCodes } = useApiQuery<{ items: { id: string; code: string; isActive: boolean; usageCount: number; lastUsedAt: string | null; createdAt: string }[]; limit: number }>(session?.authenticated ? '/api/v1/affiliate/gift-codes' : null);
  const [giftCode, setGiftCode] = useState('');
  const [giftCodeBusy, setGiftCodeBusy] = useState(false);
  const [giftCodeError, setGiftCodeError] = useState<string | null>(null);
  async function createGiftCode() {
    const code = giftCode.trim().toUpperCase();
    setGiftCodeError(null);
    if (!/^[A-Z0-9]{4,8}$/.test(code)) {
      setGiftCodeError('Use 4–8 letters or numbers.');
      return;
    }
    setGiftCodeBusy(true);
    try {
      const response = await fetch('/api/v1/affiliate/gift-codes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error?.message ?? payload?.message ?? 'Could not create this gift code.');
      setGiftCode('');
      await reloadGiftCodes();
    } catch (e) {
      setGiftCodeError(e instanceof Error ? e.message : 'Could not create this gift code.');
    } finally {
      setGiftCodeBusy(false);
    }
  }

  if (!session?.authenticated) {
    return <EmptyState title={t('nav.login')} action={<a className="nova-btn-primary mt-2" href="/affiliate/login">{t('nav.login')}</a>} />;
  }
  if (loading) return <Skeleton className="h-48 w-full" />;
  if (error || !data) {
    return (
      <EmptyState
        title={t('affiliate.register')}
        hint={error ?? undefined}
        action={<a className="nova-btn-primary mt-2" href="/affiliate/register">{t('affiliate.register')}</a>}
      />
    );
  }

  const { affiliate, payable, stats, dailyStats } = data;
  const safeBigInt = (value: unknown) => {
    if (value === null || value === undefined || value === '') return 0n;
    try { return BigInt(String(value)); } catch { return 0n; }
  };
  const referralUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/ref/${affiliate.code}`;
  const totalClicks = dailyStats.reduce((n, x) => n + x.clicks, 0);
  const totalRegistrations = stats.registrations;
  const totalDeposits = stats.firstDeposits;
  const maxCommission = Math.max(...dailyStats.map(x => Number(x.commissionMinor)), 1);
  const currency = 'USD';
  // The next settlement instant is derived from the affiliate's own schedule (IANA zone),
  // so it stays correct across DST instead of assuming a stored UTC offset.
  const schedule = {
    day: affiliate.settlementDay, hour: affiliate.settlementHour ?? 0,
    minute: affiliate.settlementMinute ?? 0, timezone: affiliate.settlementTimezone,
  };
  const nextWindow = settlementWindow(new Date(), schedule);

  async function copyReferral() {
    await navigator.clipboard.writeText(referralUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  async function shareReferral() {
    if (navigator.share) await navigator.share({ title: 'NOVA', text: 'Join NOVA', url: referralUrl });
    else await copyReferral();
  }

  return (
    <div className="affiliate-dashboard-v2 space-y-4 text-[#172033]">
      <section className="relative overflow-hidden rounded-[26px] bg-[#061A33] p-5 text-white shadow-[0_18px_50px_rgba(6,26,51,.20)] sm:p-7 lg:p-8">
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[#087FF5]/20 blur-3xl" />
        <div className="relative grid gap-7 lg:grid-cols-[1.35fr_.65fr] lg:items-center">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[.28em] text-[#55A7FF]">{tr("BETVIMA AFFILIATE")}</div>
            <h1 className="mt-2 max-w-2xl text-3xl font-black leading-[1.05] tracking-tight sm:text-4xl">{tr("Turn your network into")}<span className="text-[#18A8FF]">{tr("real income")}</span></h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-[#B8C9DD] sm:text-base">{tr("Share your referral link, bring new players to NOVA and earn from their settled net results.")}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="rounded-full border border-white/10 bg-white/10 px-3 py-2 text-xs font-bold">70% commission</span>
              <span className="rounded-full border border-white/10 bg-white/10 px-3 py-2 text-xs font-bold">{tr("USD settlement")}</span>
              <span className="rounded-full border border-white/10 bg-white/10 px-3 py-2 text-xs font-bold">$40 minimum</span>
            </div>
          </div>
          <div className="rounded-[26px] border border-[#168BFF]/35 bg-gradient-to-br from-[#0B315A] to-[#061A33] p-6 text-center shadow-[0_20px_50px_rgba(0,0,0,.25)]">
            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border border-[#28B5FF]/40 bg-[#087FF5]/15 text-4xl font-black text-[#19A7FF]">N</div>
            <div className="mt-4 text-[10px] font-black uppercase tracking-[.2em] text-[#8FB7E8]">{tr("Commission rate")}</div>
            <div className="mt-1 text-5xl font-black">{(affiliate.commissionRateBps / 100).toFixed(0)}%</div>
            <div className="mt-1 text-xs font-bold text-[#9FB6CE]">{tr("PROFIT / LOSS SHARE")}</div>
          </div>
        </div>
        <div className="relative mt-6 rounded-2xl border border-white/10 bg-white/[.07] p-3">
          <div className="mb-2 flex items-center justify-between text-[10px] font-black uppercase tracking-[.15em] text-[#8FA7C2]"><span>{tr("Your referral link")}</span><span>{affiliate.code}</span></div>
          <div className="flex gap-2">
            <div className="min-w-0 flex-1 truncate rounded-xl bg-white/10 px-3 py-3 text-xs">{referralUrl}</div>
            <button onClick={copyReferral} className="rounded-xl bg-[#087FF5] px-4 text-xs font-black">{copied ? 'Copied' : 'Copy'}</button>
            <button onClick={shareReferral} className="hidden rounded-xl border border-white/15 bg-white/10 px-4 text-xs font-black sm:block">{tr("Share")}</button>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden rounded-[22px] border border-[#E1E8F0] bg-white p-5 shadow-[0_8px_28px_rgba(15,23,42,.055)] sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-black text-[#111827]">{t('affiliate.giftCodesTitle')}</h2>
            <p className="mt-1 text-xs text-[#718096]">{t('affiliate.giftCodesHelp')}</p>
          </div>
          <span className="rounded-full bg-[#EAF4FF] px-3 py-1.5 text-[10px] font-black text-[#087FF5]">
            {(giftCodes?.items?.length ?? 0)}/{giftCodes?.limit ?? 10}
          </span>
        </div>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            value={giftCode}
            onChange={(e) => setGiftCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8))}
            placeholder={t('affiliate.giftCodePlaceholder')}
            maxLength={8}
            className="h-11 flex-1 rounded-xl border border-[#DCE4EC] bg-[#F8FAFC] px-3 text-sm font-black uppercase tracking-[.12em] outline-none focus:border-[#087FF5]"
          />
          <button
            type="button"
            disabled={giftCodeBusy || (giftCodes?.items?.length ?? 0) >= (giftCodes?.limit ?? 10)}
            onClick={createGiftCode}
            className="h-11 rounded-xl bg-[#087FF5] px-5 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {giftCodeBusy ? '...' : t('affiliate.giftCodeCreate')}
          </button>
        </div>
        {giftCodeError && <p className="mt-2 text-xs font-bold text-[#DC2626]">{tr(giftCodeError)}</p>}
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {(giftCodes?.items ?? []).map((item) => (
            <div key={item.id} className="flex items-center justify-between rounded-xl border border-[#E7ECF2] bg-[#F8FAFC] px-3 py-3">
              <div>
                <div className="font-mono text-sm font-black tracking-[.16em] text-[#111827]">{item.code}</div>
                <div className="mt-1 text-[10px] font-bold text-[#718096]">{t('affiliate.giftCodeUsage')}: {item.usageCount}</div>
              </div>
              <StatusPill status={item.isActive ? 'active' : 'closed'} />
            </div>
          ))}
        </div>
      </section>
      <section className="border-0 bg-transparent p-0 shadow-none">
        <div className="mb-3 flex items-end justify-between">
          

          <div><h2 className="text-lg font-black text-[#111827]">{tr("Key performance")}</h2><p className="mt-1 text-xs text-[#718096]">{tr("All referred players")}</p></div>
          <span className="rounded-full bg-[#EAF4FF] px-3 py-1 text-[10px] font-black text-[#087FF5]">{tr("LIVE DATA")}</span>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            ['Players', stats.totalReferredUsers, '◎', 'bg-[#EAF4FF] text-[#087FF5]', 'All referred players'],
            ['Total Deposit', formatMinor(stats.totalDepositMinor, currency, locale), '$', 'bg-[#E7FAFF] text-[#0891B2]', 'All successful deposits'],
            ['Player P/L', formatMinor(stats.playerNetResultMinor, currency, locale), '↕', safeBigInt(stats.playerNetResultMinor) < 0n ? 'bg-[#E8FBF4] text-[#16A34A]' : 'bg-[#FFF0F0] text-[#DC2626]', 'Settled player result'],
            ['Your 70% Share', formatMinor(stats.panelShareMinor, currency, locale), '◉', safeBigInt(stats.panelShareMinor) >= 0n ? 'bg-[#E8FBF4] text-[#059669]' : 'bg-[#FFF0F0] text-[#DC2626]', 'Panel share at 70%']
          ].map(([label,value,icon,iconClass,note]) => (
            <div key={String(label)} className="rounded-2xl border border-[#E5EBF2] bg-white p-4 shadow-[0_5px_20px_rgba(15,23,42,.045)]">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl text-lg font-black ${iconClass}`}>{icon}</div>
              <div className="mt-4 text-xs font-bold text-[#718096]">{tr(label)}</div>
              <div className="mt-1 truncate text-xl font-black tracking-tight text-[#111827]">{value}</div>
              <div className="mt-2 text-[10px] font-bold text-[#94A3B8]">{tr(note)}</div>
            </div>
          ))}
        </div></section>
      <section className="grid gap-4 lg:grid-cols-[1.7fr_1fr]">
        <div className="relative overflow-hidden rounded-[22px] border border-[#E1E8F0] bg-white p-5 shadow-[0_8px_28px_rgba(15,23,42,.055)] sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-black text-[#111827]">{tr("Commission performance")}</h2>
              <p className="mt-1 text-xs text-[#718096]">{tr("Daily settled commission")}</p>
            </div>
            <div className="flex rounded-xl bg-[#F2F5F9] p-1">
              {[7, 30].map((n) => (
                <button key={n} type="button" onClick={() => setRange(n)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-black ${range === n ? 'bg-white text-[#087FF5] shadow-sm' : 'text-[#718096]'}`}>
                  {n}D
                </button>
              ))}
            </div>
          </div>
          <div className="mt-5 h-[190px] rounded-xl bg-[#F8FAFC] p-3">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
              <path d="M0 90H100M0 50H100M0 10H100" stroke="#E6EBF1" strokeWidth=".5" />
              <polyline
                points={dailyStats.slice(-range).map((x,i) => {
                  const rows = dailyStats.slice(-range);
                  const xPos = rows.length > 1 ? (i/(rows.length-1))*100 : 50;
                  const yPos = 92-(Number(x.commissionMinor)/maxCommission)*78;
                  return `${xPos},${yPos}`;
                }).join(' ') || '0,92 100,92'}
                fill="none" stroke="#087FF5" strokeWidth="2.2"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-[22px] border border-[#E1E8F0] bg-white p-5 shadow-[0_8px_28px_rgba(15,23,42,.055)] sm:p-6">
          <div className="absolute right-0 top-0 h-24 w-24 rounded-full bg-[#7C3AED]/5 blur-2xl" />
          <h2 className="relative font-black text-[#111827]">{tr("Acquisition funnel")}</h2>
          <p className="mt-1 text-xs text-[#718096]">{tr("Selected period")}</p>
          <div className="mt-5 space-y-5">
            {[
              ['Clicks', totalClicks, 100],
              ['Registrations', totalRegistrations, totalClicks ? totalRegistrations / totalClicks * 100 : 0],
              ['First deposits', totalDeposits, totalClicks ? totalDeposits / totalClicks * 100 : 0],
            ].map(([label,value,percent]) => (
              <div key={String(label)}>
                <div className="mb-1.5 flex justify-between text-xs font-bold">
                  <span>{label}</span><span>{value}</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-[#EEF2F6]">
                  <div className="h-full rounded-full bg-gradient-to-r from-[#087FF5] to-[#35B7FF] transition-all" style={{width:`${Math.min(100,Number(percent))}%`}} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="overflow-hidden rounded-[22px] border border-[#E1E8F0] bg-white shadow-[0_8px_28px_rgba(15,23,42,.055)]">
        <div className="flex items-center justify-between border-b border-[#EEF2F6] px-5 py-4">
          <div>
            <h2 className="font-black text-[#111827]">{tr("Referred players")}</h2>
            <p className="mt-1 text-xs text-[#718096]">{tr("Recent players acquired through your network")}</p>
          </div>
          <a href="/affiliate/referrals" className="text-xs font-black text-[#087FF5]">{tr("View all")}</a>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-xs">
            <thead className="bg-[#F8FAFC] text-[10px] font-black uppercase tracking-wider text-[#718096]">
              <tr>
                <th className="px-5 py-3">{tr("Player")}</th>
                <th className="px-4 py-3">{tr("Status")}</th>
                <th className="px-4 py-3 text-right">{tr("Deposit")}</th>
                <th className="px-4 py-3 text-right">{tr("Withdrawal")}</th>
                <th className="px-4 py-3 text-right">{tr("Turnover")}</th>
                <th className="px-4 py-3 text-right">P/L</th>
                <th className="px-4 py-3 text-right">{tr("Your 70%")}</th>
                <th className="px-5 py-3 text-right">{tr("Commission")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF2F6]">
              {(referrals?.items ?? []).map((row) => (
                <tr key={row.userId} className="text-[#334155]">
                  <td className="px-5 py-3 font-mono font-bold">{row.userId.slice(0, 8)}…</td>
                  <td className="px-4 py-3"><StatusPill status={row.status} /></td>
                  <td className="px-4 py-3 text-right font-bold">{formatMinor(row.depositMinor, currency, locale)}</td>
                  <td className="px-4 py-3 text-right font-bold">{formatMinor(row.withdrawalMinor, currency, locale)}</td>
                  <td className="px-4 py-3 text-right font-bold">{formatMinor(row.wageredMinor, currency, locale)}</td>
                  <td className="px-4 py-3 text-right font-bold">
                    <span className={safeBigInt(row.netRevenueMinor) > 0n ? 'text-[#DC2626]' : safeBigInt(row.netRevenueMinor) < 0n ? 'text-[#16A34A]' : 'text-[#111827]'}>
                      {formatMinor(row.netRevenueMinor, currency, locale)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-bold">
                    <span className={safeBigInt(row.panelShareMinor) > 0n ? 'text-[#16A34A]' : safeBigInt(row.panelShareMinor) < 0n ? 'text-[#DC2626]' : 'text-[#111827]'}>
                      {formatMinor(row.panelShareMinor, currency, locale)}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right font-black text-[#087FF5]">{formatMinor(row.commissionMinor, currency, locale)}</td>
                </tr>
              ))}
              {(referrals?.items?.length ?? 0) === 0 && (
                <tr><td colSpan={8} className="px-5 py-10 text-center text-sm text-[#718096]">{tr("No referred players yet.")}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      <ErrorNote message={null} retryLabel={t('common.retry')} />
      <section className="relative overflow-hidden rounded-[22px] border border-[#E1E8F0] bg-white p-5 shadow-[0_8px_28px_rgba(15,23,42,.055)] sm:p-6">
        <div className="absolute right-0 top-0 h-28 w-28 rounded-full bg-[#087FF5]/5 blur-3xl" />
        <div className="relative">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-black text-[#111827]">Balance & settlement</h2>
              <p className="mt-1 text-xs text-[#718096]">{tr("Your current commission balance and next settlement window.")}</p>
            </div>
            <span className="rounded-full bg-[#E8FBF4] px-3 py-1.5 text-[10px] font-black text-[#059669]">{tr("USD SETTLEMENT")}</span>
          </div>
        <div className="mt-4 overflow-hidden rounded-xl border border-[#E7ECF2]">
          <Stat label={t('affiliate.payable')} value={formatMinor(payable.payableMinor, currency, locale)} tone="success" />
          <Stat label={t('affiliate.rawBalance')} value={formatMinor(payable.rawMinor, currency, locale)} />
          <Stat label={t('affiliate.carry')} value={formatMinor(payable.carryForwardMinor, currency, locale)} tone={safeBigInt(payable.carryForwardMinor) < 0n ? 'danger' : undefined} />
          <Stat label={t('affiliate.suppressed')} value={formatMinor(payable.suppressedMinor, currency, locale)} tone="warning" />
        </div>
        <div className="mt-5 border-t border-[#E7ECF2] pt-4 text-xs text-[#64748B]">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status={affiliate.status} />
            <span className="nova-chip">{affiliate.commissionModel}</span>
            <span className="nova-chip">{(affiliate.commissionRateBps / 100).toFixed(0)}%</span>
            <span className="nova-chip">{tr('code:')} {affiliate.code}</span>
            <span className="nova-chip">{t('affiliate.minPayout')}: {formatMinor(affiliate.minPayoutMinor, currency, locale)}</span>
          </div>
          <p className="mt-2">{tr(data.note)}</p>
          <p className="mt-1">
            Settlement runs every {WEEKDAYS[(affiliate.settlementDay ?? 7) % 7] ?? affiliate.settlementDay} at {String(affiliate.settlementHour ?? 0).padStart(2, '0')}:{String(affiliate.settlementMinute ?? 0).padStart(2, '0')} ({affiliate.settlementTimezone}).
            {tr('Next settlement:')} <strong className="text-nova-text">{formatDateTime(nextWindow.periodStart.toISOString(), locale)}</strong>
            {' '}(local: {nextWindow.localLabel.replace(/ \(.*\)$/, '')} + 7 days).
          </p>
          <p className="mt-1">{tr('Period:')} {formatDateTime(data.period.start, locale)} → {formatDateTime(data.period.end, locale)}</p>
        </div>
        </div>
      </section>
    </div>
  );
}
