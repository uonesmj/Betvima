import { AdminShell } from '@/components/admin/admin-shell';
import { UserDetailClient } from '@/components/admin/user-detail-client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Customer · Admin' };

export default async function AdminUserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <AdminShell title="Customer detail">
      <UserDetailClient userId={id} />
    </AdminShell>
  );
}
