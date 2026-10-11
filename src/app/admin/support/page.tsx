import { AdminShell } from '@/components/admin/admin-shell';
import { SupportAdminClient } from '@/components/admin/support-admin-client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Online Support' };

export default function AdminSupportPage() {
  return (
    <AdminShell title="Online Support">
      <SupportAdminClient />
    </AdminShell>
  );
}
