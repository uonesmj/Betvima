import { AdminShell } from '@/components/admin/admin-shell';
import { AffiliateFraudClient } from '@/components/admin/affiliate-fraud-client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Affiliate fraud · Admin' };

export default function AdminAffiliateFraudPage() {
  return (
    <AdminShell title="Affiliate fraud flags">
      <AffiliateFraudClient />
    </AdminShell>
  );
}
