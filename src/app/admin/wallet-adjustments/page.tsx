import { AdminShell } from '@/components/admin/admin-shell';
import { AdjustmentsClient } from '@/components/admin/adjustments-client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Wallet adjustments · Admin' };

export default function AdminAdjustmentsPage() {
  return (
    <AdminShell title="Wallet adjustments">
      <AdjustmentsClient />
    </AdminShell>
  );
}
