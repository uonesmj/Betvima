import { AdminShell } from '@/components/admin/admin-shell';
import { DashboardClient } from '@/components/admin/dashboard-client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin dashboard' };

export default function AdminDashboardPage() {
  return (
    <AdminShell title="Operations dashboard">
      <DashboardClient />
    </AdminShell>
  );
}
