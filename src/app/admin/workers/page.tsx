import { AdminShell } from '@/components/admin/admin-shell';
import { WorkersClient } from '@/components/admin/workers-client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Workers · Admin' };

export default function AdminWorkersPage() {
  return (
    <AdminShell title="Workers & job queue">
      <WorkersClient />
    </AdminShell>
  );
}
