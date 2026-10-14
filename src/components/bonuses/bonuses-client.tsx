'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight, ArrowUpRight, BadgePercent, Check, CheckCircle2, ChevronDown,
  ChevronRight, Clock3, Gift, Headphones, History, Hourglass, Layers3,
  RefreshCw, ShieldCheck, Sparkles, Trophy, WalletCards,
} from 'lucide-react';
import { useApp } from '@/components/layout/providers';

type BonusStatus = 'active' | 'locked' | 'won' | 'lost' | 'expired' | 'cancelled';
type BonusItem = {
  id: string;
  promotionId: string | null;
  promotionKey: string | null;
  title: string;
  description: string | null;
  depositPaymentTransactionId: string;
  currency: string;
  amountMinor: string;
  remainingAmountMinor: string;
  status: BonusStatus;
  grantedAt: string;
  expiresAt: string;
  lockedAt: string | null;
  usedAt: string | null;
  betId: string | null;
};
type BonusesResponse = {
  promotion: {
    id: string;
    code: string;
    type: string;
    title: string;
    description: string | null;
    percentageBps: number;
    minDepositMinor: string | null;
    maxBonusMinor: string | null;
    isActive: boolean;
  } | null;
  summary: {
    total: number;
    active: number;
    locked: number;
    won: number;
    lost: number;
    expired: number;
    cancelled: number;
    activeAmountMinor: string;
    lockedAmountMinor: string;
  };
  items: BonusItem[];
  hasMore?: boolean;
};

type Copy = (english: string, persian: string) => string;

