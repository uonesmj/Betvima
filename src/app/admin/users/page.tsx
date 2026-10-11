import { AdminShell } from '@/components/admin/admin-shell';
import { UsersClient } from '@/components/admin/users-client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Users · Admin' };

export default function AdminUsersPage() {
  return (
    <AdminShell title="Customers">
      <UsersClient />
    </AdminShell>
  );
}
