import { PageShell } from '@/components/layout/page-shell';
import { OfflineMessage } from '@/components/layout/offline-message';

export const metadata = { title: 'Offline' };

export default function OfflinePage() {
  return (
    <PageShell titleKey="page.offline">
      <p className="nova-card p-6 text-sm nova-muted">
        NOVA needs a connection for odds, bets and money movements. Nothing is queued and no bet is placed while offline —
        reopen the app when you are back online.
      </p>
    </PageShell>
  );
}