const statusStyles: Record<BonusStatus, string> = {
  active: 'bg-[#E8FFF4] text-[#077648] border-[#BBF2D7]',
  locked: 'bg-[#FFF5E5] text-[#91611C] border-[#F8D8A2]',
  won: 'bg-[#E7F2FF] text-[#1264AE] border-[#C3DEFB]',
  lost: 'bg-[#FFF0F1] text-[#B72D40] border-[#FBD0D6]',
  expired: 'bg-[#EFF1F3] text-[#636F79] border-[#DCE2E6]',
  cancelled: 'bg-[#EFF1F3] text-[#636F79] border-[#DCE2E6]',
};
function statusLabel(status: BonusStatus, copy: Copy) {
  const labels: Record<BonusStatus, [string, string]> = {
    active: ['Active', 'فعال'],
    locked: ['In use', 'در حال استفاده'],
    won: ['Won', 'برنده'],
    lost: ['Lost', 'بازنده'],
    expired: ['Expired', 'منقضی‌شده'],
    cancelled: ['Cancelled', 'لغوشده'],
  };
  return copy(...labels[status]);
}
function formatMinor(minor: string, currency: string) {
  try {
    const integer = BigInt(minor);
    const digits = ['USD', 'EUR', 'GBP'].includes(currency) ? 2 : 0;
    const amount = Number(integer) / 100;
    if (!Number.isFinite(amount)) return '—';
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: digits, maximumFractionDigits: digits,
    }).format(amount) + ' ' + currency;
  } catch { return '—'; }
}
function prettyDate(date: string, locale: 'fa' | 'en') {
  const d = new Date(date);
  if (!Number.isFinite(d.getTime())) return '—';
  return new Intl.DateTimeFormat(locale === 'fa' ? 'fa-IR' : 'en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  }).format(d);
}
function timeRemaining(expiresAt: string, now: number) {
  const value = (new Date(expiresAt).getTime() - now) / 1000;
  const remaining = Number.isFinite(value) ? Math.max(0, Math.ceil(value)) : 0;
  const d = Math.floor(remaining / 86400);
  const h = Math.floor((remaining % 86400) / 3600);
  const m = Math.floor((remaining % 3600) / 60);
  const s = remaining % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return { seconds: remaining, label: (d ? d + 'd ' : '') + pad(h) + ':' + pad(m) + ':' + pad(s) };
}

function Status({ status, copy }: { status: BonusStatus; copy: Copy }) {
  return <span className={'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-extrabold ' + statusStyles[status]}>
    <span className="h-1.5 w-1.5 rounded-full bg-current" />
    <span dir="auto">{statusLabel(status, copy)}</span>
  </span>;
}

function BonusCard({ item, copy, locale, now }: {
  item: BonusItem; copy: Copy; locale: 'fa' | 'en'; now: number;
}) {
  const active = item.status === 'active';
  const locked = item.status === 'locked';
  const available = active || locked;
  const total = Number(item.amountMinor);
  const remaining = Number(item.remainingAmountMinor);
  const pct = total > 0 && Number.isFinite(total) && Number.isFinite(remaining)
    ? Math.max(0, Math.min(100, (remaining / total) * 100)) : 0;
  const time = timeRemaining(item.expiresAt, now);
  const urgent = available && time.seconds > 0 && time.seconds <= 6 * 3600;
  return (
    <article className="group relative min-w-0 overflow-hidden rounded-[23px] border border-[#263D48] bg-[linear-gradient(135deg,#10242B_0%,#0B1922_72%,#11231F_100%)] p-4 shadow-[0_14px_44px_rgba(0,0,0,.16)] transition-colors hover:border-[#00D47A]/50 sm:p-5">
      <div className="pointer-events-none absolute -right-14 -top-16 h-48 w-48 rounded-full bg-[#00D47A]/[0.07] blur-3xl" />
      <div className="relative flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#00D47A]/25 bg-[#00D47A]/10 text-[#00D47A]">
            <Gift size={21} strokeWidth={1.8} />
          </div>
          <div className="min-w-0">
            <div dir="auto" className="text-sm font-extrabold text-white">{copy('Deposit reward', 'پاداش واریز')}</div>
            <div dir="auto" className="mt-0.5 text-[11px] font-medium text-[#9CAEB9]">{copy('Bonus account', 'حساب بونوس')}</div>
          </div>
        </div>
        <Status status={item.status} copy={copy} />
      </div>
      <div className="relative mt-6 grid grid-cols-2 gap-3">
        <div>
          <p dir="auto" className="text-[11px] font-semibold text-[#A2B3BD]">{copy('Bonus amount', 'مبلغ بونوس')}</p>
          <p className="mt-1 text-[clamp(17px,3vw,25px)] font-black tabular-nums tracking-tight text-white">{formatMinor(item.amountMinor, item.currency)}</p>
        </div>
        <div className="border-l border-white/10 pl-3">
          <p dir="auto" className="text-[11px] font-semibold text-[#A2B3BD]">{copy('Remaining', 'باقی‌مانده')}</p>
          <p className="mt-1 text-[clamp(17px,3vw,25px)] font-black tabular-nums tracking-tight text-[#4CE7A8]">{formatMinor(item.remainingAmountMinor, item.currency)}</p>
        </div>
      </div>
      <div className="relative mt-5">
        <div className="flex items-center justify-between gap-2 text-[11px]">
          <span dir="auto" className="font-semibold text-[#A2B3BD]">{copy('Remaining balance', 'موجودی باقی‌مانده')}</span>
          <span className="font-bold tabular-nums text-[#D7E7E9]">{Math.round(pct)}%</span>
        </div>
        <div role="progressbar" aria-label={copy('Remaining bonus balance', 'موجودی باقی‌مانده بونوس')} aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-[linear-gradient(90deg,#00D47A,#61F5BF)] transition-[width] duration-500" style={{ width: String(pct) + '%' }} />
        </div>
      </div>
      <div className={'relative mt-4 flex items-center justify-between gap-3 rounded-xl border px-3 py-3 ' + (urgent ? 'border-[#E4AF57]/30 bg-[#E4AF57]/10' : 'border-white/10 bg-white/[0.035]')}>
        <div className="flex min-w-0 items-center gap-2.5">
          <Clock3 size={17} className={urgent ? 'shrink-0 text-[#F3C06A]' : 'shrink-0 text-[#00D47A]'} />
          <div className="min-w-0">
            <p dir="auto" className="text-[11px] font-extrabold text-white">{available ? copy('Time remaining', 'زمان باقی‌مانده') : copy('Expiry date', 'تاریخ انقضا')}</p>
            <p dir="auto" className="mt-0.5 text-[10px] text-[#A2B2B9]">{copy('Granted', 'تاریخ اعطا')}: {prettyDate(item.grantedAt, locale)}</p>
          </div>
        </div>
        <span className={'shrink-0 font-mono text-[13px] font-black tabular-nums ' + (urgent ? 'text-[#F3C06A]' : 'text-[#E8FFFA]')} dir="ltr">
          {available ? time.label : prettyDate(item.expiresAt, locale)}
        </span>
      </div>
      <div className="relative mt-4 flex flex-wrap items-center justify-between gap-3">
        <span dir="auto" className="text-[11px] font-semibold text-[#A5B8BD]">{copy('4 picks · 1.60+ each · Accumulator', '۴ انتخاب · هرکدام ۱٫۶۰+ · ترکیبی')}</span>
        {available ? (
          <Link href="/sports/football" className="inline-flex items-center gap-1.5 rounded-xl bg-[#00D47A] px-4 py-2.5 text-xs font-black text-[#06251A] transition hover:bg-[#37E7A0]">
            {copy('Explore matches', 'مشاهده مسابقات')} <ArrowUpRight size={15} />
          </Link>
        ) : <Status status={item.status} copy={copy} />}
      </div>
    </article>
  );
}

const faqItems: Array<{ en: string; fa: string; aEn: string; aFa: string }> = [
  {
    en: 'How do I receive a deposit bonus?', fa: 'چطور بونوس واریز دریافت کنم؟',
    aEn: 'An eligible successful deposit generates an independent deposit bonus according to the current promotion rules.',
    aFa: 'هر واریز موفق واجد شرایط، مطابق قوانین طرح، یک بونوس واریز مستقل ایجاد می‌کند.',
  },
  {
    en: 'How long is my bonus valid?', fa: 'بونوس من چه مدت اعتبار دارد؟',
    aEn: 'Each bonus is valid for 24 hours from the time it is granted. Unused funds expire after the validity period.',
    aFa: 'هر بونوس از زمان اعطا ۲۴ ساعت اعتبار دارد و موجودی استفاده‌نشده پس از آن منقضی می‌شود.',
  },
  {
    en: 'What are the wagering requirements?', fa: 'شرایط ثبت شرط با بونوس چیست؟',
    aEn: 'Place an accumulator with exactly four selections. Each selection must have odds of at least 1.60 and the stake must equal the bonus amount. Use the Bonus Account only.',
    aFa: 'یک شرط ترکیبی با دقیقاً چهار انتخاب ثبت کنید. ضریب هر انتخاب باید حداقل ۱٫۶۰ و مبلغ شرط برابر کل مبلغ بونوس باشد. فقط از حساب بونوس استفاده کنید.',
  },
  {
    en: 'Can I combine my bonus and cash balance?', fa: 'آیا می‌توان موجودی بونوس و نقدی را ترکیب کرد؟',
    aEn: 'No. Bonus bets use the Bonus Account only and cannot be mixed with funds in your Main Account.',
    aFa: 'خیر. شرط بونوسی فقط از حساب بونوس ثبت می‌شود و با موجودی حساب اصلی قابل ترکیب نیست.',
  },
  {
    en: 'What happens when a bonus bet wins or loses?', fa: 'اگر شرط بونوسی ببرد یا ببازد چه می‌شود؟',
    aEn: 'For a qualifying winning bonus bet, only the original bonus amount is credited to your Main Account, not the entire accumulator payout. A losing bonus bet does not credit your Main Account.',
    aFa: 'اگر شرط بونوسی واجد شرایط برنده شود، فقط مبلغ اولیه بونوس به حساب اصلی افزوده می‌شود، نه کل پرداخت شرط ترکیبی. باخت شرط بونوسی مبلغی به حساب اصلی اضافه نمی‌کند.',
  },
];

export function BonusesClient() {
  const { locale, session, sessionLoading } = useApp();
  const copy: Copy = (english, persian) => locale === 'fa' ? persian : english;
  const authenticated = Boolean(session?.authenticated);
  const [data, setData] = useState<BonusesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  const [faqOpen, setFaqOpen] = useState<number | null>(0);
  const [historyFilter, setHistoryFilter] = useState<'all' | BonusStatus>('all');
  const [expandedRecord, setExpandedRecord] = useState<string | null>(null);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/bonuses', {
        credentials: 'include', cache: 'no-store', signal,
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) {
        setError(res.status === 401 ? 'sign-in' : 'unavailable');
        setData(null);
        return;
      }
      const payload = (await res.json()) as { ok?: boolean; data?: BonusesResponse } | BonusesResponse;
      const result = 'data' in payload ? payload.data : payload;
      if (!result || !result.summary || !Array.isArray(result.items)) {
        setError('unavailable');
        setData(null);
        return;
      }
      if (!signal?.aborted) { setData(result); setError(null); }
    } catch (e) {
      if (!(e instanceof Error && e.name === 'AbortError')) setError('unavailable');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (sessionLoading) return;
    if (!authenticated) { setData(null); setError(null); setLoading(false); return; }
    const controller = new AbortController();
    void refresh(controller.signal);
    const id = window.setInterval(() => {
      if (!document.hidden) void refresh(controller.signal);
    }, 30000);
    return () => { controller.abort(); window.clearInterval(id); };
  }, [authenticated, sessionLoading, refresh]);

  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const activeBonuses = useMemo(() => data?.items.filter(x => x.status === 'active' || x.status === 'locked') ?? [], [data]);
  const pastBonuses = useMemo(() => data?.items.filter(x => x.status !== 'active' && x.status !== 'locked') ?? [], [data]);
  const filteredHistory = useMemo(() => pastBonuses.filter(x => historyFilter === 'all' || x.status === historyFilter), [pastBonuses, historyFilter]);
  const expiring = activeBonuses.filter(x => {
    const ms = new Date(x.expiresAt).getTime() - now;
    return ms > 0 && ms <= 6 * 60 * 60 * 1000;
  }).length;
  const percentage = data?.promotion?.isActive ? data.promotion.percentageBps / 100 : 100;
  const percentageLabel = Number.isInteger(percentage) ? String(percentage) : percentage.toFixed(2);
  const showAccount = authenticated && !sessionLoading;
  const summaryLoaded = showAccount && !!data;
  const currency = data?.items[0]?.currency ?? session?.user?.currency ?? 'USD';
  const summaryAmount = summaryLoaded && data ? formatMinor(data.summary.activeAmountMinor, currency) : '—';
  const stats = [
    { label: copy('Available', 'فعال'), number: summaryLoaded && data ? String(data.summary.active) : '—', Icon: Gift, desc: copy('Ready to use', 'آماده استفاده'), iconColor: 'text-[#00D47A]' },
    { label: copy('Bonus balance', 'موجودی بونوس'), number: summaryAmount, Icon: WalletCards, desc: copy('Active rewards', 'پاداش‌های فعال'), iconColor: 'text-[#087FF5]' },
    { label: copy('Expiring soon', 'نزدیک به انقضا'), number: summaryLoaded ? String(expiring) : '—', Icon: Hourglass, desc: copy('Within 6 hours', 'تا ۶ ساعت آینده'), iconColor: 'text-[#DFA34C]' },
    { label: copy('Total received', 'کل بونوس‌ها'), number: summaryLoaded && data ? String(data.summary.total) : '—', Icon: History, desc: copy('Recorded bonuses', 'بونوس‌های ثبت‌شده'), iconColor: 'text-[#94A5B5]' },
  ];

  return (
    <div data-i18n-ignore dir="ltr" className="-mx-4 -mt-1 min-w-0 overflow-x-hidden bg-[#F0F3F4] pb-10 text-[#202B33] sm:-mx-5 lg:-mx-6">
      <div className="relative overflow-hidden bg-[#08131B]">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_78%_22%,rgba(0,212,122,.21),transparent_42%),radial-gradient(ellipse_at_5%_96%,rgba(8,127,245,.14),transparent_45%)]" />
        <div aria-hidden="true" className="pointer-events-none absolute -right-20 top-8 h-64 w-64 rounded-full border border-[#00D47A]/10 sm:h-96 sm:w-96" />
        <div aria-hidden="true" className="pointer-events-none absolute -right-6 top-20 h-52 w-52 rounded-full border border-[#00D47A]/10 sm:h-72 sm:w-72" />
        <div className="relative mx-auto max-w-[1190px] px-4 pb-9 pt-8 sm:px-7 sm:pb-12 sm:pt-12 lg:px-9 lg:pt-14">
          <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_370px] lg:gap-12">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#00D47A]/25 bg-[#00D47A]/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.08em] text-[#66F0B2]">
                <Sparkles size={13} />
                <span dir="auto">{copy('BETVIMA REWARDS', 'پاداش‌های بت‌ویما')}</span>
                <span className="ml-1 h-1.5 w-1.5 rounded-full bg-[#00D47A]" />
              </div>
              <h1 className="mt-5 max-w-[620px] text-[clamp(34px,6vw,66px)] font-black leading-[1.05] tracking-[-0.045em] text-white">
                <span dir="auto" className="block">{copy('More value.', 'ارزش بیشتر.')}</span>
                <span dir="auto" className="mt-1 block text-[#00D47A]">{copy('Every deposit.', 'با هر واریز.')}</span>
              </h1>
              <p dir="auto" className="mt-5 max-w-[510px] text-[13px] font-medium leading-7 text-[#A6B7C1] sm:text-[15px]">
                {copy(
                  'Eligible deposits can unlock a matching bonus. Discover your rewards, track their expiry and see the rules before you play.',
                  'واریزهای واجد شرایط می‌توانند بونوس معادل دریافت کنند. پاداش‌ها، زمان انقضا و قوانین استفاده را در یک صفحه شفاف ببینید.',
                )}
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Link href="/wallet" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#00D47A] px-5 text-[13px] font-black text-[#062218] shadow-[0_10px_30px_rgba(0,212,122,.19)] transition hover:bg-[#33E8A0]">
                  <WalletCards size={18} />
                  <span dir="auto">{copy('Go to Wallet', 'رفتن به کیف پول')}</span>
                  <ArrowUpRight size={17} />
                </Link>
                <a href="#bonus-how-it-works" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#3B525D] bg-white/[0.045] px-5 text-[13px] font-bold text-[#EAF5F4] transition hover:bg-white/10">
                  <span dir="auto">{copy('Explore the benefits', 'آشنایی با مزایا')}</span>
                  <ArrowRight size={16} />
                </a>
              </div>
              <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] font-semibold text-[#A9B9C0]">
                <span className="inline-flex items-center gap-1.5"><CheckCircle2 size={15} className="text-[#00D47A]" /><span dir="auto">{copy('Eligible deposits', 'واریزهای واجد شرایط')}</span></span>
                <span className="inline-flex items-center gap-1.5"><Clock3 size={15} className="text-[#00D47A]" /><span dir="auto">{copy('24-hour validity', 'اعتبار ۲۴ ساعته')}</span></span>
                <span className="inline-flex items-center gap-1.5"><ShieldCheck size={15} className="text-[#00D47A]" /><span dir="auto">{copy('Clear bonus rules', 'قوانین شفاف بونوس')}</span></span>
              </div>
            </div>

            <div className="relative min-w-0 lg:pl-2">
              <div aria-hidden="true" className="absolute inset-x-7 -bottom-4 h-16 rounded-full bg-[#00D47A]/20 blur-3xl" />
              <div className="relative overflow-hidden rounded-[27px] border border-[#365347] bg-[linear-gradient(145deg,#1A3930,#0E2024_58%,#08151D)] p-[1px] shadow-[0_24px_60px_rgba(0,0,0,.35)]">
                <div className="rounded-[26px] bg-[radial-gradient(ellipse_at_100%_0%,rgba(0,212,122,.11),transparent_54%)] p-5 sm:p-6">
                  <div className="flex items-center justify-between">
                    <span dir="auto" className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#A7C2BA]">{copy('DEPOSIT BONUS', 'بونوس واریز')}</span>
                    <BadgePercent className="text-[#00D47A]" size={23} strokeWidth={1.7} />
                  </div>
                  <div className="mt-5 flex items-baseline gap-1.5">
                    <span className="text-[clamp(72px,12vw,103px)] font-black leading-none tabular-nums tracking-[-0.09em] text-white">{percentageLabel}</span>
                    <span className="text-[44px] font-black leading-none text-[#00D47A]">%</span>
                  </div>
                  <p dir="auto" className="mt-3 max-w-[260px] text-[13px] font-medium leading-6 text-[#B8CFCA]">
                    {copy('Potential matching bonus on eligible deposits.', 'بونوس معادل برای واریزهای واجد شرایط.')}
                  </p>
                  <div className="mt-6 grid grid-cols-2 gap-2.5 border-t border-white/10 pt-4">
                    <div className="rounded-xl border border-white/10 bg-white/[0.045] p-3">
                      <Clock3 size={18} className="text-[#00D47A]" />
                      <p dir="auto" className="mt-2 text-[10px] font-semibold text-[#A1B9B7]">{copy('Validity', 'مدت اعتبار')}</p>
                      <p dir="auto" className="mt-0.5 text-sm font-black text-white">{copy('24 hours', '۲۴ ساعت')}</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/[0.045] p-3">
                      <Layers3 size={18} className="text-[#5EABFF]" />
                      <p dir="auto" className="mt-2 text-[10px] font-semibold text-[#A1B9B7]">{copy('Bet type', 'نوع شرط')}</p>
                      <p dir="auto" className="mt-0.5 text-sm font-black text-white">{copy('Accumulator', 'ترکیبی')}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-3 text-[11px] font-semibold text-[#A7C6B8]">
                    <span dir="auto">{copy('Rewards by BetVima', 'پاداش‌های بت‌ویما')}</span>
                    <span className="font-black tracking-wider text-[#00D47A]">BETVIMA / 100</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-[1190px] space-y-11 px-4 pb-4 pt-7 sm:space-y-14 sm:px-7 sm:pt-9 lg:px-9">
        <section aria-labelledby="bonus-overview-title">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#198864]">{copy('YOUR OVERVIEW', 'نمای کلی حساب شما')}</p>
              <h2 id="bonus-overview-title" dir="auto" className="mt-1 text-[21px] font-black tracking-tight text-[#17262F] sm:text-[26px]">{copy('Rewards at a glance', 'پاداش‌های شما در یک نگاه')}</h2>
            </div>
            {showAccount ? <button type="button" onClick={() => void refresh()} disabled={loading} aria-label={copy('Refresh bonuses', 'به‌روزرسانی بونوس‌ها')} className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#D7DFE1] bg-white text-[#35515D] shadow-sm transition hover:border-[#00D47A] disabled:opacity-50"><RefreshCw size={17} className={loading ? 'animate-spin' : ''} /></button> : null}
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {stats.map(({ label, number, Icon, desc, iconColor }) => (
              <div key={label} className="min-w-0 rounded-[19px] border border-[#E0E6E8] bg-white p-4 shadow-[0_7px_26px_rgba(12,29,37,.035)] sm:p-5">
                <div className="flex items-center justify-between gap-2">
                  <span dir="auto" className="text-[11px] font-extrabold text-[#60737F]">{label}</span>
                  <Icon size={19} className={iconColor} />
                </div>
                <div className="mt-4 break-words text-[clamp(19px,3vw,30px)] font-black tabular-nums tracking-tight text-[#14242C]">{number}</div>
                <p dir="auto" className="mt-1 text-[10px] font-semibold text-[#83939A]">{desc}</p>
              </div>
            ))}
          </div>
          {!sessionLoading && !authenticated ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#D6E4DE] bg-[#EAF5EF] px-4 py-3">
              <p dir="auto" className="text-xs font-bold leading-5 text-[#325846]">{copy('Sign in to see your real balance, active rewards and history.', 'برای مشاهده موجودی واقعی، پاداش‌های فعال و تاریخچه، وارد حساب شوید.')}</p>
              <Link href="/auth/login" className="inline-flex items-center gap-1.5 text-xs font-black text-[#087A4C] hover:underline">{copy('Sign in', 'ورود')} <ArrowUpRight size={14} /></Link>
            </div>
          ) : null}
          {showAccount && error ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#F4D5CC] bg-[#FFF2EE] px-4 py-3 text-xs font-semibold text-[#A34939]">
              <span dir="auto">{error === 'sign-in' ? copy('Your session expired. Please sign in again.', 'نشست شما منقضی شده است. دوباره وارد شوید.') : copy('We could not load your bonuses. Your balance is unchanged.', 'بارگذاری بونوس‌ها ممکن نشد. موجودی شما تغییری نکرده است.')}</span>
              <button type="button" onClick={() => void refresh()} className="font-black underline">{copy('Retry', 'تلاش مجدد')}</button>
            </div>
          ) : null}
        </section>

        <section aria-labelledby="bonus-active-title">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#198864]">{copy('YOUR REWARDS', 'پاداش‌های شما')}</p>
              <h2 id="bonus-active-title" dir="auto" className="mt-1 text-[22px] font-black tracking-tight text-[#17262F] sm:text-[29px]">{copy('Active bonuses', 'بونوس‌های فعال')}</h2>
              <p dir="auto" className="mt-1 text-xs font-medium text-[#687C86]">{copy('Know what is available, what is in use and when it expires.', 'بونوس‌های در دسترس، در حال استفاده و زمان انقضای آن‌ها را ببینید.')}</p>
            </div>
            {summaryLoaded ? <span className="rounded-full border border-[#D4E8DF] bg-[#E5F6EE] px-3 py-1 text-xs font-black text-[#0A8254]">{activeBonuses.length} {copy('available', 'مورد')}</span> : null}
          </div>
          {showAccount && loading && !data ? (
            <div className="grid gap-4 md:grid-cols-2">
              {[0, 1].map(n => <div key={n} className="h-72 animate-pulse rounded-[24px] bg-[#DDE5E6]" />)}
            </div>
          ) : activeBonuses.length > 0 && showAccount ? (
            <div className="grid min-w-0 gap-4 lg:grid-cols-2">
              {activeBonuses.map(item => <BonusCard key={item.id} item={item} locale={locale} now={now} copy={copy} />)}
            </div>
          ) : (
            <div className="relative overflow-hidden rounded-[24px] border border-[#D9E3E5] bg-white px-5 py-8 text-center shadow-sm sm:py-11">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_100%,rgba(0,212,122,.07),transparent_60%)]" />
              <div className="relative">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[17px] border border-[#D6E9DF] bg-[#EFF8F3] text-[#09875A]"><Gift size={26} /></div>
                <h3 dir="auto" className="mt-4 text-lg font-black text-[#19303A]">{!authenticated ? copy('Your rewards live here', 'پاداش‌های شما اینجا نمایش داده می‌شوند') : copy('No active bonuses right now', 'فعلاً بونوس فعالی ندارید')}</h3>
                <p dir="auto" className="mx-auto mt-1.5 max-w-[430px] text-xs font-medium leading-6 text-[#748790]">
                  {!authenticated ? copy('Sign in to follow your real bonuses. You can explore the promotion rules below.', 'برای پیگیری بونوس‌های واقعی وارد شوید. قوانین طرح را هم در ادامه ببینید.') : copy('Your next eligible deposit may unlock a new reward under the promotion terms.', 'واریز واجد شرایط بعدی شما ممکن است طبق قوانین طرح یک پاداش جدید فعال کند.')}
                </p>
                <Link href={!authenticated ? '/auth/login' : '/wallet'} className="mt-5 inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#112F27] px-5 text-xs font-black text-white transition hover:bg-[#176444]">
                  {authenticated ? copy('Visit Wallet', 'رفتن به کیف پول') : copy('Sign in', 'ورود')} <ArrowUpRight size={15} />
                </Link>
              </div>
            </div>
          )}
        </section>

        <section id="bonus-how-it-works" aria-labelledby="bonus-how-title">
          <div className="mb-5">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#198864]">{copy('THE JOURNEY', 'مراحل دریافت')}</p>
            <h2 id="bonus-how-title" dir="auto" className="mt-1 text-[22px] font-black tracking-tight text-[#17262F] sm:text-[29px]">{copy('Three steps. One clear path.', 'سه مرحله، یک مسیر روشن.')}</h2>
            <p dir="auto" className="mt-1 text-xs font-medium text-[#687C86]">{copy('Follow the process from deposit to your bonus-funded bet.', 'از واریز تا ثبت شرط با بونوس، تمام مسیر را بشناسید.')}</p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {([
              { n: '01', Icon: WalletCards, en: 'Make a deposit', fa: 'واریز انجام دهید', a: 'Use your preferred supported payment method for an eligible deposit.', b: 'با یکی از روش‌های پرداخت پشتیبانی‌شده، واریز واجد شرایط انجام دهید.' },
              { n: '02', Icon: Gift, en: 'Receive your reward', fa: 'بونوس را دریافت کنید', a: 'The matching reward is issued to your Bonus Account when eligible.', b: 'در صورت واجد شرایط بودن، پاداش معادل به حساب بونوس شما اختصاص می‌یابد.' },
              { n: '03', Icon: Trophy, en: 'Use it within 24h', fa: 'تا ۲۴ ساعت استفاده کنید', a: 'Place a qualifying four-selection accumulator using the Bonus Account.', b: 'از حساب بونوس یک شرط ترکیبی واجد شرایط با چهار انتخاب ثبت کنید.' },
            ] as const).map((step, i) => (
              <article key={step.n} className="relative min-w-0 overflow-hidden rounded-[21px] border border-[#DFE6E8] bg-white p-5 shadow-[0_10px_25px_rgba(19,43,49,.035)] sm:p-6">
                <div className="flex items-center justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#E9F8F0] text-[#0B8E5B]"><step.Icon size={21} /></div>
                  <span className="font-mono text-[36px] font-black leading-none tracking-[-0.06em] text-[#E0E8E9]">{step.n}</span>
                </div>
                <h3 dir="auto" className="mt-4 text-[15px] font-black text-[#1D333C]">{copy(step.en, step.fa)}</h3>
                <p dir="auto" className="mt-2 text-xs font-medium leading-6 text-[#657C88]">{copy(step.a, step.b)}</p>
                {i < 2 ? <div className="absolute -right-2 top-6 hidden h-4 w-4 rotate-45 border-r border-t border-[#DFE6E8] bg-white md:block" /> : null}
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="bonus-rules-title" className="overflow-hidden rounded-[25px] bg-[linear-gradient(135deg,#10252E,#071820)] p-5 text-white sm:p-7 lg:p-8">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#00D47A]">{copy('THE ESSENTIALS', 'قوانین ضروری')}</p>
              <h2 id="bonus-rules-title" dir="auto" className="mt-1 text-[22px] font-black tracking-tight sm:text-[28px]">{copy('Understand the bonus rules', 'قوانین بونوس را دقیق بدانید')}</h2>
              <p dir="auto" className="mt-2 max-w-xl text-xs leading-6 text-[#B4C5CE]">{copy('The conditions below apply to the existing deposit-bonus betting flow.', 'شرایط زیر مربوط به فرایند فعلی شرط‌بندی با بونوس واریز است.')}</p>
            </div>
            <ShieldCheck className="text-[#00D47A]" size={31} strokeWidth={1.5} />
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {([
              ['04', 'Selections', 'انتخاب', 'Exactly four', 'دقیقاً چهار'],
              ['1.60+', 'Min. odds', 'حداقل ضریب', 'Each selection', 'هر انتخاب'],
              ['24h', 'Validity', 'اعتبار', 'From issuance', 'از زمان اعطا'],
              ['100%', 'Bonus stake', 'مبلغ شرط بونوسی', 'Equal to bonus', 'برابر بونوس'],
            ] as const).map(([value, labelEn, labelFa, noteEn, noteFa]) => (
              <div key={value} className="rounded-[17px] border border-white/10 bg-white/[0.045] p-4">
                <strong className="block text-[29px] font-black tabular-nums text-[#62EAB0]">{value}</strong>
                <p dir="auto" className="mt-1 text-xs font-black text-white">{copy(labelEn, labelFa)}</p>
                <p dir="auto" className="mt-1 text-[11px] font-medium text-[#A9BEC4]">{copy(noteEn, noteFa)}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 flex items-start gap-3 rounded-xl border border-[#2E5550] bg-[#00D47A]/[0.08] p-4 text-xs font-medium leading-6 text-[#C4E1D7]">
            <Check size={18} className="mt-0.5 shrink-0 text-[#00D47A]" />
            <p dir="auto">{copy('Bonus and cash balances cannot be combined. For a qualifying win, only the original bonus amount is credited to the Main Account, not the full accumulator payout.', 'موجودی نقدی و بونوس قابل ترکیب نیستند. در صورت برد واجد شرایط، فقط مبلغ اولیه بونوس به حساب اصلی افزوده می‌شود، نه کل پرداخت شرط ترکیبی.')}</p>
          </div>
        </section>

        <section aria-labelledby="bonus-history-title">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#198864]">{copy('YOUR ACTIVITY', 'فعالیت حساب')}</p>
              <h2 id="bonus-history-title" dir="auto" className="mt-1 text-[22px] font-black tracking-tight text-[#17262F] sm:text-[29px]">{copy('Bonus history', 'تاریخچه بونوس‌ها')}</h2>
              <p dir="auto" className="mt-1 text-xs font-medium text-[#687C86]">{copy('All recorded outcomes in one place.', 'نتایج ثبت‌شده بونوس‌ها در یک محل.')}</p>
            </div>
            {pastBonuses.length > 0 ? <span className="rounded-xl bg-[#E6EBED] px-3 py-1.5 text-[11px] font-extrabold text-[#55717B]">{pastBonuses.length} {copy('records', 'رکورد')}</span> : null}
          </div>
          <div className="rounded-[22px] border border-[#DCE5E7] bg-white p-3 shadow-[0_12px_30px_rgba(19,43,49,.04)] sm:p-4">
            <div className="flex gap-1.5 overflow-x-auto pb-3" role="group" aria-label={copy('Filter bonus history', 'فیلتر تاریخچه بونوس')}>
              {([
                ['all', 'All', 'همه'],
                ['won', 'Won', 'برنده'],
                ['lost', 'Lost', 'بازنده'],
                ['expired', 'Expired', 'منقضی'],
                ['cancelled', 'Cancelled', 'لغوشده'],
              ] as const).map(([value, en, fa]) => (
                <button key={value} type="button" aria-pressed={historyFilter === value} onClick={() => setHistoryFilter(value)} className={'shrink-0 rounded-lg px-3 py-2 text-xs font-extrabold transition ' + (historyFilter === value ? 'bg-[#0D3024] text-white' : 'bg-[#F1F4F5] text-[#62737C] hover:bg-[#E8EEEA]')}>
                  {copy(en, fa)}
                </button>
              ))}
            </div>
            {!authenticated || !showAccount || !data ? (
              <div className="py-10 text-center">
                <History className="mx-auto text-[#9AABB2]" size={26} />
                <p dir="auto" className="mt-2 text-xs font-semibold text-[#738891]">{authenticated ? copy('No history to display yet.', 'هنوز تاریخچه‌ای برای نمایش وجود ندارد.') : copy('Sign in to view your bonus history.', 'برای دیدن تاریخچه بونوس وارد شوید.')}</p>
              </div>
            ) : filteredHistory.length === 0 ? (
              <p dir="auto" className="py-10 text-center text-xs font-semibold text-[#81939B]">{copy('No records match this filter.', 'رکوردی مطابق این فیلتر وجود ندارد.')}</p>
            ) : (
              <div className="divide-y divide-[#E9EEF0]">
                {filteredHistory.map(item => (
                  <div key={item.id} className="min-w-0">
                    <button type="button" onClick={() => setExpandedRecord(expandedRecord === item.id ? null : item.id)} aria-expanded={expandedRecord === item.id} className="flex w-full min-w-0 items-center justify-between gap-3 rounded-xl px-2 py-3.5 text-left transition hover:bg-[#F6F9F8] sm:px-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EDF3F3] text-[#577880]"><Gift size={18} /></div>
                        <div className="min-w-0">
                          <p dir="auto" className="text-xs font-black text-[#20333C]">{copy('Deposit reward', 'پاداش واریز')}</p>
                          <p className="mt-1 text-xs font-bold tabular-nums text-[#5E7880]">{formatMinor(item.amountMinor, item.currency)}</p>
                          <p className="mt-0.5 text-[10px] text-[#8B9BA3]">{prettyDate(item.grantedAt, locale)}</p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Status status={item.status} copy={copy} />
                        <ChevronDown size={15} className={'text-[#8299A0] transition-transform ' + (expandedRecord === item.id ? 'rotate-180' : '')} />
                      </div>
                    </button>
                    {expandedRecord === item.id ? (
                      <dl className="mb-3 grid grid-cols-2 gap-x-3 gap-y-3 rounded-xl bg-[#F4F8F7] px-4 py-4 text-xs sm:grid-cols-4">
                        <div><dt dir="auto" className="text-[10px] font-semibold text-[#7A9299]">{copy('Granted', 'تاریخ اعطا')}</dt><dd className="mt-1 font-bold text-[#20333C]">{prettyDate(item.grantedAt, locale)}</dd></div>
                        <div><dt dir="auto" className="text-[10px] font-semibold text-[#7A9299]">{copy('Expires', 'تاریخ انقضا')}</dt><dd className="mt-1 font-bold text-[#20333C]">{prettyDate(item.expiresAt, locale)}</dd></div>
                        <div><dt dir="auto" className="text-[10px] font-semibold text-[#7A9299]">{copy('Remaining', 'باقی‌مانده')}</dt><dd className="mt-1 font-bold text-[#20333C]">{formatMinor(item.remainingAmountMinor, item.currency)}</dd></div>
                        <div><dt dir="auto" className="text-[10px] font-semibold text-[#7A9299]">{copy('Bet reference', 'شناسه شرط')}</dt><dd className="mt-1 break-all font-mono text-[10px] font-bold text-[#20333C]">{item.betId ?? '—'}</dd></div>
                      </dl>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
            {data?.hasMore ? <p dir="auto" className="pt-3 text-center text-[10px] font-semibold text-[#8A989E]">{copy('Showing the latest records. Older records may not appear here.', 'آخرین رکوردها نمایش داده می‌شوند؛ سوابق قدیمی‌تر ممکن است در این صفحه نباشند.')}</p> : null}
          </div>
        </section>

        <section aria-labelledby="bonus-faq-title">
          <div className="mb-5">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#198864]">{copy('GOOD TO KNOW', 'نکات مهم')}</p>
            <h2 id="bonus-faq-title" dir="auto" className="mt-1 text-[22px] font-black tracking-tight text-[#17262F] sm:text-[29px]">{copy('Frequently asked questions', 'پرسش‌های متداول')}</h2>
          </div>
          <div className="grid items-start gap-2.5 lg:grid-cols-2">
            {faqItems.map((faq, idx) => (
              <div key={faq.en} className="min-w-0 overflow-hidden rounded-[16px] border border-[#DFE7E8] bg-white">
                <button type="button" aria-expanded={faqOpen === idx} onClick={() => setFaqOpen(faqOpen === idx ? null : idx)} className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left transition hover:bg-[#F9FBFA] sm:px-5">
                  <span dir="auto" className="text-[12px] font-black leading-6 text-[#263D45]">{copy(faq.en, faq.fa)}</span>
                  <ChevronDown size={16} className={'shrink-0 text-[#78909A] transition-transform ' + (faqOpen === idx ? 'rotate-180 text-[#008653]' : '')} />
                </button>
                {faqOpen === idx ? <div dir="auto" className="border-t border-[#EDF0F1] px-4 pb-4 pt-3 text-xs font-medium leading-6 text-[#687F88] sm:px-5">{copy(faq.aEn, faq.aFa)}</div> : null}
              </div>
            ))}
          </div>
        </section>

        <section className="relative overflow-hidden rounded-[22px] bg-[#0B211A] p-5 text-white sm:p-7">
          <div aria-hidden="true" className="pointer-events-none absolute -right-14 -top-16 h-48 w-48 rounded-full bg-[#00D47A]/20 blur-3xl" />
          <div className="relative flex flex-wrap items-center justify-between gap-5">
            <div className="flex min-w-0 items-center gap-3.5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#00D47A]/25 bg-[#00D47A]/10"><Headphones size={23} className="text-[#00D47A]" /></div>
              <div>
                <h2 dir="auto" className="text-[17px] font-black text-white">{copy('Need help with your bonus?', 'درباره بونوس کمک می‌خواهید؟')}</h2>
                <p dir="auto" className="mt-1 text-xs font-medium leading-6 text-[#B0C6BC]">{copy('Our support team is here to help with rewards and requirements.', 'تیم پشتیبانی درباره پاداش‌ها و شرایط استفاده به شما کمک می‌کند.')}</p>
              </div>
            </div>
            <Link href="/support" className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-[#2F6650] bg-[#16442E] px-5 text-xs font-black text-white transition hover:bg-[#225C3C]">
              <span dir="auto">{copy('Contact support', 'تماس با پشتیبانی')}</span> <ChevronRight size={17} />
            </Link>
          </div>
        </section>
        <p dir="auto" className="text-center text-[10px] font-medium leading-5 text-[#778A91]">
          {copy('Bonus availability and eligibility depend on the applicable terms. Play responsibly. 18+.',
            'دریافت و استفاده از بونوس تابع شرایط طرح است. مسئولانه بازی کنید. ویژه افراد بالای ۱۸ سال.')}
        </p>
      </main>
    </div>
  );
}
