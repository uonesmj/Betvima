import { AffiliateDashboardClient } from '@/components/account/affiliate-dashboard-client';
import { AffiliateDashboardErrorBoundary } from '@/components/account/affiliate-dashboard-error-boundary';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Affiliate dashboard' };

export default function AffiliateDashboardPage() {
  return <AffiliateDashboardErrorBoundary><AffiliateDashboardClient /></AffiliateDashboardErrorBoundary>;
}
