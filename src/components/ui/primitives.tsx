'use client';

import type { ReactNode } from 'react';

export function Card({ children, className = '', as: Tag = 'div' }: { children: ReactNode; className?: string; as?: 'div' | 'section' | 'article' }) {
  return <Tag className={`nova-card p-4 ${className}`}>{children}</Tag>;
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'gold' }) {
  const tones: Record<string, string> = {
    neutral: 'text-nova-muted border-nova-line',
    success: 'text-nova-primary border-nova-primary/40 bg-nova-primary/10',
    warning: 'text-nova-warn border-nova-warn/40 bg-nova-warn/10',
    danger: 'text-nova-danger border-nova-danger/40 bg-nova-danger/10',
    info: 'text-nova-info border-nova-info/40 bg-nova-info/10',
    gold: 'text-nova-gold border-nova-gold/40 bg-nova-gold/10',
  };
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

export function StatusPill({ status }: { status: string }) {
  const tone: Record<string, 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'gold'> = {
    active: 'success', approved: 'success', settled: 'success', won: 'success', succeeded: 'success', paid: 'success', ok: 'success', verified: 'success',
    pending: 'warning', queued: 'warning', processing: 'warning', initiated: 'warning', requires_action: 'warning', manual_review: 'warning', partially_settled: 'warning',
    rejected: 'danger', failed: 'danger', suspended: 'danger', blocked: 'danger', cancelled: 'danger', lost: 'danger', dead_letter: 'danger', frozen: 'danger', closed: 'danger',
    open: 'info', live: 'info', accepted: 'info', in_play: 'info',
  };
  const displayStatus: Record<string, string> = {
    active: 'Active',
    approved: 'Approved',
    settled: 'Settled',
    won: 'Winner',
    succeeded: 'Succeeded',
    paid: 'Paid',
    ok: 'Confirm',
    verified: 'Verified',
    pending: 'Pending',
    queued: 'Queued',
    processing: 'Processing',
    initiated: 'Initiated',
    requires_action: 'Requires action',
    manual_review: 'Manual review',
    partially_settled: 'Partially settled',
    rejected: 'Rejected',
    failed: 'Failed',
    suspended: 'Suspended',
    blocked: 'Blocked',
    cancelled: 'Cancelled',
    lost: 'Lost',
    dead_letter: 'Dead letter',
    frozen: 'Frozen',
    closed: 'Closed',
    open: 'Open',
    live: 'Live',
    accepted: 'Accepted',
    in_play: 'In play',
    reviewing: 'Reviewing',
    confirmed: 'Approved',
    dismissed: 'Rejected',
    expired: 'Expired',
    self_excluded: 'Self-excluded',
    restricted: 'Restricted',
  };
  return <Badge tone={tone[status] ?? 'neutral'}>{displayStatus[status] ?? status.replace(/_/g, ' ')}</Badge>;
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="nova-card flex flex-col items-center gap-2 p-8 text-center">
      <div className="text-base font-semibold">{title}</div>
      {hint ? <p className="max-w-md text-sm nova-muted">{hint}</p> : null}
      {action}
    </div>
  );
}

export function Skeleton({ className = 'h-4 w-full' }: { className?: string }) {
  return <div className={`nova-skeleton ${className}`} />;
}

export function ErrorNote({ message, onRetry, retryLabel }: { message: string | null; onRetry?: () => void; retryLabel: string }) {
  if (!message) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-nova-danger/40 bg-nova-danger/10 px-3 py-2 text-sm text-nova-danger">
      <span>{message}</span>
      {onRetry ? <button type="button" className="nova-btn-ghost !py-1 !text-xs" onClick={onRetry}>{retryLabel}</button> : null}
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="nova-label">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs nova-muted">{hint}</span> : null}
    </label>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string }[]; value: T; onChange: (id: T) => void }) {
  return (
    <div role="tablist" className="flex gap-1 overflow-x-auto pb-1">
      {tabs.map((tab) => (
        <button
          key={tab.id} role="tab" type="button" aria-selected={value === tab.id}
          className={`nova-tab ${value === tab.id ? 'nova-tab-active' : ''}`} onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function Modal({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <div className="nova-card max-h-[90vh] w-full overflow-y-auto rounded-b-none sm:max-w-lg sm:rounded-2xl">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold">{title}</h2>
          <button type="button" className="nova-btn-ghost !px-2 !py-1" onClick={onClose} aria-label="close">✕</button>
        </div>
        {children}
        {footer ? <div className="mt-4 flex justify-end gap-2">{footer}</div> : null}
      </div>
    </div>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: string; tone?: 'success' | 'danger' | 'warning' }) {
  const color = tone === 'success' ? 'text-nova-primary' : tone === 'danger' ? 'text-nova-danger' : tone === 'warning' ? 'text-nova-warn' : '';
  return (
    <div className="nova-card-2 p-3">
      <div className="text-xs nova-muted">{label}</div>
      <div className={`mt-1 text-lg font-semibold ${color}`}>{value}</div>
      {hint ? <div className="mt-1 text-xs nova-muted">{hint}</div> : null}
    </div>
  );
}

export function DataTable<T>({ columns, rows, empty, rowKey, onRowClick }: {
  columns: { key: string; header: string; render?: (row: T) => ReactNode; className?: string }[];
  rows: T[]; empty: string; rowKey: (row: T) => string; onRowClick?: (row: T) => void;
}) {
  if (rows.length === 0) return <EmptyState title={empty} />;
  return (
    <div className="overflow-x-auto">
      <table className="nova-table">
        <thead>
          <tr>{columns.map((c) => <th key={c.key} className={c.className}>{c.header}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} className={onRowClick ? 'cursor-pointer hover:bg-nova-surface2/60' : ''} onClick={() => onRowClick?.(row)}>
              {columns.map((c) => <td key={c.key} className={c.className}>{c.render ? c.render(row) : null}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Pagination({ page, total, pageSize, onChange, labels }: { page: number; total: number; pageSize: number; onChange: (page: number) => void; labels: { prev: string; next: string } }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="mt-3 flex items-center justify-between gap-2 text-sm nova-muted">
      <span>{page} / {pages}</span>
      <div className="flex gap-2">
        <button type="button" className="nova-btn-ghost !py-1 !text-xs" disabled={page <= 1} onClick={() => onChange(page - 1)}>{labels.prev}</button>
        <button type="button" className="nova-btn-ghost !py-1 !text-xs" disabled={page >= pages} onClick={() => onChange(page + 1)}>{labels.next}</button>
      </div>
    </div>
  );
}
