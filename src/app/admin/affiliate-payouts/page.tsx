import { AdminShell } from '@/components/admin/admin-shell';
import { AffiliatePayoutsClient } from '@/components/admin/affiliate-payouts-client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Affiliate payouts · Admin' };

export default function AdminAffiliatePayoutsPage() {
  return (
    <AdminShell title="Affiliate payouts">
      <AffiliatePayoutsClient />
    </AdminShell>
  );
}
