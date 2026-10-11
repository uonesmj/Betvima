import { AdminShell } from '@/components/admin/admin-shell';
import { MatchesClient } from '@/components/admin/matches-client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Matches · Admin' };

export default function AdminMatchesPage() {
  return (
    <AdminShell title="Matches & results">
      <MatchesClient />
    </AdminShell>
  );
}
