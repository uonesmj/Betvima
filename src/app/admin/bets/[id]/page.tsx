import { AdminShell } from '@/components/admin/admin-shell';
import { BetDetailClient } from '@/components/admin/bet-detail-client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Bet · Admin' };

export default async function AdminBetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <AdminShell title="Bet detail">
      <BetDetailClient betId={id} />
    </AdminShell>
  );
}
