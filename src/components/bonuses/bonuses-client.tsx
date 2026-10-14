'use client';

import Link from 'next/link';
import { useApp } from '@/components/layout/providers';
import { translateVisibleText } from '@/lib/i18n/ui-phrases';
import { useEffect, useMemo, useState } from 'react';
import {
  Gift,
  Clock3,
  LockKeyhole,
  Trophy,
  CircleX,
  CircleCheck,
  CircleAlert,
  ChevronDown,
  Headphones,
  RefreshCw,
  ArrowRight,
  WalletCards,
  Sparkles,
  TimerReset,
} from 'lucide-react';

type BonusStatus =
  | 'active'
  | 'locked'
  | 'won'
  | 'lost'
  | 'expired'
  | 'cancelled';

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
};

const STATUS_META: Record<
  BonusStatus,
  { label: string; icon: typeof CircleCheck; className: string }
> = {
  active: {
    label: 'Active',
    icon: CircleCheck,
    className: 'border-[#00D989]/20 bg-[#00D989]/10 text-[#00D989]',
  },
  locked: {
    label: 'Locked',
    icon: LockKeyhole,
    className: 'border-[#F4B740]/20 bg-[#F4B740]/10 text-[#F4B740]',
  },
  won: {
    label: 'Won',
    icon: Trophy,
    className: 'border-[#45A7FF]/20 bg-[#45A7FF]/10 text-[#45A7FF]',
  },
  lost: {
    label: 'Lost',
    icon: CircleX,
    className: 'border-[#FF5964]/20 bg-[#FF5964]/10 text-[#FF5964]',
  },
  expired: {
    label: 'Expired',
    icon: Clock3,
    className: 'border-[#89929E]/20 bg-[#89929E]/10 text-[#AAB2BC]',
  },
  cancelled: {
    label: 'Cancelled',
    icon: CircleAlert,
    className: 'border-[#89929E]/20 bg-[#89929E]/10 text-[#AAB2BC]',
  },
};

function formatAmount(minor: string, currency: string) {
  const value = Number(BigInt(minor)) / 100;
  const digits = ['USD', 'EUR', 'GBP'].includes(currency) ? 2 : 0;

  return `${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value)} ${currency}`;
}

function countdown(expiresAt: string, now: number) {
  const remaining = Math.max(
    0,
    Math.ceil((new Date(expiresAt).getTime() - now) / 1000),
  );

  const days = Math.floor(remaining / 86400);
  const hours = Math.floor((remaining % 86400) / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);
  const seconds = remaining % 60;

  return {
    remaining,
    text: `${String(days).padStart(2, '0')} : ${String(hours).padStart(2, '0')} : ${String(minutes).padStart(2, '0')} : ${String(seconds).padStart(2, '0')}`,
  };
}

function StatusBadge({ status }: { status: BonusStatus }) {
  const { locale } = useApp();
  const meta = STATUS_META[status];
  const Icon = meta.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[10px] font-black uppercase tracking-[0.08em] ${meta.className}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {locale === 'fa' ? translateVisibleText(meta.label) : meta.label}
    </span>
  );
}

