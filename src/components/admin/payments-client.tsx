'use client';

import { useState } from 'react';
import { AdminAction, adminPost } from '@/components/admin/admin-table';
import { useApp } from '@/components/layout/providers';
import { Card, ErrorNote, Skeleton, StatusPill } from '@/components/ui/primitives';
import { useApiQuery } from '@/lib/hooks/useApi';
import { formatDateTime, formatMinor } from '@/lib/i18n';

interface Intent {
  id: string;
  publicId: string;
  userId: string;
  direction: 'deposit' | 'withdrawal';
  status: string;
  currency?: string;
  amountMinor: string; usdAmountMinor: string | null; usdFeeMinor: string | null; usdNetAmountMinor: string | null;
  feeMinor: string;
  netAmountMinor: string;
  provider: string;
  providerReference: string | null;
  failureCode: string | null;
  failureMessage: string | null;
  reviewReason: string | null;
  createdAt: string;
  completedAt: string | null;
}

const STATUSES = [
  'initiated',
  'pending',
  'requires_action',
  'review',
  'approved',
  'processing',
  'paid',
  'succeeded',
  'failed',
  'cancelled',
  'refunded',
];

const REVIEWABLE_WITHDRAWAL_STATUSES = new Set([
  'initiated',
  'pending',
  'requires_action',
  'review',
]);

function money(intent: Intent, field: 'amount' | 'fee' | 'net') {
  const usd = field === 'amount' ? intent.usdAmountMinor
    : field === 'fee' ? intent.usdFeeMinor : intent.usdNetAmountMinor;
  const original = field === 'amount' ? intent.amountMinor
    : field === 'fee' ? intent.feeMinor : intent.netAmountMinor;
  return usd !== null
    ? formatMinor(usd, 'USD', 'en')
    : formatMinor(original, intent.currency || 'USD', 'en');
}

export function PaymentsClient() {
  const { t, locale } = useApp();
  const [filters, setFilters] = useState({ direction: '', status: '', page: 1 });
  const [busyId, setBusyId] = useState<string | null>(null);

  const query = new URLSearchParams({
    page: String(filters.page),
    pageSize: '25',
  });

  if (filters.direction) query.set('direction', filters.direction);
  if (filters.status) query.set('status', filters.status);

  const { data, loading, error, reload } = useApiQuery<{
    items: Intent[];
    total: number;
  }>(`/api/v1/admin/payments?${query.toString()}`);

  const review = async (intent: Intent, decision: 'approve' | 'reject') => {
    setBusyId(intent.id);
    try {
      await adminPost(`/api/v1/admin/payments/${intent.publicId}/review`, {
        decision,
        reason: decision === 'approve' ? 'operator approved' : 'operator rejected',
      });
      await reload();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-3">
      <Card className="!p-3">
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="nova-input !w-auto !py-1.5 text-xs"
            value={filters.direction}
            onChange={(e) =>
              setFilters({ ...filters, direction: e.target.value, page: 1 })
            }
          >
            <option value="">Any direction</option>
            <option value="deposit">Deposits</option>
            <option value="withdrawal">Withdrawals</option>
          </select>

          <select
            className="nova-input !w-auto !py-1.5 text-xs"
            value={filters.status}
            onChange={(e) =>
              setFilters({ ...filters, status: e.target.value, page: 1 })
            }
          >
            <option value="">Any status</option>
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="nova-btn-ghost !py-1.5 text-xs"
            onClick={() => void reload()}
          >
            Refresh
          </button>

          <span className="ms-auto text-xs nova-muted">
            {data?.total ?? 0} payment intents
          </span>
        </div>
      </Card>

      <ErrorNote
        message={error}
        onRetry={() => void reload()}
        retryLabel={t('common.retry')}
      />

      {loading && !data ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <Card className="!p-0 overflow-hidden">
          <div className="w-full overflow-x-auto overscroll-x-contain">
            <table className="nova-table min-w-[1050px]">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Direction</th>
                  <th>Status</th>
                  <th>Amount</th>
                  <th>Fee</th>
                  <th>Net</th>
                  <th>Provider ref</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {(data?.items ?? []).map((intent) => {
                  const currency = intent.currency || 'USD';
                  const reviewable =
                    intent.direction === 'withdrawal' &&
                    REVIEWABLE_WITHDRAWAL_STATUSES.has(intent.status);

                  return (
                    <tr key={intent.id}>
                      <td className="font-mono text-xs">
                        {intent.publicId}
                      </td>

                      <td className="whitespace-nowrap text-xs">
                        {intent.direction}
                      </td>

                      <td className="min-w-[190px]">
                        <StatusPill status={intent.status} />

                        <div className="mt-1 text-[10px] nova-muted">
                          {currency}
                          {intent.provider ? ` · ${intent.provider}` : ''}
                        </div>

                        {intent.reviewReason ? (
                          <div className="mt-1 text-[10px] nova-muted">
                            {intent.reviewReason}
                          </div>
                        ) : null}

                        {intent.failureMessage ? (
                          <div className="mt-1 max-w-[260px] text-[10px] text-nova-danger">
                            {intent.failureMessage}
                          </div>
                        ) : null}
                      </td>

                      <td className="whitespace-nowrap text-xs font-semibold">
                        {money(intent, 'amount')}
                      </td>

                      <td className="whitespace-nowrap text-xs nova-muted">
                        {money(intent, 'fee')}
                      </td>

                      <td className="whitespace-nowrap text-xs">
                        {money(intent, 'net')}
                      </td>

                      <td className="font-mono text-[11px] nova-muted">
                        {intent.providerReference ?? '—'}
                      </td>

                      <td className="whitespace-nowrap text-xs nova-muted">
                        {formatDateTime(intent.createdAt, locale)}
                      </td>

                      <td>
                        <div className="flex min-w-[180px] flex-wrap gap-1">
                          {reviewable ? (
                            <>
                              <AdminAction
                                label={
                                  busyId === intent.id
                                    ? 'Processing…'
                                    : 'Approve'
                                }
                                tone="primary"
                                confirmText="Approve this withdrawal? This will enqueue the automatic crypto payout through the configured provider."
                                onRun={() => review(intent, 'approve')}
                              />

                              <AdminAction
                                label="Reject"
                                tone="danger"
                                confirmText="Reject this withdrawal? The reserved wallet amount will be released."
                                onRun={() => review(intent, 'reject')}
                              />
                            </>
                          ) : null}

                          {intent.status === 'succeeded' &&
                          intent.direction === 'deposit' ? (
                            <AdminAction
                              label="Refund"
                              tone="danger"
                              confirmText="Refund this deposit? A reversing ledger entry is created."
                              onRun={async () => {
                                setBusyId(intent.id);
                                try {
                                  await adminPost(
                                    `/api/v1/admin/payments/${intent.publicId}/refund`,
                                    { reason: 'operator refund' },
                                  );
                                  await reload();
                                } finally {
                                  setBusyId(null);
                                }
                              }}
                            />
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {(data?.items.length ?? 0) === 0 ? (
            <p className="p-4 text-xs nova-muted">
              No payment intents.
            </p>
          ) : null}
        </Card>
      )}

      <Card className="text-[11px] nova-muted">
        Confirm Withdrawal authorizes payment execution only. Funds are marked paid after
        the provider reports a terminal successful payout. Rejected or failed withdrawals
        release the held wallet balance. Deposits may be reversed only through a new
        correcting ledger entry.
      </Card>
    </div>
  );
}
