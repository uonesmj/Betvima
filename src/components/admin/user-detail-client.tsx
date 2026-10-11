'use client';

import { useState } from 'react';
import { AdminAction, adminPost } from '@/components/admin/admin-table';
import { useApp } from '@/components/layout/providers';
import { Card, EmptyState, ErrorNote, Field, Skeleton, Stat, StatusPill } from '@/components/ui/primitives';
import { apiRequest, useApiQuery } from '@/lib/hooks/useApi';
import { formatDateTime, formatMinor } from '@/lib/i18n';

interface Detail {
  summary: {
    id: string;
    publicId: string;
    email: string | null;
    phone: string | null;
    username: string | null;
    status: string;
    role: string;
    kycStatus: string;
    balanceSummary: { currency: string; balanceMinor: string }[];
    usdBalanceMinor: string;
    totalStakeMinor: string;
    totalPayoutMinor: string;
    netResultMinor: string;
    openBets: number;
    affiliateId: string | null;
    riskScore: number | null;
    registeredAt: string;
    lastLoginAt: string | null;
  };
  notes: { id: string; body: string; authorId: string | null; createdAt: string }[];
  bets: { items: { id: string; publicId: string; status: string; stakeMinor: string; potentialPayoutMinor: string; usdStakeMinor: string; usdPotentialPayoutMinor: string; type: string; placedAt: string }[]; total: number };
  wallet: { items: { id: string; type: string; amountMinor: string; balanceAfterMinor: string; createdAt: string; status: string }[]; total: number };
  payments: { items: { id: string; publicId: string; direction: string; status: string; amountMinor: string; usdAmountMinor: string; createdAt: string }[]; total: number };
  restrictions: { id: string; kind: string; valueMinor: string | null; isActive: boolean; effectiveFrom: string; effectiveTo: string | null; reason: string | null }[];
}

const TABS = ['overview', 'bets', 'wallet', 'payments', 'actions'] as const;


