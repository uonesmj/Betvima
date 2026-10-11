import { AdminShell } from '@/components/admin/admin-shell';
import { ProvidersClient } from '@/components/admin/providers-client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Providers · Admin' };

export default function AdminProvidersPage() {
  return (
    <AdminShell title="Providers">
      <ProvidersClient />
    </AdminShell>
  );
}
