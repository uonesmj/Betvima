import { AdminShell } from '@/components/admin/admin-shell';
import { WorkersClient } from '@/components/admin/workers-client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Job queue · Admin' };

export default function AdminJobsPage() {
  return (
    <AdminShell title="Durable job queue">
      <WorkersClient />
    </AdminShell>
  );
}
