import { AdminShell } from '@/components/admin/admin-shell';
import { MatchDetailClient } from '@/components/admin/match-detail-client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Match · Admin' };

export default async function AdminMatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <AdminShell title="Match trading">
      <MatchDetailClient matchId={id} />
    </AdminShell>
  );
}
