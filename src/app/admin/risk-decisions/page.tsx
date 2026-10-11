import { AdminShell } from '@/components/admin/admin-shell';
import { RiskDecisionsClient } from '@/components/admin/risk-decisions-client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Risk decisions · Admin' };

export default function AdminRiskDecisionsPage() {
  return (
    <AdminShell title="Risk decisions">
      <RiskDecisionsClient />
    </AdminShell>
  );
}
