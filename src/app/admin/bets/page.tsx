import { AdminShell } from '@/components/admin/admin-shell';
import { BetsClient } from '@/components/admin/bets-client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Bets · Admin' };

export default function AdminBetsPage() {
  return (
    <AdminShell title="Bets">
      <BetsClient />
    </AdminShell>
  );
}
