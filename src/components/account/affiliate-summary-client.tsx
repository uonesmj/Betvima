'use client';

import { useEffect, useMemo, useState } from 'react';

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

const DAY_MS = 24 * 60 * 60 * 1000;

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
    (Date.parse(`${to}T00:00:00.000Z`) - Date.parse(`${from}T00:00:00.000Z`)) / DAY_MS,
  ) + 1;
}

function formatMoney(minor: string, currency: string): string {
  const value = Number(minor) / 100;
  if (!Number.isFinite(value)) return `0 ${currency}`;
  return `${new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
  }).format(value)} ${currency}`;
}

function formatCount(value: number): string {
  return new Intl.NumberFormat('en-US').format(Number(value) || 0);
}

export default function AffiliateSummaryClient() {
  const today = useMemo(() => isoDateLocal(new Date()), []);
  const [summaryFrom, setSummaryFrom] = useState(today);
  const [summaryTo, setSummaryTo] = useState(today);
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
      setSummaryError(
        error instanceof Error ? error.message : 'Unable to load summary',
      );
    } finally {
      setSummaryLoading(false);
    }
  };

  useEffect(() => {
    void loadSummary(today, today);
  }, [today]);

  const applyPreset = (days: number) => {
    const from = days === 1 ? today : shiftDate(new Date(), -(days - 1));
    setSummaryFrom(from);
    setSummaryTo(today);
    void loadSummary(from, today);
  };

  const applyCustom = () => {
    void loadSummary(summaryFrom, summaryTo);
  };

  const data = summary?.summary;

  return (
    <section className="affiliate-summary-card mb-5 overflow-hidden rounded-2xl border border-[#DCE6F1] bg-white shadow-[0_12px_35px_rgba(15,23,42,.08)]">
      <div className="border-t-4 border-[#087FF5] p-5 sm:p-6">
        <div className="mb-5">
          <div className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#087FF5]">
            Affiliate Summary
          </div>
          <h2 className="mt-1 text-2xl font-black tracking-tight text-[#142033]">
            Custom period performance
          </h2>
          <p className="mt-1 text-sm text-[#718096]">
            Choose any period from 1 day up to 1 year.
          </p>
        </div>

        <div className="mb-5 flex flex-wrap gap-2">
          {[
            [1, 'Today'],
            [7, '7 Days'],
            [30, '30 Days'],
            [90, '90 Days'],
            [182, '6 Months'],
            [366, '1 Year'],
          ].map(([days, label]) => (
            <button
              key={String(days)}
              type="button"
              onClick={() => applyPreset(Number(days))}
              className="min-h-[44px] rounded-xl border border-[#CBD5E1] bg-white px-4 py-2 text-sm font-bold text-[#172033] transition hover:border-[#087FF5] hover:bg-[#F4F9FF]"
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto_1fr_auto] md:items-end">
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.1em] text-[#718096]">
              From
            </span>
            <input
              type="date"
              value={summaryFrom}
              onChange={(e) => setSummaryFrom(e.target.value)}
              className="nova-input w-full"
            />
          </label>

          <div className="hidden pb-3 text-center text-[#94A3B8] md:block">→</div>

          <label className="block">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.1em] text-[#718096]">
              To
            </span>
            <input
              type="date"
              value={summaryTo}
              onChange={(e) => setSummaryTo(e.target.value)}
              className="nova-input w-full"
            />
          </label>

          <button
            type="button"
            onClick={applyCustom}
            disabled={summaryLoading}
            className="nova-btn-primary min-h-[44px] whitespace-nowrap disabled:opacity-60"
          >
            {summaryLoading ? 'Loading…' : 'Apply Period'}
          </button>
        </div>

        {summaryError ? (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {summaryError}
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          {[
            ['Users', formatCount(data?.users ?? 0)],
            ['Active Users', formatCount(data?.activeUsers ?? 0)],
            ['First Deposits', formatCount(data?.firstDeposits ?? 0)],
            ['Withdrawals', formatCount(data?.withdrawals ?? 0)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
              <div className="text-xs font-bold uppercase tracking-[0.08em] text-[#718096]">
                {label}
              </div>
              <div className="mt-2 text-xl font-black text-[#172033]">
                {value}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          {[
            ['Deposits', formatMoney(data?.totalDepositMinor ?? '0', data?.currency ?? 'USD')],
            ['Withdrawals', formatMoney(data?.totalWithdrawalMinor ?? '0', data?.currency ?? 'USD')],
            ['Net Deposit', formatMoney(data?.netDepositMinor ?? '0', data?.currency ?? 'USD')],
            ['Turnover', formatMoney(data?.turnoverMinor ?? '0', data?.currency ?? 'USD')],
            ['Player P/L', formatMoney(data?.playerNetResultMinor ?? '0', data?.currency ?? 'USD')],
            ['Your Commission', formatMoney(data?.commissionMinor ?? '0', data?.currency ?? 'USD')],
            ['Settled Bets', formatCount(data?.settledBets ?? 0)],
            ['Clicks', formatCount(data?.clicks ?? 0)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-[#E2E8F0] bg-white p-4">
              <div className="text-xs font-bold uppercase tracking-[0.08em] text-[#718096]">
                {label}
              </div>
              <div className="mt-2 text-lg font-black text-[#172033] sm:text-xl">
                {value}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-[#07111F] px-4 py-3 text-xs font-semibold text-white">
          <span>{formatCount(data?.registrations ?? 0)} registrations</span>
          <span>{summary?.period.days ?? 1} days selected</span>
          <span>
            {summary?.period.from ?? summaryFrom} → {summary?.period.to ?? summaryTo}
          </span>
        </div>
      </div>
    </section>
  );
}
