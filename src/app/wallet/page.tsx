import { PageShell } from '@/components/layout/page-shell';
import { WalletClient } from '@/components/account/wallet-client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'کیف پول' };

export default function WalletPage() {
  return (
    <PageShell titleKey="page.wallet" subtitleKey="page.walletSubtitle">
      <WalletClient />
    </PageShell>
  );
}
