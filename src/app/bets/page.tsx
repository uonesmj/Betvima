import { PageShell } from '@/components/layout/page-shell';
import { MyBetsClient } from '@/components/account/my-bets-client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'My bets' };

export default function BetsPage() {
  return (
    <PageShell titleKey="page.myBets" subtitleKey="page.myBetsSubtitle">
      <MyBetsClient />
    </PageShell>
  );
}
