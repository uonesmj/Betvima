'use client';

import { useState } from 'react';
import { AdminAction, adminPost } from '@/components/admin/admin-table';
import { useApp } from '@/components/layout/providers';
import { Card, EmptyState, ErrorNote, Field, Skeleton, Stat, StatusPill } from '@/components/ui/primitives';
import { apiRequest, useApiQuery } from '@/lib/hooks/useApi';
import { formatDateTime, formatMinor } from '@/lib/i18n';

interface Affiliate {
  id: string; code: string; displayName: string; status: string; commissionModel: string; commissionRateBps: number;
  parentOverrideBps: number; currency: string; minPayoutMinor: string; settlementDay: number; settlementHour: number;
  settlementMinute: number; settlementTimezone: string; depth: number; path: string | null; riskScore: number;
  parentAffiliateId: string | null; isFraudFlagged: boolean;
  payableMinor: string; carryForwardMinor: string; suppressedMinor: string; usdPayableMinor: string | null; usdRawMinor: string | null; usdCarryForwardMinor: string | null; usdSuppressedMinor: string | null;
  lifetimeCommissionMinor: string; lifetimePaidMinor: string; lifetimeDepositsMinor: string; usdMinPayoutMinor: string | null; usdLifetimeCommissionMinor: string | null; usdLifetimePaidMinor: string | null; usdLifetimeDepositsMinor: string | null; createdAt: string;
}
interface Payable { payableMinor: string; rawMinor: string; carryForwardMinor: string; suppressedMinor: string; floorApplied: boolean; currency: string; usdPayableMinor: string | null; usdRawMinor: string | null; usdCarryForwardMinor: string | null; usdSuppressedMinor: string }
interface LedgerRow { id: string; type: string; amountMinor: string; balanceAfterMinor?: string; usdAmountMinor: string | null; usdBalanceAfterMinor?: string | null; createdAt: string; description: string | null; sourceUserId: string | null }
interface PayoutRow { id: string; publicId: string; amountMinor: string; usdAmountMinor: string | null; usdPayableAtRequestMinor?: string | null; status: string; requestedAt: string; method: string | null; providerReference: string | null }
interface Fraud { riskScore: number; signals: string[]; blocked: boolean; reviewRequired: boolean }
interface ReferralRow { userId: string; code: string; status: string; confirmedAt: string | null; usdWageredMinor: string | null; usdNetRevenueMinor: string | null; usdCommissionMinor: string | null; usdDepositMinor?: string; usdWithdrawalMinor?: string; usdPanelShareMinor?: string }

const TABS = ['overview', 'ledger', 'payouts', 'referrals', 'terms'] as const;

