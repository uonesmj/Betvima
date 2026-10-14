'use client';

import { useState } from 'react';
import { AdminAction, adminPost } from '@/components/admin/admin-table';
import { useApp } from '@/components/layout/providers';
import { Card, ErrorNote, Skeleton, StatusPill } from '@/components/ui/primitives';
import { useApiQuery } from '@/lib/hooks/useApi';
import { formatDateTime, formatMinor } from '@/lib/i18n';

interface Payout {
  id: string;
  publicId: string;
  affiliateId: string;
  status: string;
  currency: string;
  amountMinor: string; usdAmountMinor: string; usdPayableAtRequestMinor: string;
  payableAtRequestMinor: string;
  method: string | null;
  destinationMasked: string | null;
  payoutAsset: "USDT_TRC20" | "TRX" | "DOGE" | null;
  destinationAddress: string | null;
  requestedAt: string | null;
  approvedAt: string | null;
  paidAt: string | null;
  providerReference: string | null;
  rejectionReason: string | null;
  dualApprovalRequired?: boolean;
}

const STATUSES = ['pending', 'eligible', 'approved', 'processing', 'manual_review', 'paid', 'rejected', 'cancelled', 'failed'];

export function AffiliatePayoutsClient() {
  const { t, locale } = useApp();
  const [status, setStatus] = useState('');
  const [reference, setReference] = useState<Record<string, string>>({});
  const query = new URLSearchParams({ pageSize: '50' });
  if (status) query.set('status', status);
  const { data, loading, error, reload } = useApiQuery<{ items: Payout[]; total: number }>(`/api/v1/admin/affiliates/payouts?${query.toString()}`);

  const transition = async (payout: Payout, to: string) => {
    const providerReference = (reference[payout.id] ?? '').trim();
    if (to === 'paid' && !providerReference) {
      window.alert('Enter the TXID / provider reference before marking this payout as paid.');
      return;
    }
    await adminPost(`/api/v1/admin/affiliates/payouts/${payout.id}/transition`, {
      to,
      ...(to === 'paid' ? { providerReference } : {}),
      ...(to === 'rejected' || to === 'failed' ? { reason: 'finance decision' } : {}),
    });
    await reload();
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="text-xs font-semibold text-[#94A3B8]">Manual payout review queue</div>
        {['', ...STATUSES].map((option) => (
          <button key={option || 'all'} type="button" className={`nova-tab ${status === option ? 'nova-tab-active' : ''}`} onClick={() => setStatus(option)}>{option || 'all'}</button>
        ))}
      </div>

      <ErrorNote message={error} onRetry={() => void reload()} retryLabel={t('common.retry')} />
      {loading && !data ? <Skeleton className="h-64 w-full" /> : (
        <Card className="!p-0">
          <table className="nova-table">
            <thead><tr><th>ID</th><th>Affiliate</th><th>Amount</th><th>Payable at request</th><th>Network</th><th>Destination</th><th>Status</th><th>Requested</th><th>Actions</th></tr></thead>
            <tbody>
              {(data?.items ?? []).map((payout) => (
                <tr key={payout.id}>
                  <td className="font-mono text-xs">{payout.publicId}</td>
                  <td className="font-mono text-[11px]">{payout.affiliateId.slice(0, 8)}</td>
                  <td className="whitespace-nowrap text-xs">{formatMinor(payout.usdAmountMinor, 'USD', locale)}</td>
                  <td className="whitespace-nowrap text-xs nova-muted">{formatMinor(payout.usdPayableAtRequestMinor, 'USD', locale)}</td>
                  <td className="text-xs">{payout.method ?? '—'}<div className="nova-muted">{payout.destinationMasked ?? ''}</div></td>
                  <td>
                    <StatusPill status={payout.status} />
                    {payout.providerReference ? <div className="mt-1 font-mono text-[10px] nova-muted">{payout.providerReference}</div> : null}
                    {payout.rejectionReason ? <div className="mt-1 text-[10px] text-nova-danger">{payout.rejectionReason}</div> : null}
                  </td>
                  <td className="whitespace-nowrap text-xs nova-muted">{formatDateTime(payout.requestedAt, locale)}</td>
                  <td>
                    <span className="flex flex-wrap gap-1">
                      {payout.status === 'pending' || payout.status === 'eligible' || payout.status === 'manual_review' ? (
                        <AdminAction label="Approve" tone="primary" onRun={() => transition(payout, 'approved')} />
                      ) : null}
                      {payout.status === 'approved' ? <AdminAction label="Processing" onRun={() => transition(payout, 'processing')} /> : null}
                      {['approved', 'processing'].includes(payout.status) ? (
                        <AdminAction
                          label="Mark paid" tone="primary"
                          confirmText="Mark paid requires an external provider reference — this is the only way a payout reaches paid."
                          onRun={async () => {
                            if ((reference[payout.id] ?? '').trim().length < 4) throw new Error('enter the provider reference first');
                            await transition(payout, 'paid');
                          }}
                        />
                      ) : null}
                      {['pending', 'eligible', 'approved', 'processing', 'manual_review'].includes(payout.status) ? (
                        <>
                          <AdminAction label="Reject" tone="danger" confirmText="Reject this payout?" onRun={() => transition(payout, 'rejected')} />
                          <AdminAction label="Cancel" tone="danger" confirmText="Cancel this payout?" onRun={() => transition(payout, 'cancelled')} />
                        </>
                      ) : null}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(data?.items.length ?? 0) === 0 ? <p className="p-4 text-xs nova-muted">No payouts.</p> : null}
        </Card>
      )}
      <p className="text-xs nova-muted">{data?.total ?? 0} payouts</p>
      <Card className="text-[11px] nova-muted">
        Every transition is a state machine step: pending → approved → processing → paid (with an external reference), or
        rejected/cancelled/failed. A payout that is already paid can never be paid twice.
      </Card>
    </div>
  );
}
