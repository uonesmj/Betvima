import { AffiliateReferralsClient } from '@/components/account/affiliate-referrals-client';

import AffiliateSummaryClient from '@/components/account/affiliate-summary-client';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Referrals' };

export default function AffiliateReferralsPage() {
  return (
    <>
      <AffiliateSummaryClient />
      <AffiliateReferralsClient />
    </>
  );
}
