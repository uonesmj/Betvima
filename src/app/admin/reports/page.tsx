import { AdminShell } from '@/components/admin/admin-shell';
import { ReportsClient } from '@/components/admin/reports-client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Reports · Admin' };

export default function AdminReportsPage() {
  return (
    <AdminShell title="Reports">
      <ReportsClient />
    </AdminShell>
  );
}
