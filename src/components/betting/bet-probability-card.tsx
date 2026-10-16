'use client';

import { useEffect, useMemo, useState } from 'react';
import { Activity, Info, RotateCcw, TrendingDown, TrendingUp } from 'lucide-react';
import { useApp } from '@/components/layout/providers';
import { useBetSlip } from '@/lib/store/betslip';
import { formatMinor } from '@/lib/i18n';
import {
  estimateSlipProbability, outcomePercents,
  type MarketSnapshots, type ProbabilityMatch,
} from '@/lib/betslip-probability';

export interface ProbabilityFeed {
  snapshots: MarketSnapshots | null;
  updatedAt: number | null;
  loading: boolean;
}

/**
 * Mounted only once in BetSlipRail, NOT in each mobile/desktop panel.
 * Read-only polling cannot modify selected odds, quote state, wallet or bets.
 */
export function useBetSlipProbabilityFeed(
  matchIds: readonly string[],
  visible: boolean,
): ProbabilityFeed {
  const ids = [...new Set(matchIds)].sort().join(',');
  const [feed, setFeed] = useState<ProbabilityFeed>({
    snapshots: null, updatedAt: null, loading: true,
  });

  useEffect(() => {
    if (!visible || !ids) {
      setFeed({ snapshots: null, updatedAt: null, loading: false });
      return;
    }

    const matches = ids.split(',');
    let active = true;
    let inFlight = false;
    let controller: AbortController | null = null;
    setFeed({ snapshots: null, updatedAt: null, loading: true });

    const refresh = async () => {
      if (!active || inFlight || document.visibilityState === 'hidden') return;
      inFlight = true;
      controller = new AbortController();
      try {
        const snapshots: MarketSnapshots = {};
        // Bound concurrent reads when the customer creates a large accumulator.
        for (let start = 0; start < matches.length; start += 4) {
          const batch = matches.slice(start, start + 4);
          const resolved = await Promise.all(batch.map(async (matchId) => {
            const response = await fetch(
              '/api/v1/matches/' + encodeURIComponent(matchId) + '/odds',
              {
                signal: controller!.signal,
                credentials: 'same-origin',
                cache: 'no-store',
                headers: { Accept: 'application/json' },
              },
            );
            if (!response.ok) throw new Error('Odds unavailable');
            const json = await response.json();
            const data = (json?.data ?? json) as ProbabilityMatch;
            if (!data || !Array.isArray(data.markets) || data.matchId !== matchId) {
              throw new Error('Invalid odds snapshot');
            }
            return { matchId, data };
          }));
          for (const { matchId, data } of resolved) snapshots[matchId] = data;
        }
        if (active) setFeed({
          snapshots, updatedAt: Date.now(), loading: false,
        });
      } catch {
        // Fail closed rather than displaying outdated percentages as live.
        if (active) setFeed({ snapshots: null, updatedAt: null, loading: false });
      } finally {
        inFlight = false;
      }
    };

    void refresh();
    const timer = window.setInterval(refresh, matches.length <= 4 ? 12000 : 30000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      active = false;
      controller?.abort();
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [ids, visible]);

  return feed;
}

export function BetProbabilityCard({ feed }: { feed: ProbabilityFeed }) {
  const { locale, session } = useApp();
  const slip = useBetSlip();
  const isFa = locale === 'fa';
  const model = useMemo(() => feed.snapshots
    ? estimateSlipProbability(slip.items, feed.snapshots)
    : null, [feed.snapshots, slip.items]);
  const percentages = model ? outcomePercents(model) : null;
  const fmt = (value: number) => new Intl.NumberFormat(isFa ? 'fa-IR' : 'en-US').format(value);
  const currency = session?.user?.currency ?? 'USD';

  if (!slip.items.length) return null;

  return (
    <section
      data-testid="betslip-probability-card"
      aria-label={isFa ? 'تحلیل احتمال شرط' : 'Bet probability analysis'}
      className="relative overflow-hidden rounded-[18px] border border-[#243746] bg-[#0B1721] p-3.5 text-white shadow-[0_8px_22px_rgba(9,22,30,0.12)]"
      dir={isFa ? 'rtl' : 'ltr'}
    >
      <div aria-hidden="true" className="pointer-events-none absolute -end-12 -top-16 h-36 w-36 rounded-full bg-[#00D988]/[.07] blur-2xl" />
      <div className="relative mb-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-[#173142] text-[#53DDA4]">
            <Activity size={16} strokeWidth={2.2} />
          </span>
          <div className="min-w-0">
            <h3 className="text-[13px] font-extrabold leading-5">
              {isFa ? 'تحلیل احتمال شرط' : 'Bet probability'}
            </h3>
            <p className="text-[10px] font-medium text-[#A6B7C4]">
              {isFa ? 'برآورد از ضرایب بازار' : 'Market-implied estimate'}
            </p>
          </div>
        </div>
        <span className={
          'inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-extrabold ' +
          (model?.isLive
            ? 'border-[#E94B6F]/30 bg-[#E94B6F]/15 text-[#FF8A9E]'
            : 'border-[#3D5866] bg-[#1A2E3B] text-[#BDD0DA]')
        }>
          {model?.isLive ? <span className="h-[6px] w-[6px] animate-pulse rounded-full bg-[#FF6686]" /> : null}
          {model?.isLive ? (isFa ? 'زنده' : 'LIVE') : (isFa ? 'پیش از بازی / بازار' : 'Pre-match / market')}
        </span>
      </div>

      {percentages ? (
        <div className="relative flex items-center gap-4">
          <div
            className="relative grid h-[124px] w-[124px] shrink-0 place-items-center rounded-full p-[12px] transition-all duration-700"
            style={{
              background: 'conic-gradient(' +
                '#19C887 0% ' + percentages.win + '%,' +
                '#EE6177 ' + percentages.win + '% ' + (percentages.win + percentages.lose) + '%,' +
                '#E7B04D ' + (percentages.win + percentages.lose) + '% 100%)',
            }}
            role="img"
            aria-label={(isFa ? 'برد ' : 'Win ') + fmt(percentages.win) +
              (isFa ? ' درصد، باخت ' : ' percent, lose ') + fmt(percentages.lose) +
              (isFa ? ' درصد، برگشت وجه ' : ' percent, refund ') + fmt(percentages.refund) +
              (isFa ? ' درصد' : ' percent')}
          >
            <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-[#0B1721] ring-1 ring-inset ring-[#294051]">
              <span className="text-[28px] font-black leading-none tabular-nums text-[#65E5B1]">
                {fmt(percentages.win)}%
              </span>
              <span className="mt-1.5 text-[10px] font-semibold text-[#A4B7C3]">
                {isFa ? 'احتمال برد' : 'Win chance'}
              </span>
            </div>
          </div>
          <div className="min-w-0 flex-1 space-y-2.5">
            {([
              { label: isFa ? 'برد' : 'Win', value: percentages.win, color: '#19C887', Icon: TrendingUp },
              { label: isFa ? 'باخت' : 'Lose', value: percentages.lose, color: '#EE6177', Icon: TrendingDown },
              { label: isFa ? 'برگشت وجه' : 'Refund', value: percentages.refund, color: '#E7B04D', Icon: RotateCcw },
            ] as const).map(({ label, value, color, Icon }) => (
              <div key={label} className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5 text-[11px] font-semibold text-[#D8E4EB]">
                  <Icon size={13} strokeWidth={2.1} style={{ color }} />
                  <span className="truncate">{label}</span>
                </span>
                <span className="text-[14px] font-extrabold tabular-nums" style={{ color }}>
                  {fmt(value)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex min-h-[114px] flex-col items-center justify-center gap-2 rounded-[13px] border border-[#2A3E4D] bg-[#132631] px-3 text-center">
          <Info size={20} className="text-[#83A7BA]" />
          <span className="text-[12px] font-bold text-[#E0E9F0]">
            {feed.loading
              ? (isFa ? 'در حال دریافت ضرایب معتبر…' : 'Checking available market odds…')
              : (isFa ? 'اطلاعات کافی برای محاسبه هر سه احتمال وجود ندارد' : 'Not enough data to estimate all three outcomes')}
          </span>
          <span className="text-[10px] leading-4 text-[#9DB2BF]">
            {isFa
              ? 'بازار متوقف، ضرایب نامعتبر یا احتمال برگشت وجه نامشخص است.'
              : 'A market is suspended, odds are unavailable, or refund probability is unknown.'}
          </span>
        </div>
      )}

      <div className="relative mt-3 border-t border-[#28404D] pt-2.5">
        {percentages && percentages.refund > 0 ? (
          <p className="mb-1 text-[10px] font-semibold text-[#EEC47C]">
            {isFa ? 'برگشت کامل احتمالی: ' : 'Possible full stake return: '}
            {formatMinor(slip.stakeMinor, currency, locale)}
          </p>
        ) : null}
        <p className="text-[10px] leading-[17px] text-[#94AAB8]">
          {isFa
            ? 'این درصدها بر اساس ضرایب فعلی و فرض استقلال انتخاب‌های میکس تخمین زده می‌شوند؛ پیش‌بینی قطعی یا تضمین برد نیستند. برگشت وجه ناشی از لغو رویداد در مدل محاسبه نشده است.'
            : 'Estimated from current market odds, assuming independent accumulator legs. Not a prediction or guarantee. Exceptional event-cancellation refunds are not modeled.'}
        </p>
      </div>
    </section>
  );
}
