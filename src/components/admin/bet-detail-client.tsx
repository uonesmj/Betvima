'use client';

import { useState } from 'react';
import { AdminAction, adminPost } from '@/components/admin/admin-table';
import { useApp } from '@/components/layout/providers';
import { Card, ErrorNote, Field, Skeleton, Stat, StatusPill } from '@/components/ui/primitives';
import { useApiQuery } from '@/lib/hooks/useApi';
import { formatDateTime, formatMinor, formatOddsScaled } from '@/lib/i18n';

interface BetLeg {
  id: string; selectionId: string; matchId: string; matchLabel: string; marketLabel: string; selectionLabel: string;
  oddsAtPlacementScaled: string; acceptedOddsScaled: string | null; status: string; grade: string | null; settledAt: string | null;
}
interface Bet {
  id: string; publicId: string; userId: string; type: string; status: string; stakeMinor: string;
  potentialPayoutMinor: string; settledPayoutMinor: string | null; netResultMinor: string | null;
  usdStakeMinor: string; usdPotentialPayoutMinor: string; usdSettledPayoutMinor: string | null; usdNetResultMinor: string | null;
  combinedOddsScaled: string;
  revision: number; placedAt: string; settledAt: string | null; legs: BetLeg[]; isCashoutAvailable: boolean;
}
interface Settlement {
  id: string;
  revision: number;
  kind: string;
  statusBefore: string;
  statusAfter: string;
  settledPayoutMinor: string | null;
  netUserResultMinor: string | null;
  usdSettledPayoutMinor: string | null;
  usdNetUserResultMinor: string | null;
  createdAt: string;
  reason: string | null;
  currency: string | null;
}
interface Event { id: string; eventType: string; payload: Record<string, unknown>; createdAt: string }
interface Decision { id: string; ruleKey: string; action: string; reason: string; createdAt: string }

