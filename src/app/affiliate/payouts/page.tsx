import { AffiliatePayoutsClient } from '@/components/account/affiliate-payouts-client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Payouts' };

export default function AffiliatePayoutsPage() {
  return <AffiliatePayoutsClient />;
}
