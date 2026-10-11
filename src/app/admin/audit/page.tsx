import { AdminShell } from '@/components/admin/admin-shell';
import { AuditClient } from '@/components/admin/audit-client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Audit log · Admin' };

export default function AdminAuditPage() {
  return (
    <AdminShell title="Audit log">
      <AuditClient />
    </AdminShell>
  );
}
