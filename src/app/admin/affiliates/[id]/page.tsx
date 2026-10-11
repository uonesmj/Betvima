import { AdminShell } from '@/components/admin/admin-shell';
import { AffiliateDetailClient } from '@/components/admin/affiliate-detail-client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Affiliate · Admin' };

export default async function AdminAffiliatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <AdminShell title="Affiliate detail">
      <AffiliateDetailClient affiliateId={id} />
    </AdminShell>
  );
}
