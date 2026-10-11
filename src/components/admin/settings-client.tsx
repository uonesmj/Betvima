'use client';

import { useState } from 'react';
import { useApp } from '@/components/layout/providers';
import { Card, ErrorNote, Skeleton, StatusPill } from '@/components/ui/primitives';
import { apiRequest, useApiQuery } from '@/lib/hooks/useApi';
import { formatDateTime } from '@/lib/i18n';

interface Setting {
  key: string; value: unknown; valueType: string; scope: string; category: string; label: string;
  description: string | null; isSecret: boolean; isEditable: boolean; updatedAt: string; updatedBy: string | null;
}

export function SettingsClient() {
  const { t, locale } = useApp();
  const { data, loading, error, reload } = useApiQuery<{ settings: Setting[] }>('/api/v1/admin/settings');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<Record<string, string>>({});
  const [category, setCategory] = useState('all');

  const save = async (setting: Setting, raw: string) => {
    let value: unknown = raw;
    if (setting.valueType === 'number' || setting.valueType === 'money') value = Number(raw);
    if (setting.valueType === 'boolean') value = raw === 'true';
    if (setting.valueType === 'json') { try { value = JSON.parse(raw); } catch { setMessage({ ...message, [setting.key]: 'invalid JSON' }); return; } }
    try {
      await apiRequest('/api/v1/admin/settings', { method: 'PATCH', json: { key: setting.key, value } });
      setMessage({ ...message, [setting.key]: 'saved' });
      await reload();
    } catch (err) {
      setMessage({ ...message, [setting.key]: err instanceof Error ? err.message : 'failed' });
    }
  };

  if (loading && !data) return <Skeleton className="h-64 w-full" />;
  if (error && !data) return <ErrorNote message={error} onRetry={() => void reload()} retryLabel={t('common.retry')} />;

  const categories = ['all', ...Array.from(new Set((data?.settings ?? []).map((setting) => setting.category)))];
  const rows = (data?.settings ?? []).filter((setting) => category === 'all' || setting.category === category);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1">
        {categories.map((option) => (
          <button key={option} type="button" className={`nova-tab ${category === option ? 'nova-tab-active' : ''}`} onClick={() => setCategory(option)}>{option}</button>
        ))}
      </div>

      <ErrorNote message={null} retryLabel={t('common.retry')} />
      <Card className="!p-0">
        <table className="nova-table">
          <thead><tr><th>تنظیم</th><th>مقدار</th><th>Type</th><th>به‌روزرسانی</th><th /></tr></thead>
          <tbody>
            {rows.map((setting) => (
              <tr key={setting.key}>
                <td>
                  <div className="text-xs">{setting.label}</div>
                  <div className="font-mono text-[10px] nova-muted">{setting.key}</div>
                  {setting.description ? <div className="text-[10px] nova-muted">{setting.description}</div> : null}
                </td>
                <td>
                  {setting.isSecret ? (
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-xs">••••••</span>
                      <StatusPill status="secret" />
                    </span>
                  ) : setting.valueType === 'boolean' ? (
                    <select
                      className="nova-input !w-auto !py-1 text-xs" value={String(setting.value)}
                      disabled={!setting.isEditable}
                      onChange={(event) => void save(setting, event.target.value)}
                    >
                      <option value="true">true</option>
                      <option value="false">false</option>
                    </select>
                  ) : (
                    <span className="flex items-center gap-1">
                      <input
                        className="nova-input !w-48 !py-1 text-xs" disabled={!setting.isEditable}
                        defaultValue={typeof setting.value === 'object' ? JSON.stringify(setting.value) : String(setting.value ?? '')}
                        onChange={(event) => setDrafts({ ...drafts, [setting.key]: event.target.value })}
                      />
                      <button
                        type="button" className="nova-btn-ghost !px-2 !py-1 text-xs" disabled={!setting.isEditable}
                        onClick={() => void save(setting, drafts[setting.key] ?? String(setting.value ?? ''))}
                      >
                        save
                      </button>
                    </span>
                  )}
                  {message[setting.key] ? (
                    <div className={`mt-1 text-[10px] ${message[setting.key] === 'saved' ? 'text-nova-primary' : 'text-nova-danger'}`}>{message[setting.key]}</div>
                  ) : null}
                </td>
                <td className="text-[11px] nova-muted">{setting.valueType}<div>{setting.scope}</div></td>
                <td className="whitespace-nowrap text-[11px] nova-muted">{formatDateTime(setting.updatedAt, locale)}</td>
                <td><StatusPill status={setting.isEditable ? 'editable' : 'locked'} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? <p className="p-4 text-xs nova-muted">No settings in this category.</p> : null}
      </Card>
      <Card className="text-[11px] nova-muted">
        Secret values are never sent to the browser: they are returned masked and can only be replaced, not read. Provider
        credentials and database URLs live in the server environment, not in the database.
      </Card>
    </div>
  );
}