function BonusCard({
  bonus,
  now,
  percentageBps,
}: {
  bonus: BonusItem;
  now: number;
  percentageBps: number;
}) {
  const { locale } = useApp();
  const tr = (value: string) => locale === 'fa' ? translateVisibleText(value) : value;
  const timer = countdown(bonus.expiresAt, now);
  const isActive = bonus.status === 'active';
  const isLocked = bonus.status === 'locked';
  const bonusPercentage = percentageBps / 100;

  const bonusPercentageLabel = Number.isInteger(bonusPercentage)
    ? String(bonusPercentage)
    : bonusPercentage.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');

  const amount = Number(BigInt(bonus.amountMinor));
  const remainingAmount = Number(BigInt(bonus.remainingAmountMinor));
  const progress =
    amount > 0
      ? Math.max(0, Math.min(100, (remainingAmount / amount) * 100))
      : 0;

  return (
    <article className="group relative overflow-hidden rounded-[24px] border border-[#17303B] bg-[#07131C] shadow-[0_18px_60px_rgba(0,0,0,.24)] transition duration-300 hover:-translate-y-0.5 hover:border-[#00D989]/25">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_100%_0%,rgba(0,217,137,.13),transparent_32%),radial-gradient(circle_at_0%_100%,rgba(69,167,255,.06),transparent_30%)]" />

      <div className="relative border-b border-[#16303A] px-5 pb-6 pt-5 sm:px-6 sm:pt-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#00D989]/20 bg-[#00D989]/10 shadow-[0_8px_24px_rgba(0,217,137,.08)]">
              <Gift className="h-6 w-6 text-[#00D989]" />
            </div>

            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#00D989]">
                {tr("Deposit Bonus")}
              </p>
              <p className="mt-1 text-xs font-semibold text-[#708392]">
                {bonusPercentageLabel}% {tr('promotional reward')}
              </p>
            </div>
          </div>

          <StatusBadge status={bonus.status} />
        </div>

        <div className="mt-7">
          <p className="text-xs font-bold text-[#738694]">
            {tr("Bonus amount")}
          </p>
          <div className="mt-1 flex flex-wrap items-end gap-2">
            <h3 className="text-[34px] font-black leading-none tracking-[-0.04em] text-white sm:text-[40px]">
              {formatAmount(bonus.amountMinor, bonus.currency)}
            </h3>
          </div>
          <p className="mt-3 max-w-xl text-sm leading-6 text-[#81919F]">
            {tr('Your deposit bonus is available according to the current promotion rules and can be used within its validity period.')}
          </p>
        </div>
      </div>

      <div className="relative p-5 sm:p-6">
        <div className="rounded-2xl border border-[#15303A] bg-[#091923] p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#647786]">
                {tr("Remaining")}
              </p>
              <p className="mt-1 text-lg font-black text-white">
                {formatAmount(bonus.remainingAmountMinor, bonus.currency)}
              </p>
            </div>

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#00D989]/10">
              <Sparkles className="h-4.5 w-4.5 text-[#00D989]" />
            </div>
          </div>

          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[#142630]">
            <div
              className="h-full rounded-full bg-[#00D989] shadow-[0_0_14px_rgba(0,217,137,.35)] transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="mt-2 flex justify-between text-[10px] font-bold text-[#607381]">
            <span>{tr("Bonus balance")}</span>
            <span>{Math.round(progress)}% {tr('remaining')}</span>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-[#15303A] bg-[#08151E] p-4">
            <div className="flex items-center gap-2 text-[#687B89]">
              <Clock3 className="h-4 w-4" />
              <span className="text-[10px] font-black uppercase tracking-[0.12em]">
                {tr("Granted")}
              </span>
            </div>
            <p className="mt-2 text-sm font-extrabold text-white">
              {new Date(bonus.grantedAt).toLocaleDateString('en-GB')}
            </p>
          </div>

          <div className="rounded-2xl border border-[#15303A] bg-[#08151E] p-4">
            <div className="flex items-center gap-2 text-[#687B89]">
              <TimerReset className="h-4 w-4" />
              <span className="text-[10px] font-black uppercase tracking-[0.12em]">
                {tr("Validity")}
              </span>
            </div>
            <p className="mt-2 text-sm font-extrabold text-white">
              {tr("24 hours")}
            </p>
          </div>
        </div>

        {isActive || isLocked ? (
          <div className="mt-3 overflow-hidden rounded-2xl border border-[#00D989]/15 bg-[#00D989]/[0.045]">
            <div className="flex items-center justify-between gap-4 px-4 py-4 sm:px-5">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#00D989]/10">
                  <Clock3 className="h-4 w-4 text-[#00D989]" />
                </div>
                <div>
                  <p className="text-xs font-black text-white">
                    {tr(timer.remaining > 0 ? 'Expires in' : 'Expired')}
                  </p>
                  <p className="mt-0.5 text-[10px] font-semibold text-[#657985]">
                    {tr("Use your bonus before the timer reaches zero.")}
                  </p>
                </div>
              </div>

              <span className="shrink-0 font-mono text-sm font-black tracking-wider text-[#00D989] sm:text-base">
                {timer.text}
              </span>
            </div>
          </div>
        ) : null}

        {bonus.status === 'won' ? (
          <div className="mt-3 rounded-2xl border border-[#45A7FF]/15 bg-[#45A7FF]/[0.05] p-4 text-xs leading-5 text-[#AFCDEA]">
            {tr('Your bonus has been completed successfully. The eligible bonus amount was credited to your Main Account.')}
          </div>
        ) : null}

        {bonus.status === 'lost' ? (
          <div className="mt-3 rounded-2xl border border-[#FF5964]/15 bg-[#FF5964]/[0.05] p-4 text-xs leading-5 text-[#DDB0B4]">
            {tr("This bonus was used and did not qualify for a Main Account reward.")}
          </div>
        ) : null}

        {bonus.status === 'expired' ? (
          <div className="mt-3 rounded-2xl border border-[#89929E]/15 bg-[#89929E]/[0.05] p-4 text-xs leading-5 text-[#9DA7B0]">
            {tr("This bonus expired before it was successfully used.")}
          </div>
        ) : null}
      </div>
    </article>
  );
}

const faqs = [
  [
    'How does the 100% deposit bonus work?',
    'Every successful deposit generates an independent bonus equal to 100% of the successful deposit amount.',
  ],
  [
    'How long is a bonus valid?',
    'Each bonus is valid for exactly 24 hours from the time it is granted.',
  ],
  [
    'How do I use a bonus?',
    'A bonus must be used as an accumulator with exactly 4 selections. Every selection must have odds of at least 1.60, and the stake must equal the bonus amount.',
  ],
  [
    'Can I combine a bonus with my Main Account?',
    'No. A bonus-funded bet must use the Bonus Account only. Main Account funds cannot be mixed with the bonus stake.',
  ],
  [
    'What happens when a bonus bet wins?',
    'Only the original bonus amount is credited to your Main Account. The full accumulator payout is not credited.',
  ],
  [
    'What happens when a bonus bet loses?',
    'The bonus is marked as Lost and no amount is credited to the Main Account.',
  ],
];

export function BonusesClient() {
  const { locale } = useApp();
  const tr = (value: string) => locale === 'fa' ? translateVisibleText(value) : value;
  const [data, setData] = useState<BonusesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const load = async () => {
    try {
      setError(null);

      const response = await fetch('/api/v1/bonuses', {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        if (response.status === 401) {
          setError('Please sign in to view your bonuses.');
        } else {
          setError('Unable to load your bonuses right now.');
        }
        return;
      }

      const payload = (await response.json()) as BonusesResponse;
      setData(payload);
    } catch {
      setError('Unable to load your bonuses right now.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();

    const refresh = window.setInterval(() => {
      void load();
    }, 15000);

    return () => window.clearInterval(refresh);
  }, []);

  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const activeBonuses = useMemo(
    () =>
      data?.items.filter(
        (item) => item.status === 'active' || item.status === 'locked',
      ) ?? [],
    [data],
  );

  const historyBonuses = useMemo(
    () =>
      data?.items.filter(
        (item) => item.status !== 'active' && item.status !== 'locked',
      ) ?? [],
    [data],
  );

  return (
    <div className="-mx-4 min-h-0 overflow-hidden bg-[#030A12] pb-10 text-white sm:-mx-5 lg:-mx-6">
      <section className="relative overflow-hidden border-y border-[#142632] bg-[radial-gradient(circle_at_80%_15%,rgba(0,217,137,.18),transparent_28%),radial-gradient(circle_at_15%_100%,rgba(69,167,255,.07),transparent_32%),linear-gradient(135deg,#06131B,#071019_55%,#06170F)] px-5 py-8 sm:px-8 sm:py-10 lg:px-10 lg:py-12">
        <div className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full bg-[#00D989]/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-20 h-64 w-64 rounded-full bg-[#45A7FF]/5 blur-3xl" />

        <div className="relative mx-auto max-w-6xl">
          <div className="grid gap-8 lg:grid-cols-[1fr_360px] lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#00D989]/20 bg-[#00D989]/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-[#00D989]">
                <Sparkles className="h-3.5 w-3.5" />
                {tr("NOVA Rewards")}
              </div>

              <h1 className="mt-4 max-w-2xl text-4xl font-black tracking-[-0.045em] text-white sm:text-5xl">
                {tr('Turn every deposit into')}{' '}
                <span className="text-[#00D989]">{tr("more play.")}</span>
              </h1>

              <p className="mt-4 max-w-2xl text-sm leading-7 text-[#91A2AF] sm:text-base">
                {tr('Get a 100% bonus on every successful deposit. Each bonus is independent and remains valid for 24 hours.')}
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/wallet"
                  className="inline-flex items-center gap-2 rounded-xl bg-[#00D989] px-5 py-3 text-sm font-black text-[#03120C] shadow-[0_10px_28px_rgba(0,217,137,.16)] transition hover:brightness-105"
                >
                  <WalletCards className="h-4 w-4" />
                  {tr("Make a Deposit")}
                  <ArrowRight className="h-4 w-4" />
                </Link>

                <div className="inline-flex items-center gap-2 rounded-xl border border-[#18303A] bg-black/20 px-4 py-3 text-xs font-bold text-[#8495A2]">
                  <Clock3 className="h-4 w-4 text-[#00D989]" />
                  {tr("24-hour validity")}
                </div>
              </div>
            </div>

            <div className="rounded-[24px] border border-[#19353F] bg-[#06121A]/80 p-5 shadow-[0_18px_60px_rgba(0,0,0,.22)] backdrop-blur">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-[0.15em] text-[#718492]">
                  {tr("Bonus Overview")}
                </span>
                <Gift className="h-5 w-5 text-[#00D989]" />
              </div>

              <div className="mt-5 grid grid-cols-3 gap-2">
                <div className="rounded-2xl border border-[#00D989]/15 bg-[#00D989]/[0.06] p-3">
                  <p className="text-[9px] font-black uppercase tracking-wider text-[#637783]">
                    {tr("Active")}
                  </p>
                  <p className="mt-1 text-2xl font-black text-white">
                    {data?.summary.active ?? 0}
                  </p>
                </div>

                <div className="rounded-2xl border border-[#18303A] bg-[#08151E] p-3">
                  <p className="text-[9px] font-black uppercase tracking-wider text-[#637783]">
                    {tr("Locked")}
                  </p>
                  <p className="mt-1 text-2xl font-black text-white">
                    {data?.summary.locked ?? 0}
                  </p>
                </div>

                <div className="rounded-2xl border border-[#18303A] bg-[#08151E] p-3">
                  <p className="text-[9px] font-black uppercase tracking-wider text-[#637783]">
                    {tr("Won")}
                  </p>
                  <p className="mt-1 text-2xl font-black text-white">
                    {data?.summary.won ?? 0}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-[#17303A] pt-4">
                <span className="text-xs font-semibold text-[#718492]">
                  {tr("Total bonuses")}
                </span>
                <span className="text-sm font-black text-white">
                  {data?.summary.total ?? 0}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 pt-8 sm:px-6 lg:px-8">
        <section>
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="h-5 w-1 rounded-full bg-[#00D989]" />
                <h2 className="text-2xl font-black tracking-tight text-white">
                  {tr("Available Bonuses")}
                </h2>
              </div>
              <p className="mt-2 text-sm text-[#748592]">
                {tr("Your active rewards and their remaining validity.")}
              </p>
            </div>

            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#18303A] bg-[#07131D] text-[#80909D] transition hover:border-[#00D989]/30 hover:text-[#00D989] disabled:opacity-50"
              aria-label={tr('Refresh bonuses')}
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
              />
            </button>
          </div>

          {loading && !data ? (
            <div className="rounded-[24px] border border-[#17303B] bg-[#07131D] p-12 text-center">
              <RefreshCw className="mx-auto h-7 w-7 animate-spin text-[#00D989]" />
              <p className="mt-4 text-sm font-bold text-[#8495A2]">
                {tr("Loading your bonuses...")}
              </p>
            </div>
          ) : error ? (
            <div className="rounded-[24px] border border-[#FF5964]/20 bg-[#FF5964]/[0.04] p-8 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FF5964]/10">
                <CircleAlert className="h-6 w-6 text-[#FF5964]" />
              </div>
              <p className="mt-4 text-sm font-bold text-white">{tr(error)}</p>
              <button
                type="button"
                onClick={() => {
                  setLoading(true);
                  void load();
                }}
                className="mt-5 rounded-xl bg-white px-5 py-2.5 text-sm font-black text-[#071018] transition hover:bg-[#E8EEF1]"
              >
                {tr("Try again")}
              </button>
            </div>
          ) : activeBonuses.length === 0 ? (
            <div className="relative overflow-hidden rounded-[24px] border border-[#17303B] bg-[#07131D] p-8 text-center sm:p-12">
              <div className="pointer-events-none absolute left-1/2 top-0 h-40 w-40 -translate-x-1/2 rounded-full bg-[#00D989]/5 blur-3xl" />
              <div className="relative">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-[#18303A] bg-[#091923]">
                  <Gift className="h-7 w-7 text-[#536875]" />
                </div>
                <h3 className="mt-5 text-lg font-black text-white">
                  {tr("No active bonuses")}
                </h3>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#718390]">
                  {tr('Make a successful deposit to receive a 100% bonus automatically. Each bonus remains valid for 24 hours.')}
                </p>
                <Link
                  href="/wallet"
                  className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#00D989] px-6 py-3 text-sm font-black text-[#03120C]"
                >
                  {tr("Go to Wallet")}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid gap-5 xl:grid-cols-2">
              {activeBonuses.map((bonus) => (
                <BonusCard
                  key={bonus.id}
                  bonus={bonus}
                  now={now}
                  percentageBps={data?.promotion?.percentageBps ?? 10000}
                />
              ))}
            </div>
          )}
        </section>

        {historyBonuses.length > 0 ? (
          <section className="mt-10">
            <div className="mb-5">
              <div className="flex items-center gap-2">
                <span className="h-5 w-1 rounded-full bg-[#40515D]" />
                <h2 className="text-2xl font-black tracking-tight text-white">
                  {tr("Bonus History")}
                </h2>
              </div>
              <p className="mt-2 text-sm text-[#748592]">
                {tr("Completed, expired and cancelled bonuses.")}
              </p>
            </div>

            <div className="overflow-hidden rounded-[24px] border border-[#17303B] bg-[#07131D]">
              <div className="hidden grid-cols-[1fr_180px_120px] border-b border-[#17303B] bg-[#081720] px-5 py-3 text-[9px] font-black uppercase tracking-[0.14em] text-[#607381] sm:grid">
                <span>{tr("Bonus")}</span>
                <span>{tr("Date")}</span>
                <span className="text-right">{tr("Status")}</span>
              </div>

              <div className="divide-y divide-[#132832]">
                {historyBonuses.map((bonus) => (
                  <div
                    key={bonus.id}
                    className="grid gap-3 px-4 py-4 sm:grid-cols-[1fr_180px_120px] sm:items-center sm:px-5"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0B1A23]">
                        <Gift className="h-5 w-5 text-[#647885]" />
                      </div>
                      <div>
                        <p className="text-sm font-black text-white">
                          {formatAmount(bonus.amountMinor, bonus.currency)}
                        </p>
                        <p className="mt-0.5 text-xs text-[#687A87]">
                          {tr("Deposit bonus")}
                        </p>
                      </div>
                    </div>

                    <p className="text-xs font-semibold text-[#778995]">
                      {new Date(bonus.grantedAt).toLocaleDateString('en-GB')}
                    </p>

                    <div className="sm:flex sm:justify-end">
                      <StatusBadge status={bonus.status} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        <section className="mt-10">
          <div className="mb-5">
            <div className="flex items-center gap-2">
              <span className="h-5 w-1 rounded-full bg-[#40515D]" />
              <h2 className="text-2xl font-black tracking-tight text-white">
                {tr("How Bonuses Work")}
              </h2>
            </div>
            <p className="mt-2 text-sm text-[#748592]">
              {tr("Everything you need to know about your NOVA deposit bonus.")}
            </p>
          </div>

          <div className="space-y-2.5">
            {faqs.map(([question, answer], index) => {
              const isOpen = openFaq === index;

              return (
                <div
                  key={tr(question)}
                  className={`overflow-hidden rounded-2xl border bg-[#07131D] transition ${
                    isOpen
                      ? 'border-[#00D989]/20'
                      : 'border-[#17303B]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() =>
                      setOpenFaq(isOpen ? null : index)
                    }
                    className="flex w-full items-center justify-between gap-5 px-5 py-4.5 text-left"
                    aria-expanded={isOpen}
                  >
                    <span className="text-sm font-extrabold text-white">
                      {tr(question)}
                    </span>

                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition ${
                        isOpen
                          ? 'bg-[#00D989]/10 text-[#00D989]'
                          : 'bg-[#0A1922] text-[#758794]'
                      }`}
                    >
                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${
                          isOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </span>
                  </button>

                  {isOpen ? (
                    <div className="border-t border-[#17303B] px-5 pb-5 pt-4 text-sm leading-6 text-[#8999A6]">
                      {tr(answer)}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>

        <section className="relative mt-10 overflow-hidden rounded-[24px] border border-[#00D989]/15 bg-[radial-gradient(circle_at_90%_10%,rgba(0,217,137,.12),transparent_30%),linear-gradient(135deg,#063022,#07151E)] p-5 sm:p-6">
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#00D989]/10">
                <Headphones className="h-6 w-6 text-[#00D989]" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#00D989]">
                  {tr("24/7 Support")}
                </p>
                <h3 className="mt-1 text-lg font-black text-white">
                  {tr("Need help with your bonus?")}
                </h3>
                <p className="mt-1 text-sm text-[#81929F]">
                  {tr("Our support team is available whenever you need assistance.")}
                </p>
              </div>
            </div>

            <Link
              href="/help"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#00D989] px-5 py-3 text-sm font-black text-[#03120C] transition hover:brightness-105"
            >
              {tr("Contact support")}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
