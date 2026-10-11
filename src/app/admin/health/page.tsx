import { AdminShell } from '@/components/admin/admin-shell';
import { HealthClient } from '@/components/admin/health-client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'System health · Admin' };

export default function AdminHealthPage() {
  return (
    <AdminShell title="System health">
      <HealthClient />
    </AdminShell>
  );
}
