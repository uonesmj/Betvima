import { AdminShell } from '@/components/admin/admin-shell';
import { RolesClient } from '@/components/admin/roles-client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Roles · Admin' };

export default function AdminRolesPage() {
  return (
    <AdminShell title="Roles & permissions">
      <RolesClient />
    </AdminShell>
  );
}
