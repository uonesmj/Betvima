import { AdminShell } from '@/components/admin/admin-shell';
import { AffiliatesClient } from '@/components/admin/affiliates-client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Affiliates · Admin' };

export default function AdminAffiliatesPage() {
  return (
    <AdminShell title="Affiliates">
      <AffiliatesClient />
    </AdminShell>
  );
}
