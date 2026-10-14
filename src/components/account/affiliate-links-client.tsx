'use client';

import { useState } from 'react';
import { translateVisibleText } from '@/lib/i18n/ui-phrases';
import { useApp } from '@/components/layout/providers';
import { Card, EmptyState, ErrorNote, Field, Skeleton } from '@/components/ui/primitives';
import { apiRequest, useApiQuery } from '@/lib/hooks/useApi';

interface LinkRow { id: string; code: string; campaign: string | null; source: string | null; medium: string | null; is_active: boolean; clicks: number; url: string }

export function AffiliateLinksClient() {
  const { t, locale, session } = useApp();
  const tr = (value: string | undefined) => { const copy = value ?? ''; return locale === 'fa' ? translateVisibleText(copy) : copy; };
  const { data, loading, error, reload } = useApiQuery<{ links: LinkRow[]; primaryUrl: string; code: string }>(
    session?.authenticated ? '/api/v1/affiliate/links' : null,
  );
  const [form, setForm] = useState({ campaign: '', source: '', medium: 'social', landingPath: '/' });
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  if (!session?.authenticated) return <EmptyState title={t('nav.login')} />;
  if (loading) return <Skeleton className="h-40 w-full" />;

  const create = async () => {
    try {
      await apiRequest('/api/v1/affiliate/links', { method: 'POST', json: form });
      setMessage(t('account.saved'));
      await reload();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : t('common.error'));
    }
  };

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(url);
      setTimeout(() => setCopied(null), 2000);
    } catch { setMessage('Clipboard unavailable'); }
  };

  return (
    <div className="affiliate-links-v2 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <div>
        <ErrorNote message={error} onRetry={() => void reload()} retryLabel={t('common.retry')} />
        {data?.primaryUrl ? (
          <Card className="affiliate-links-primary mb-3 border-[#DCE6F1] shadow-[0_8px_24px_rgba(15,23,42,.06)]">
            <div className="text-xs font-bold uppercase tracking-[0.12em] text-[#087FF5]">{tr("Primary referral link")}</div>
            <div className="mt-1 flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-lg bg-nova-bg px-2 py-1.5 text-xs">{data.primaryUrl}</code>
              <button type="button" className="nova-btn-ghost !py-1.5 text-xs" onClick={() => void copy(data.primaryUrl)}>
                {copied === data.primaryUrl ? t('affiliate.copied') : t('affiliate.copyLink')}
              </button>
            </div>
            <div className="mt-3 border-t border-[#E8EEF5] pt-3">
              <div className="text-xs font-bold uppercase tracking-[0.12em] text-[#087FF5]">{tr("BetVima App download")}</div>
              <div className="mt-1 flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-lg bg-nova-bg px-2 py-1.5 text-xs">{`${window.location.origin}/app/affiliate/${data.code}`}</code>
                <button type="button" className="nova-btn-primary !py-1.5 text-xs" onClick={() => window.location.assign(`/app/affiliate/${encodeURIComponent(data.code)}`)}>
                  {tr("Download App")}
                </button>
                <button type="button" className="nova-btn-ghost !py-1.5 text-xs" onClick={() => void copy(`${window.location.origin}/app/affiliate/${data.code}`)}>
                  {copied === `${window.location.origin}/app/affiliate/${data.code}` ? t('affiliate.copied') : t('affiliate.copyLink')}
                </button>
              </div>
            </div>
          </Card>
        ) : null}

        {(data?.links.length ?? 0) === 0 ? <EmptyState title={t('common.empty')} /> : (
          <Card className="!p-0">
            <table className="nova-table">
              <thead><tr><th>{tr("Code")}</th><th>{tr("Campaign")}</th><th>{tr("Source")}</th><th>{tr("Clicks")}</th><th /></tr></thead>
              <tbody>
                {data!.links.map((link) => (
                  <tr key={link.id}>
                    <td className="font-mono text-xs">{link.code}</td>
                    <td className="text-xs">{link.campaign ?? '—'}</td>
                    <td className="text-xs nova-muted">{link.source ?? '—'}{link.medium ? ` / ${link.medium}` : ''}</td>
                    <td className="text-xs">{link.clicks}</td>
                    <td>
                      <button type="button" className="nova-btn-ghost !py-1 text-xs" onClick={() => void copy(link.url)}>
                        {copied === link.url ? t('affiliate.copied') : t('affiliate.copyLink')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>

      <Card className="affiliate-create-card border-[#DCE6F1] shadow-[0_8px_24px_rgba(15,23,42,.06)]">
        <div className="mb-4"><div className="text-lg font-black text-[#111827]">{tr("Create referral link")}</div><div className="mt-1 text-xs text-[#64748B]">{tr("Generate a campaign link in seconds.")}</div></div>
        {message ? <div className="mb-3 rounded-lg border border-nova-line bg-nova-surface2 p-2 text-xs">{message}</div> : null}
        <div className="space-y-3">
          <Field label="Campaign"><input className="nova-input" placeholder="e.g. summer2026" value={form.campaign} onChange={(e) => setForm({ ...form, campaign: e.target.value })} /></Field>
          <Field label="Source"><input className="nova-input" placeholder="e.g. instagram" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} /></Field>
          <Field label="Medium">
            <select className="nova-input" value={form.medium} onChange={(e) => setForm({ ...form, medium: e.target.value })}>
              {['social', 'search', 'display', 'email', 'direct', 'influencer'].map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </Field>
          <Field label="Landing path"><input className="nova-input" placeholder="/" value={form.landingPath} onChange={(e) => setForm({ ...form, landingPath: e.target.value })} /></Field>
          <button type="button" className="nova-btn-primary w-full" disabled={!form.campaign} onClick={() => void create()}>{t('account.save')}</button>
        </div>
      </Card>
    </div>
  );
}
