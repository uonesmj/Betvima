import { AdminShell } from '@/components/admin/admin-shell';
import { ReconciliationClient } from '@/components/admin/reconciliation-client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Reconciliation · Admin' };

export default function AdminReconciliationPage() {
  return (
    <AdminShell title="Reconciliation">
      <ReconciliationClient />
    </AdminShell>
  );
}
