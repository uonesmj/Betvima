'use client';

import { useState } from 'react';
import { translateVisibleText } from '@/lib/i18n/ui-phrases';
import { useApp } from '@/components/layout/providers';
import { Card, DataTable, EmptyState, ErrorNote, Skeleton, StatusPill } from '@/components/ui/primitives';
import { useApiQuery } from '@/lib/hooks/useApi';
import { formatDateTime, formatMinor } from '@/lib/i18n';

interface LedgerEntry {
  id: string; type: string; amountMinor: string; direction: string; status: string;
  appliedRateBps: number | null; sourceKind: string | null; userId: string | null;
  createdAt: string; reason: string | null;
}

export function AffiliateLedgerClient() {
  const { t, locale, session } = useApp();
  const tr = (value: string | undefined) => { const copy = value ?? ''; return locale === 'fa' ? translateVisibleText(copy) : copy; };
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useApiQuery<{ items: LedgerEntry[]; total: number }>(
    session?.authenticated ? `/api/v1/affiliate/ledger?page=${page}&pageSize=50` : null,
  );

  if (!session?.authenticated) return <EmptyState title={t('nav.login')} />;
  if (loading) return <Skeleton className="h-48 w-full" />;
  if (error) return <ErrorNote message={error} onRetry={() => void reload()} retryLabel={t('common.retry')} />;


  return (
    <div className="affiliate-ledger-v2 space-y-5">
      <section className="rounded-2xl border border-[#DCE6F1] bg-[#0F1B2D] p-5 text-white shadow-[0_12px_30px_rgba(15,23,42,.10)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.16em] text-[#8FB7E8]">{tr("Commission program")}</div>
            <h2 className="mt-2 text-2xl font-black">70% of affiliate P/L</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#B8C7D9]">
              Your commission is calculated from the settled net result of referred users.
              When your referred players generate profit for the site, your affiliate share is positive.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 px-5 py-4 text-center">
            <div className="text-3xl font-black">70%</div>
            <div className="mt-1 text-xs text-[#B8C7D9]">{tr("Commission rate")}</div>
          </div>
        </div>
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <div className="rounded-xl bg-white/10 p-3">
            <div className="text-xs text-[#B8C7D9]">{tr("Player loses $100")}</div>
            <div className="mt-1 font-black text-emerald-300">{tr("Your share +$70")}</div>
          </div>
          <div className="rounded-xl bg-white/10 p-3">
            <div className="text-xs text-[#B8C7D9]">{tr("Player wins $100")}</div>
            <div className="mt-1 font-black text-rose-300">{tr("Your share -$70")}</div>
          </div>
        </div>
      </section>

      <Card className="ledger-table-card !p-0 overflow-hidden">
      <DataTable<LedgerEntry>
        rows={data!.items}
        rowKey={(row) => row.id}
        empty={t('common.empty')}
        columns={[
          { key: 'date', header: t('bets.date'), render: (row) => <span className="whitespace-nowrap text-xs nova-muted">{formatDateTime(row.createdAt, locale)}</span> },
          { key: 'type', header: t('bets.type'), render: (row) => <span className="text-xs">{row.type}</span> },
          { key: 'source', header: 'Source', render: (row) => <span className="text-xs nova-muted">{row.sourceKind ?? '—'}{row.userId ? ` · ${row.userId.slice(0, 6)}` : ''}</span> },
          { key: 'rate', header: 'Rate', render: (row) => <span className="text-xs">{row.appliedRateBps === null ? '—' : `${(row.appliedRateBps / 100).toFixed(2)}%`}</span> },
          {
            key: 'amount', header: t('wallet.amount'),
            render: (row) => (
              <span className={BigInt(row.amountMinor) < 0n ? 'text-nova-danger' : 'text-nova-primary'}>
                {formatMinor(row.amountMinor, 'USD', locale)}
              </span>
            ),
          },
          { key: 'status', header: t('common.status'), render: (row) => <StatusPill status={row.status} /> },
        ]}
      />
      <div className="ledger-total border-t border-[#E7ECF2] p-3 text-xs nova-muted">
        {t('common.total')}: {data?.total ?? 0}
      </div>
      </Card>

      <section className="commission-guide rounded-2xl border border-[#E7ECF2] bg-white p-5 shadow-[0_4px_18px_rgba(15,23,42,.05)]">
        <h2 className="text-lg font-black text-[#111827]">{tr("How commission works")}</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl bg-[#F8FAFC] p-4">
            <div className="text-xs font-bold text-[#087FF5]">01 · Settlement</div>
            <p className="mt-2 text-sm leading-6 text-[#475569]">{tr("Only settled player results are included in the commission calculation.")}</p>
          </div>
          <div className="rounded-xl bg-[#F8FAFC] p-4">
            <div className="text-xs font-bold text-[#087FF5]">02 · Rate</div>
            <p className="mt-2 text-sm leading-6 text-[#475569]">{tr("Your current affiliate rate is 70% and settlement currency is USD.")}</p>
          </div>
          <div className="rounded-xl bg-[#F8FAFC] p-4">
            <div className="text-xs font-bold text-[#087FF5]">03 · Balance</div>
            <p className="mt-2 text-sm leading-6 text-[#475569]">{tr("Positive and negative commission entries flow into your affiliate balance.")}</p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <details className="rounded-xl border border-[#E7ECF2] p-4">
            <summary className="cursor-pointer text-sm font-bold text-[#172033]">{tr("When do I receive commission?")}</summary>
            <p className="mt-2 text-xs leading-5 text-[#64748B]">{tr("Commission entries are created after referred bets are settled and the affiliate ledger is updated.")}</p>
          </details>
          <details className="rounded-xl border border-[#E7ECF2] p-4">
            <summary className="cursor-pointer text-sm font-bold text-[#172033]">{tr("Can commission become negative?")}</summary>
            <p className="mt-2 text-xs leading-5 text-[#64748B]">{tr("Yes. With the current P/L model, referred-user profits can create negative commission entries.")}</p>
          </details>
          <details className="rounded-xl border border-[#E7ECF2] p-4">
            <summary className="cursor-pointer text-sm font-bold text-[#172033]">{tr("What does the Rate column mean?")}</summary>
            <p className="mt-2 text-xs leading-5 text-[#64748B]">{tr("It records the effective commission rate used when that ledger entry was created.")}</p>
          </details>
          <details className="rounded-xl border border-[#E7ECF2] p-4">
            <summary className="cursor-pointer text-sm font-bold text-[#172033]">{tr("Why can an entry be negative?")}</summary>
            <p className="mt-2 text-xs leading-5 text-[#64748B]">{tr("A negative entry represents the affiliate share of a positive settled player result.")}</p>
          </details>
        </div>
      </section>
    </div>
  );
}
