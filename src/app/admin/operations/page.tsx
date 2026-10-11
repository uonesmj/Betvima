import { AdminShell } from '@/components/admin/admin-shell';
import { OperationsClient } from '@/components/admin/operations-client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Operations · Admin' };

export default function AdminOperationsPage() {
  return (
    <AdminShell title="Kill switches & maintenance">
      <OperationsClient />
    </AdminShell>
  );
}
