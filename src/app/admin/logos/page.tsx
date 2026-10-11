import { AdminShell } from '@/components/admin/admin-shell';
import { LogosClient } from '@/components/admin/logos-client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Logos · Admin' };

export default function AdminLogosPage() {
  return (
    <AdminShell title="Team & league logos">
      <LogosClient />
    </AdminShell>
  );
}
