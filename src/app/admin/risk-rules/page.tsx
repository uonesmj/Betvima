import { AdminShell } from '@/components/admin/admin-shell';
import { RiskRulesClient } from '@/components/admin/risk-rules-client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Risk rules · Admin' };

export default function AdminRiskRulesPage() {
  return (
    <AdminShell title="Risk rules">
      <RiskRulesClient />
    </AdminShell>
  );
}