export function BetDetailClient({ betId }: { betId: string }) {
  const { t, locale } = useApp();
  const { data, loading, error, reload } = useApiQuery<{ bet: Bet; settlements: Settlement[]; events: Event[]; riskDecisions: Decision[] }>(
    `/api/v1/admin/bets/${betId}`,
  );
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  if (loading && !data) return <Skeleton className="h-64 w-full" />;
  if (error || !data) return <ErrorNote message={error ?? 'یافت نشد'} onRetry={() => void reload()} retryLabel={t('common.retry')} />;

  const bet = data.bet;
  const final = ['settled', 'void', 'cancelled', 'cashed_out', 'reversed'].includes(bet.status);

  const act = async (path: 'settle' | 'regrade', json: unknown) => {
    setMessage(null);
    try {
      await adminPost(`/api/v1/admin/bets/${betId}/${path}`, json);
      setMessage(t('account.saved'));
      await reload();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'failed');
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs">{bet.publicId}</span>
          <StatusPill status={bet.status} />
          <span className="nova-chip">{bet.type}</span>
          <span className="nova-chip">revision {bet.revision}</span>
          {bet.isCashoutAvailable ? <span className="nova-chip">cash-out available</span> : null}
          <span className="ms-auto text-xs nova-muted">{formatDateTime(bet.placedAt, locale)} → {formatDateTime(bet.settledAt, locale)}</span>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Stake" value={formatMinor(bet.usdStakeMinor, 'USD', locale)} />
          <Stat label="Odds" value={formatOddsScaled(bet.combinedOddsScaled)} />
          <Stat label="Potential payout" value={formatMinor(bet.usdPotentialPayoutMinor, 'USD', locale)} />
          <Stat
            label="Settled payout"
            value={bet.usdSettledPayoutMinor !== null ? formatMinor(bet.usdSettledPayoutMinor, 'USD', locale) : '—'}
            tone={bet.netResultMinor === null ? undefined : BigInt(bet.netResultMinor) >= 0n ? 'danger' : 'success'}
          />
        </div>
        <p className="mt-2 text-[11px] nova-muted">Customer {bet.userId}</p>
      </Card>

      <Card className="!p-0">
        <table className="nova-table">
          <thead><tr><th>مسابقه</th><th>Openار</th><th>انتخاب</th><th>ضریب هنگام ثبت</th><th>Accepted</th><th>Status</th><th>نتیجه</th></tr></thead>
          <tbody>
            {bet.legs.map((leg) => (
              <tr key={leg.id}>
                <td className="text-xs">{leg.matchLabel}</td>
                <td className="text-xs nova-muted">{leg.marketLabel}</td>
                <td className="text-xs">{leg.selectionLabel}</td>
                <td className="text-xs">{formatOddsScaled(leg.oddsAtPlacementScaled)}</td>
                <td className="text-xs nova-muted">{leg.acceptedOddsScaled ? formatOddsScaled(leg.acceptedOddsScaled) : '—'}</td>
                <td><StatusPill status={leg.status} /></td>
                <td className="text-xs">{leg.grade ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h3 className="mb-2 text-sm font-semibold">Manual settlement</h3>
          {message ? <div className="mb-3 rounded-lg border border-nova-line bg-nova-surface2 p-2 text-xs">{message}</div> : null}
          {final ? (
            <p className="text-xs nova-muted">
              This bet is in a final state ({bet.status}). Settlement decisions are never overwritten — use regrade
              (reversal + re-settlement) instead.
            </p>
          ) : (
            <>
              <Field label="Reason (min 8 characters, audited)">
                <input className="nova-input" value={reason} onChange={(event) => setReason(event.target.value)} />
              </Field>
              <Field label="Operator notes (optional)">
                <input className="nova-input" value={notes} onChange={(event) => setNotes(event.target.value)} />
              </Field>
              <div className="mt-3 flex flex-wrap gap-2">
                {(['WIN', 'LOSS', 'VOID'] as const).map((decision) => (
                  <AdminAction
                    key={decision}
                    label={`Mark ${decision}`}
                    tone={decision === 'LOSS' ? 'danger' : 'primary'}
                    confirmText={`Settle this bet as ${decision}? The payout is computed from the odds recorded at placement.`}
                    onRun={() => act('settle', { decision, reason, notes: notes || undefined })}
                  />
                ))}
              </div>
              <p className="mt-3 text-[11px] nova-muted">
                The operator only chooses the outcome. Stake, odds, payout and commission are derived from the stored
                records, and the wallet movement is idempotent.
              </p>
            </>
          )}
        </Card>

        <Card>
          <h3 className="mb-2 text-sm font-semibold">Settlement history</h3>
          {data.settlements.length === 0 ? <p className="text-xs nova-muted">No settlement recorded.</p> : (
            <ul className="space-y-1.5 text-xs">
              {data.settlements.map((settlement) => (
                <li key={settlement.id} className="border-b border-nova-line/50 pb-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span>revision {settlement.revision} · {settlement.kind}</span>
                    <span className="nova-muted">{formatDateTime(settlement.createdAt, locale)}</span>
                  </div>
                  <div className="nova-muted">
                    {settlement.statusBefore} → {settlement.statusAfter} · payout {settlement.usdSettledPayoutMinor === null ? '—' : formatMinor(settlement.usdSettledPayoutMinor, 'USD', locale)} · net {settlement.usdNetUserResultMinor === null ? '—' : formatMinor(settlement.usdNetUserResultMinor, 'USD', locale)}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <h3 className="mb-2 mt-4 text-sm font-semibold">Regrade (reversal + re-settlement)</h3>
          <Field label="Reason (min 8 characters)">
            <input className="nova-input" value={reason} onChange={(event) => setReason(event.target.value)} />
          </Field>
          <AdminAction
            label="Regrade this bet" tone="danger"
            confirmText="Openبینی نتیجه، تسویه فعلی را معکوس کرده و دوباره تسویه می‌کند. Commission نیز معکوس خواهد شد. ادامه می‌دهید؟"
            onRun={() => act('regrade', { reason })}
          />
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h3 className="mb-2 text-sm font-semibold">Event trail</h3>
          {data.events.length === 0 ? <p className="text-xs nova-muted">No events.</p> : (
            <ul className="space-y-1 text-[11px]">
              {data.events.map((event) => (
                <li key={event.id} className="flex items-center justify-between gap-2 border-b border-nova-line/40 pb-1">
                  <span>{event.eventType}</span>
                  <span className="nova-muted">{formatDateTime(event.createdAt, locale)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <h3 className="mb-2 text-sm font-semibold">Risk decisions</h3>
          {data.riskDecisions.length === 0 ? <p className="text-xs nova-muted">No risk rule triggered.</p> : (
            <ul className="space-y-1 text-[11px]">
              {data.riskDecisions.map((decision) => (
                <li key={decision.id} className="flex items-center justify-between gap-2 border-b border-nova-line/40 pb-1">
                  <span>{decision.ruleKey} → {decision.action}</span>
                  <span className="nova-muted">{decision.reason}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
