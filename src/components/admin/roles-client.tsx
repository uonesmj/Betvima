'use client';

import { useApp } from '@/components/layout/providers';
import { Card, ErrorNote, Skeleton, StatusPill } from '@/components/ui/primitives';
import { useApiQuery } from '@/lib/hooks/useApi';

interface Role { key: string; label: string; permissions: string[]; isSystem: boolean; userCount: number }

export function RolesClient() {
  const { t } = useApp();
  const { data, loading, error, reload } = useApiQuery<{ roles: Role[] }>('/api/v1/admin/roles');

  if (loading && !data) return <Skeleton className="h-48 w-full" />;
  if (error && !data) return <ErrorNote message={error} onRetry={() => void reload()} retryLabel={t('common.retry')} />;

  return (
    <div className="space-y-4">
      <Card className="!p-0">
        <table className="nova-table">
          <thead><tr><th>Role</th><th>Label</th><th>Users</th><th>System</th><th>Permissions</th></tr></thead>
          <tbody>
            {(data?.roles ?? []).map((role) => (
              <tr key={role.key}>
                <td className="font-mono text-xs">{role.key}</td>
                <td className="text-xs">{role.label}</td>
                <td className="text-xs">{role.userCount}</td>
                <td><StatusPill status={role.isSystem ? 'system' : 'custom'} /></td>
                <td>
                  <div className="flex max-w-[60ch] flex-wrap gap-1">
                    {role.permissions.map((permission) => <span key={permission} className="nova-chip text-[10px]">{permission}</span>)}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Card className="text-[11px] nova-muted">
        Permissions are checked twice: in the API guard (fast rejection) and again inside the privileged database function
        (defence in depth). A role change alone can never bypass an operational switch.
      </Card>
    </div>
  );
}