export function AffiliateDetailClient({ affiliateId }: { affiliateId: string }) {
  const { t, locale } = useApp();
  const { data, loading, error, reload } = useApiQuery<{
    affiliate: Affiliate; payable: Payable; stats: Record<string, unknown>; ledger: { items: LedgerRow[] };
    payouts: { items: PayoutRow[] }; fraud: Fraud; referrals: { items: ReferralRow[] };
    hierarchy: { id: string; code: string; displayName: string; depth: number }[] | null;
  }>(`/api/v1/admin/affiliates/${affiliateId}`);
  const [tab, setTab] = useState<(typeof TABS)[number]>('overview');
  const [reason, setReason] = useState('');
  const [adjustAmount, setAdjustAmount] = useState('');
  const [terms, setTerms] = useState({ model: '', rateBps: '', minPayoutMinor: '' });
  const [message, setMessage] = useState<string | null>(null);

  if (loading && !data) return <Skeleton className="h-64 w-full" />;
  if (error || !data) return <ErrorNote message={error ?? 'Not found'} onRetry={() => void reload()} retryLabel={t('common.retry')} />;

  const affiliate = data.affiliate;
  const patch = async (json: Record<string, unknown>) => {
    setMessage(null);
    try {
      await apiRequest(`/api/v1/admin/affiliates/${affiliateId}`, {
        method: 'PATCH', json: { ...json, reason: reason || undefined, idempotencyKey: crypto.randomUUID() },
      });
      setMessage(t('account.saved'));
      await reload();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'failed');
      throw err;
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm">{affiliate.code}</span>
          <StatusPill status={affiliate.status} />
          <span className="nova-chip">{affiliate.commissionModel}</span>
          <span className="nova-chip">{(affiliate.commissionRateBps / 100).toFixed(2)}%</span>
          <span className="nova-chip">depth {affiliate.depth}</span>
          <span className="nova-chip">parent override {(affiliate.parentOverrideBps / 100).toFixed(2)}%</span>
          <span className="ms-auto text-xs nova-muted">{formatDateTime(affiliate.createdAt, locale)}</span>
        </div>
        <h2 className="mt-2 text-base font-semibold">{affiliate.displayName}</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Payable" value={formatMinor(data.payable.usdPayableMinor ?? data.payable.payableMinor, data.payable.usdPayableMinor === null ? data.payable.currency : 'USD', locale)} tone="success" />
          <Stat label="Raw balance" value={formatMinor(data.payable.usdRawMinor ?? data.payable.rawMinor, data.payable.usdRawMinor === null ? data.payable.currency : 'USD', locale)} />
          <Stat
            label="Carry-forward" value={formatMinor(data.payable.usdCarryForwardMinor ?? data.payable.carryForwardMinor, data.payable.usdCarryForwardMinor === null ? data.payable.currency : 'USD', locale)}
            tone={BigInt(data.payable.usdCarryForwardMinor ?? data.payable.carryForwardMinor) < 0n ? 'danger' : undefined}
          />
          <Stat label="Suppressed (floor)" value={formatMinor(data.payable.usdSuppressedMinor ?? data.payable.suppressedMinor, data.payable.usdSuppressedMinor === null ? data.payable.currency : 'USD', locale)} tone="warning" />
          <Stat label="Lifetime commission" value={formatMinor(affiliate.usdLifetimeCommissionMinor ?? affiliate.lifetimeCommissionMinor, affiliate.usdLifetimeCommissionMinor === null ? affiliate.currency : 'USD', locale)} />
          <Stat label="Lifetime paid" value={formatMinor(affiliate.usdLifetimePaidMinor ?? affiliate.lifetimePaidMinor, affiliate.usdLifetimePaidMinor === null ? affiliate.currency : 'USD', locale)} />
          <Stat label="Total deposits" value={formatMinor(affiliate.usdLifetimeDepositsMinor ?? affiliate.lifetimeDepositsMinor, affiliate.usdLifetimeDepositsMinor === null ? affiliate.currency : 'USD', locale)} />
          <Stat label="Min payout" value={formatMinor(affiliate.usdMinPayoutMinor ?? affiliate.minPayoutMinor, affiliate.usdMinPayoutMinor === null ? affiliate.currency : 'USD', locale)} />
        </div>
        <p className="mt-2 text-[11px] nova-muted">
          Settlement runs day {affiliate.settlementDay} {String(affiliate.settlementHour).padStart(2, '0')}:{String(affiliate.settlementMinute).padStart(2, '0')} ({affiliate.settlementTimezone}).
          {data.payable.floorApplied ? ' The floor is currently applied (MODEL B): nothing below zero is ever payable, and the excess is preserved as suppressed.' : ''}
        </p>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-3">
          <nav className="flex gap-1 overflow-x-auto">
            {TABS.map((item) => (
              <button key={item} type="button" className={`nova-tab ${tab === item ? 'nova-tab-active' : ''}`} onClick={() => setTab(item)}>{item}</button>
            ))}
          </nav>

          {tab === 'overview' ? (
            <Card>
              <h3 className="mb-2 text-sm font-semibold">Fraud signals</h3>
              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                <span className="nova-chip">risk {data.fraud.riskScore}</span>
                <StatusPill status={data.fraud.blocked ? 'blocked' : data.fraud.reviewRequired ? 'review' : 'ok'} />
              </div>
              {data.fraud.signals.length === 0 ? <p className="text-xs nova-muted">No signals.</p> : (
                <ul className="list-inside list-disc space-y-1 text-xs">{data.fraud.signals.map((signal) => <li key={signal}>{signal}</li>)}</ul>
              )}
              <h3 className="mb-2 mt-4 text-sm font-semibold">Hierarchy</h3>
              {!data.hierarchy || data.hierarchy.length === 0 ? (
                <p className="text-xs nova-muted">No sub-affiliates.</p>
              ) : (
                <ul className="space-y-1 text-xs">
                  {data.hierarchy.map((node) => (
                    <li key={node.id} className="flex items-center justify-between border-b border-nova-line/40 pb-1">
                      <span style={{ paddingInlineStart: `${node.depth * 12}px` }}>{node.code} · {node.displayName}</span>
                      <span className="nova-muted">depth {node.depth}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ) : null}

          {tab === 'ledger' ? (
            <Card className="!p-0">
              <table className="nova-table">
                <thead><tr><th>Date</th><th>Type</th><th>Amount</th><th>Description</th></tr></thead>
                <tbody>
                  {data.ledger.items.map((entry) => (
                    <tr key={entry.id}>
                      <td className="whitespace-nowrap text-xs nova-muted">{formatDateTime(entry.createdAt, locale)}</td>
                      <td className="text-xs">{entry.type}</td>
                      <td className={`whitespace-nowrap text-xs ${BigInt(entry.amountMinor) < 0n ? 'text-nova-danger' : 'text-nova-primary'}`}>
                        {formatMinor(entry.usdAmountMinor ?? entry.amountMinor, entry.usdAmountMinor === null ? affiliate.currency : 'USD', locale)}
                      </td>
                      <td className="text-xs nova-muted">{entry.description ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.ledger.items.length === 0 ? <p className="p-4 text-xs nova-muted">No ledger entries.</p> : null}
            </Card>
          ) : null}

          {tab === 'payouts' ? (
            <Card className="!p-0">
              <table className="nova-table">
                <thead><tr><th>ID</th><th>Amount</th><th>Status</th><th>Method</th><th>Requested</th><th /></tr></thead>
                <tbody>
                  {data.payouts.items.map((payout) => (
                    <tr key={payout.id}>
                      <td className="font-mono text-xs">{payout.publicId}</td>
                      <td className="whitespace-nowrap text-xs">{formatMinor(payout.usdAmountMinor ?? payout.amountMinor, payout.usdAmountMinor === null ? affiliate.currency : 'USD', locale)}</td>
                      <td><StatusPill status={payout.status} /></td>
                      <td className="text-xs">{payout.method ?? '—'}</td>
                      <td className="whitespace-nowrap text-xs nova-muted">{formatDateTime(payout.requestedAt, locale)}</td>
                      <td><a className="nova-btn-ghost !px-2 !py-1 text-xs" href="/admin/affiliate-payouts">Manage</a></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.payouts.items.length === 0 ? <p className="p-4 text-xs nova-muted">No payouts.</p> : null}
            </Card>
          ) : null}

          {tab === 'referrals' ? (
            <Card className="!p-0">
              <table className="nova-table">
                <thead><tr><th>User</th><th>Status</th><th>Approved</th><th>Turnover</th><th>Net revenue</th><th>Commission</th></tr></thead>
                <tbody>
                  {data.referrals.items.map((referral) => (
                    <tr key={referral.userId}>
                      <td className="font-mono text-[11px]">{referral.userId.slice(0, 8)}</td>
                      <td><StatusPill status={referral.status} /></td>
                      <td className="whitespace-nowrap text-xs nova-muted">{formatDateTime(referral.confirmedAt, locale)}</td>
                      <td className="whitespace-nowrap text-xs">{referral.usdWageredMinor === null ? '— (no FX)' : formatMinor(referral.usdWageredMinor, 'USD', locale)}</td>
                      <td className="whitespace-nowrap text-xs">{referral.usdNetRevenueMinor === null ? '— (no FX)' : formatMinor(referral.usdNetRevenueMinor, 'USD', locale)}</td>
                      <td className="whitespace-nowrap text-xs text-nova-primary">{referral.usdCommissionMinor === null ? '— (no FX)' : formatMinor(referral.usdCommissionMinor, 'USD', locale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.referrals.items.length === 0 ? <p className="p-4 text-xs nova-muted">No referrals yet.</p> : null}
            </Card>
          ) : null}

          {tab === 'terms' ? (
            <Card>
              <h3 className="mb-2 text-sm font-semibold">Commercial terms</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Commission model">
                  <select className="nova-input" value={terms.model || affiliate.commissionModel} onChange={(e) => setTerms({ ...terms, model: e.target.value })}>
                    {['PROFIT_LOSS_35', 'NON_NEGATIVE_35', 'CPA', 'HYBRID'].map((model) => <option key={model} value={model}>{model}</option>)}
                  </select>
                </Field>
                <Field label="Rate (basis points, 3500 = 35%)">
                  <input className="nova-input" inputMode="numeric" placeholder={String(affiliate.commissionRateBps)} value={terms.rateBps} onChange={(e) => setTerms({ ...terms, rateBps: e.target.value.replace(/[^\d]/g, '') })} />
                </Field>
                <Field label="Minimum payout (minor units)">
                  <input className="nova-input" inputMode="numeric" placeholder={affiliate.minPayoutMinor} value={terms.minPayoutMinor} onChange={(e) => setTerms({ ...terms, minPayoutMinor: e.target.value.replace(/[^\d]/g, '') })} />
                </Field>
              </div>
              <AdminAction
                label="Save terms" tone="primary"
                confirmText="Apply these commercial terms? Rate changes apply to future commission only — historical ledger entries are immutable."
                onRun={() => patch({
                  action: 'update_terms',
                  ...(terms.model ? { model: terms.model } : {}),
                  ...(terms.rateBps ? { rateBps: Number(terms.rateBps) } : {}),
                  ...(terms.minPayoutMinor ? { minPayoutMinor: terms.minPayoutMinor } : {}),
                })}
              />
              <h3 className="mb-2 mt-4 text-sm font-semibold">Manual commission adjustment</h3>
              <Field label="Signed amount in minor units (e.g. -3500000 or 3500000)">
                <input className="nova-input" inputMode="numeric" value={adjustAmount} onChange={(e) => setAdjustAmount(e.target.value.replace(/[^-\d]/g, ''))} />
              </Field>
              <AdminAction
                label="Post adjustment" tone="danger"
                confirmText="Post this adjustment to the affiliate ledger? A new entry is appended; nothing is overwritten."
                onRun={() => patch({ action: 'adjust', amountMinor: adjustAmount })}
              />
            </Card>
          ) : null}
        </div>

        <Card>
          <h3 className="mb-2 text-sm font-semibold">Operator actions</h3>
          {message ? <div className="mb-3 rounded-lg border border-nova-line bg-nova-surface2 p-2 text-xs">{message}</div> : null}
          <Field label="Reason (required for status and adjustments, min 8 characters)">
            <input className="nova-input" value={reason} onChange={(event) => setReason(event.target.value)} />
          </Field>
          <div className="mt-3 flex flex-wrap gap-2">
            {['approved', 'pending', 'suspended', 'blocked', 'closed'].map((status) => (
              <AdminAction
                key={status} label={`Set ${status}`} tone={status === 'approved' ? 'primary' : 'danger'}
                confirmText={`Set affiliate status to ${status}?`}
                onRun={() => patch({ action: 'set_status', status })}
              />
            ))}
          </div>
          <label className="mt-4 flex items-center gap-2 text-xs nova-muted">
            <input
              type="checkbox"
              onChange={(event) => void patch({ action: 'set_parent', parentAffiliateId: event.target.checked ? null : undefined }).catch(() => undefined)}
              disabled={!affiliate.parentAffiliateId}
            />
            Detach from parent (re-parenting is validated against circular hierarchies)
          </label>
          <p className="mt-3 text-[11px] nova-muted">
            Adjustments are ledger entries, never edits. Settlement, payouts and status changes are all permission-checked
            and audited with your operator id.
          </p>
          {data.hierarchy && data.hierarchy.length > 0 ? (
            <div className="mt-4">
              <EmptyState title={`${data.hierarchy.length} sub-affiliate(s)`} hint="Their commission is paid after your override share." />
            </div>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
