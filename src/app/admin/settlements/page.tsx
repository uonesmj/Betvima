import { AdminShell } from '@/components/admin/admin-shell';
import { SettlementsClient } from '@/components/admin/settlements-client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Settlements · Admin' };

export default function AdminSettlementsPage() {
  return (
    <AdminShell title="Settlement queue">
      <SettlementsClient />
    </AdminShell>
  );
}
