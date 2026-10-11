import { AdminShell } from '@/components/admin/admin-shell';
import { PaymentsClient } from '@/components/admin/payments-client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Payments · Admin' };

export default function AdminPaymentsPage() {
  return (
    <AdminShell title="Payment intents">
      <PaymentsClient />
    </AdminShell>
  );
}
