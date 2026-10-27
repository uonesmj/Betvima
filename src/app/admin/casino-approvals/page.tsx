import { AdminShell } from '@/components/admin/admin-shell';
import { CasinoApprovalsClient } from '@/components/admin/casino-approvals-client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Casino approvals · Admin' };

export default function AdminCasinoApprovalsPage() {
  return (
    <AdminShell title="Casino approvals">
      <CasinoApprovalsClient />
    </AdminShell>
  );
}