function PasswordResetCard({ userId }: { userId: string }) {
  const [password, setPassword] = useState('');
  const [reason, setReason] = useState('Authorized support password reset');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const reset = async () => {
    if (password.length < 8) {
      setMessage('Password must contain at least 8 characters.');
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await apiRequest(`/api/v1/admin/users/${userId}/password`, {
        method: 'POST',
        idempotencyKey: crypto.randomUUID(),
        json: { password, reason },
      });
      setMessage('Password changed successfully.');
      setPassword('');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Password reset failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <h3 className="mb-2 text-sm font-semibold">Admin password reset</h3>
      <p className="mb-3 text-xs opacity-70">Changes the Supabase Auth password. The new password is never logged.</p>
      <div className="space-y-3">
        <Field label="New password">
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="nova-input w-full"
            minLength={8}
            maxLength={128}
          />
        </Field>
        <Field label="Reason">
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="nova-input w-full"
            minLength={8}
            maxLength={500}
          />
        </Field>
        <button
          type="button"
          disabled={busy || password.length < 8 || reason.length < 8}
          onClick={reset}
          className="nova-button"
        >
          {busy ? 'Changing…' : 'Change password'}
        </button>
        {message && <p className="text-xs opacity-80">{message}</p>}
      </div>
    </Card>
  );
}

export function UserDetailClient({ userId }: { userId: string }) {
  const { t, locale } = useApp();
  const { data, loading, error, reload } = useApiQuery<Detail>(`/api/v1/admin/users/${userId}`);
  const [tab, setTab] = useState<(typeof TABS)[number]>('overview');
  const [actionForm, setActionForm] = useState({ action: 'set_status', status: 'active', role: 'user', kycStatus: 'verified', reason: '', displayName: '' });
  const [note, setNote] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [limitForm, setLimitForm] = useState({ maxStakePerBetMinor: '', lossLimitDailyMinor: '' });

  if (loading && !data) return <Skeleton className="h-64 w-full" />;
  if (error || !data) return <ErrorNote message={error ?? 'Not found'} onRetry={() => void reload()} retryLabel={t('common.retry')} />;

  const profile = data.summary;
  const wallet = data.summary.usdBalanceMinor;
  const run = async (path: string, json: unknown) => {
    setMessage(null);
    try {
      const result = await apiRequest<{ profile?: unknown }>(`/api/v1/admin/users/${userId}`, { method: 'PATCH', json: { ...(json as object), reason: actionForm.reason || undefined } });
      void result;
      setMessage(t('account.saved'));
      await reload();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'failed');
      throw err;
    }
  };

  return (
    <div className="space-y-4">
      <PasswordResetCard userId={userId} />
      <ErrorNote message={null} retryLabel={t('common.retry')} />
      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs">{profile.publicId}</span>
          <StatusPill status={profile.status} />
          <StatusPill status={profile.kycStatus} />
          <span className="nova-chip">{profile.role}</span>
          {data.summary.affiliateId ? <span className="nova-chip">affiliate {data.summary.affiliateId}</span> : null}
        </div>
        <div className="mt-2 grid gap-1 text-xs nova-muted sm:grid-cols-2">
          <span>Email: {profile.email ?? '—'}</span>
          <span>Phone: {profile.phone ?? '—'}</span>
          <span>Registered: {formatDateTime(profile.registeredAt, locale)}</span>
          <span>Last login: {formatDateTime(profile.lastLoginAt, locale)}</span>
        </div>
      </Card>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Balance" value={formatMinor(wallet, 'USD', locale)} />
        <Stat label="Locked" value="—" />
        <Stat label="Stake" value={formatMinor(data.summary.totalStakeMinor, 'USD', locale)} />
        <Stat
          label="Net result"
          value={formatMinor(data.summary.netResultMinor, 'USD', locale)}
          tone={BigInt(data.summary.netResultMinor) >= 0n ? 'danger' : 'success'}
        />
      </div>
      <nav className="flex gap-1 overflow-x-auto">
        {TABS.map((item) => (
          <button key={item} type="button" className={`nova-tab ${tab === item ? 'nova-tab-active' : ''}`} onClick={() => setTab(item)}>{item}</button>
        ))}
      </nav>

      {tab === 'overview' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <h3 className="mb-2 text-sm font-semibold">Active restrictions</h3>
            {data.restrictions.length === 0 ? <EmptyState title="No restrictions" /> : (
              <ul className="space-y-1.5 text-xs">
                {data.restrictions.map((restriction) => (
                  <li key={restriction.id} className="flex items-center justify-between border-b border-nova-line/50 pb-1.5">
                    <span>{restriction.kind}{restriction.valueMinor ? ` · ${formatMinor(restriction.valueMinor, 'IRT', locale)}` : ''}</span>
                    <span className="flex items-center gap-2 nova-muted">
                      {formatDateTime(restriction.effectiveFrom, locale)}
                      <StatusPill status={restriction.isActive ? 'active' : 'expired'} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card>
            <h3 className="mb-2 text-sm font-semibold">Operator notes</h3>
            <div className="mb-2 flex gap-2">
              <input className="nova-input" placeholder="Add an internal note (audited)" value={note} onChange={(event) => setNote(event.target.value)} />
              <button
                type="button" className="nova-btn-primary shrink-0 text-xs"
                disabled={note.trim().length < 4}
                onClick={async () => { await run('users', { action: 'add_note', note }); setNote(''); }}
              >
                {t('account.save')}
              </button>
            </div>
            {data.notes.length === 0 ? <p className="text-xs nova-muted">No notes.</p> : (
              <ul className="space-y-1.5 text-xs">
                {data.notes.map((entry) => (
                  <li key={entry.id} className="border-b border-nova-line/50 pb-1.5">
                    <div>{entry.body}</div>
                    <div className="text-[10px] nova-muted">{formatDateTime(entry.createdAt, locale)}</div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      ) : null}

      {tab === 'bets' ? (
        <Card className="!p-0">
          <table className="nova-table">
            <thead><tr><th>Bet</th><th>Type</th><th>Status</th><th>Amount Bet</th><th>Potential payout</th><th>Placed</th><th /></tr></thead>
            <tbody>
              {data.bets.items.map((bet) => (
                <tr key={bet.id}>
                  <td className="font-mono text-xs">{bet.publicId}</td>
                  <td className="text-xs">{bet.type}</td>
                  <td><StatusPill status={bet.status} /></td>
                  <td className="text-xs">{formatMinor(bet.usdStakeMinor, 'USD', locale)}</td>
                  <td className="text-xs">{formatMinor(bet.usdPotentialPayoutMinor, 'USD', locale)}</td>
                  <td className="whitespace-nowrap text-xs nova-muted">{formatDateTime(bet.placedAt, locale)}</td>
                  <td><a className="nova-btn-ghost !px-2 !py-1 text-xs" href={`/admin/bets/${bet.id}`}>Open</a></td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.bets.items.length === 0 ? <p className="p-4 text-xs nova-muted">No bets.</p> : null}
        </Card>
      ) : null}

      {tab === 'wallet' ? (
        <Card className="!p-0">
          <table className="nova-table">
            <thead><tr><th>Date</th><th>Type</th><th>Amount</th><th>Balance after transaction</th><th>Status</th></tr></thead>
            <tbody>
              {data.wallet.items.map((entry) => (
                <tr key={entry.id}>
                  <td className="whitespace-nowrap text-xs nova-muted">{formatDateTime(entry.createdAt, locale)}</td>
                  <td className="text-xs">{entry.type}</td>
                  <td className={`text-xs ${BigInt(entry.amountMinor) < 0n ? 'text-nova-danger' : 'text-nova-primary'}`}>{formatMinor(entry.amountMinor, 'USD', locale)}</td>
                  <td className="text-xs">{formatMinor(entry.balanceAfterMinor, 'USD', locale)}</td>
                  <td><StatusPill status={entry.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.wallet.items.length === 0 ? <p className="p-4 text-xs nova-muted">No wallet movements.</p> : null}
        </Card>
      ) : null}

      {tab === 'payments' ? (
        <Card className="!p-0">
          <table className="nova-table">
            <thead><tr><th>ID</th><th>Direction</th><th>Status</th><th>Amount</th><th>Created</th></tr></thead>
            <tbody>
              {data.payments.items.map((intent) => (
                <tr key={intent.id}>
                  <td className="font-mono text-xs">{intent.publicId}</td>
                  <td className="text-xs">{intent.direction}</td>
                  <td><StatusPill status={intent.status} /></td>
                  <td className="text-xs">{formatMinor(intent.usdAmountMinor, 'USD', locale)}</td>
                  <td className="whitespace-nowrap text-xs nova-muted">{formatDateTime(intent.createdAt, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.payments.items.length === 0 ? <p className="p-4 text-xs nova-muted">No payments.</p> : null}
        </Card>
      ) : null}

      {tab === 'actions' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            {message ? <div className="mb-3 rounded-lg border border-nova-line bg-nova-surface2 p-2 text-xs">{message}</div> : null}
            <div className="space-y-3">
              <Field label="Reason (required, min 8 characters)" hint="Written to the audit log with your operator id">
                <input className="nova-input" value={actionForm.reason} onChange={(event) => setActionForm({ ...actionForm, reason: event.target.value })} />
              </Field>
              <div className="flex flex-wrap gap-2">
                {['active', 'restricted', 'suspended', 'closed', 'self_excluded'].map((status) => (
                  <AdminAction
                    key={status} label={`Set ${status}`} tone={status === 'active' ? 'primary' : 'danger'}
                    confirmText={`Set account status to ${status}?`}
                    onRun={() => run('users', { action: 'set_status', status, reason: actionForm.reason })}
                  />
                ))}
              </div>
              <Field label="Role">
                <select className="nova-input" value={actionForm.role} onChange={(event) => setActionForm({ ...actionForm, role: event.target.value })}>
                  {['user', 'affiliate', 'support', 'finance', 'risk_manager', 'settlement_manager', 'trader', 'affiliate_manager', 'admin', 'super_admin'].map((role) => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
              </Field>
              <AdminAction label="Apply role" onRun={() => run('users', { action: 'set_role', role: actionForm.role, reason: actionForm.reason })} />
              <Field label="KYC decision">
                <select className="nova-input" value={actionForm.kycStatus} onChange={(event) => setActionForm({ ...actionForm, kycStatus: event.target.value })}>
                  {['pending', 'verified', 'rejected', 'expired'].map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
              </Field>
              <AdminAction label="Apply KYC" onRun={() => run('users', { action: 'set_kyc', kycStatus: actionForm.kycStatus, reason: actionForm.reason })} />
            </div>
          </Card>

          <Card>
            <h3 className="mb-2 text-sm font-semibold">Stake and loss limits (minor units)</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Max stake per bet">
                <input className="nova-input" inputMode="numeric" value={limitForm.maxStakePerBetMinor} onChange={(e) => setLimitForm({ ...limitForm, maxStakePerBetMinor: e.target.value.replace(/[^\d]/g, '') })} />
              </Field>
              <Field label="Daily loss limit">
                <input className="nova-input" inputMode="numeric" value={limitForm.lossLimitDailyMinor} onChange={(e) => setLimitForm({ ...limitForm, lossLimitDailyMinor: e.target.value.replace(/[^\d]/g, '') })} />
              </Field>
            </div>
            <button
              type="button" className="nova-btn-primary mt-3 text-xs"
              disabled={actionForm.reason.length < 8}
              onClick={() => void run('users', {
                action: 'update_limits',
                limits: {
                  ...(limitForm.maxStakePerBetMinor ? { maxStakePerBetMinor: limitForm.maxStakePerBetMinor } : {}),
                  ...(limitForm.lossLimitDailyMinor ? { lossLimitDailyMinor: limitForm.lossLimitDailyMinor } : {}),
                },
                reason: actionForm.reason,
              })}
            >
              Save limits
            </button>
            <p className="mt-3 text-[11px] nova-muted">
              Money adjustments are never made here: they go through the dual-control adjustment request flow on the
              Wallet adjustments page.
            </p>
            <a className="nova-btn-ghost mt-3 inline-flex text-xs" href="/admin/wallet-adjustments">Open Wallet adjustments</a>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
