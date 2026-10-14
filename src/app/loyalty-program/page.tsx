import { PageShell } from '@/components/layout/page-shell';
import { LoyaltyProgramClient } from '@/components/loyalty/loyalty-program-client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'VIP Club | BetVima' };

export default function LoyaltyProgramPage() {
  return (
    <PageShell titleKey="menu.vipClub">
      <LoyaltyProgramClient />
    </PageShell>
  );
}
