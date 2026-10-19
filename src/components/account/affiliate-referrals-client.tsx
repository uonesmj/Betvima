'use client';

import { useState } from 'react';
import { useApp } from '@/components/layout/providers';
import { translateVisibleText } from '@/lib/i18n/ui-phrases';
import { useApiQuery } from '@/lib/hooks/useApi';
import { formatDateTime, formatMinor } from '@/lib/i18n';
import { ErrorNote, Skeleton } from '@/components/ui/primitives';

type Money = {
  currency: string;
  depositMinor: string;
  withdrawalMinor: string;
  wageredMinor: string;
  playerNetMinor: string;
  ledgerMinor: string;
  hasDeposited: boolean;
};
type Referral = {
  userId: string;
  code: string;
  status: string;
  registeredAt: string | null;
  confirmedAt: string | null;
  financialByCurrency: Money[];
};
type ReferralsResponse = {
  items: Referral[];
  total: number;
  page: number;
  hasMore: boolean;
  statusCounts?: { total: number; confirmed: number; review: number; pending: number };
};

function amountSign(value: string): 'positive' | 'negative' | 'zero' {
  if (!/^-?\d+$/.test(value)) return 'zero';
  const amount = BigInt(value);
  return amount > 0n ? 'positive' : amount < 0n ? 'negative' : 'zero';
}
function balanceTone(value: string): string {
  const sign = amountSign(value);
  return sign === 'positive' ? 'text-emerald-600' :
    sign === 'negative' ? 'text-rose-600' : 'text-slate-500';
}

export function AffiliateReferralsClient() {
  const { t, locale, session } = useApp();
  const [page, setPage] = useState(1);
  const tr = (label: string) => locale === 'fa' ? translateVisibleText(label) : label;
  const endpoint = session?.authenticated
    ? `/api/v1/affiliate/referrals?page=${page}&pageSize=20`
    : null;
  const { data, loading, error, reload } = useApiQuery<ReferralsResponse>(endpoint);

  if (!session?.authenticated) return <div className="p-6">{t('nav.login')}</div>;
  if (loading) return <Skeleton className="h-48 w-full" />;
  if (error) return <ErrorNote message={error} onRetry={() => void reload()} retryLabel={t('common.retry')} />;

  const counts = data?.statusCounts;
  return (
    <section className="affiliate-referrals-v3 space-y-4">
      <header className="relative overflow-hidden rounded-[26px] bg-[#07150F] p-5 text-white sm:p-7">
        <div className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-emerald-400/10" />
        <div className="relative">
          <span className="text-[10px] font-black uppercase tracking-[0.16em] text-[#71E8A8]">
            {tr('BETVIMA PARTNERS · REFERRALS')}
          </span>
          <h2 className="mt-2 text-2xl font-black">{tr('Your referred players')}</h2>
          <p className="mt-2 max-w-lg text-xs leading-5 text-[#B7CEBE]">
            {tr('Registrations under review are visible here too. Deposit, withdrawal and commission figures are recorded amounts by currency, not estimates.')}
          </p>
          <div className="mt-5 grid grid-cols-3 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
            {[
              [tr('All users'), counts?.total ?? data?.total ?? 0],
              [tr('Confirmed'), counts?.confirmed ?? 0],
              [tr('Under review'), counts?.review ?? 0],
            ].map(([label, value]) => (
              <div key={String(label)} className="border-r border-white/10 px-3 py-4 last:border-r-0">
                <div className="text-[10px] font-medium text-[#BAD0C0]">{label}</div>
                <div className="mt-1 text-2xl font-black">{value}</div>
              </div>
            ))}
          </div>
        </div>
      </header>

      {(data?.items.length ?? 0) === 0 ? (
        <div className="rounded-[25px] bg-[#F1F7F2] p-6 text-center">
          <div className="text-lg font-black text-[#123522]">{tr('No attributed registrations on this page')}</div>
          <p className="mt-2 text-sm text-[#587565]">
            {tr('New registrations appear here, including those awaiting review.')}
          </p>
          <a href="/affiliate/links" className="mt-4 inline-flex rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-[#06170D]">
            {tr('View referral links')}
          </a>
        </div>
      ) : (
        <div className="space-y-3">
          {data?.items.map((user) => {
            const review = user.status === 'review' || user.status === 'pending';
            const deposited = user.financialByCurrency.some((c) => c.hasDeposited || amountSign(c.depositMinor) === 'positive');
            return (
              <article key={user.userId} className="overflow-hidden rounded-[23px] border border-[#DCE8DF] bg-white shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3 bg-[#F1F7F2] px-4 py-4">
                  <div>
                    <p className="text-[10px] font-semibold uppercase text-[#738A79]">{tr('Referred player')}</p>
                    <p className="mt-1 font-mono text-sm font-black text-[#173D28]">{user.userId.slice(0, 10)}…</p>
                    <p className="mt-1 text-[11px] text-[#708472]">
                      {tr('Registered')}: {formatDateTime(user.registeredAt ?? user.confirmedAt, locale)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${review
                      ? 'bg-amber-100 text-amber-800'
                      : user.status === 'confirmed'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-slate-200 text-slate-700'}`}>
                      {review ? tr('Under review') : user.status === 'confirmed' ? tr('Confirmed') : tr(user.status)}
                    </span>
                    <span className={`text-xs font-bold ${deposited ? 'text-emerald-700' : 'text-slate-500'}`}>
                      {deposited ? tr('Deposited') : tr('No recorded deposit')}
                    </span>
                  </div>
                </div>
                {user.financialByCurrency?.length ? (
                  <div className="divide-y divide-[#E1EAE3]">
                    {user.financialByCurrency.map((money) => (
                      <div key={money.currency} className="px-4 py-4">
                        <div className="mb-3 text-xs font-black text-[#155E3D]">{money.currency}</div>
                        <div className="grid grid-cols-2 gap-x-5 gap-y-4 sm:grid-cols-4">
                          {[
                            [tr('Total deposits'), money.depositMinor],
                            [tr('Total withdrawals'), money.withdrawalMinor],
                            [tr('Player P/L'), money.playerNetMinor],
                            [tr('Recorded commission'), money.ledgerMinor],
                          ].map(([label, value]) => (
                            <div key={label}>
                              <div className="text-[10px] text-[#778B7C]">{label}</div>
                              <div className={`mt-1 break-all text-sm font-black tabular-nums ${label === tr('Recorded commission') || label === tr('Player P/L')
                                ? balanceTone(value) : 'text-[#142C1D]'}`}>
                                {formatMinor(value, money.currency, locale)}
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="mt-3 text-[10px] text-[#708574]">
                          {tr('Recorded commission can be positive, negative or zero. Pending settlement is not shown as earned commission.')}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="px-4 py-4 text-xs text-[#779080]">{tr('No recorded payments or commission yet')}</p>
                )}
              </article>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 py-2">
        <button type="button" disabled={page <= 1}
          onClick={() => setPage((v) => Math.max(1, v - 1))}
          className="rounded-xl border border-[#D5E3D8] px-4 py-2 text-sm font-bold text-[#165F3C] disabled:opacity-40">
          {tr('Previous')}
        </button>
        <span className="text-xs font-bold text-[#4D6C58]">{tr('Page')} {page}</span>
        <button type="button" disabled={!data?.hasMore}
          onClick={() => setPage((v) => v + 1)}
          className="rounded-xl bg-[#0F8F59] px-4 py-2 text-sm font-bold text-white disabled:opacity-40">
          {tr('Next')}
        </button>
      </div>
    </section>
  );
}
