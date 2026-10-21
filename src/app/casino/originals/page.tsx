import { PageShell } from '@/components/layout/page-shell';
import { BetVimaOriginalsClient } from '@/components/casino/originals-client';

export const dynamic = 'force-dynamic';

export default function CasinoOriginalsPage() {
  return (
    <PageShell title="BetVima Originals" subtitle="Independent casino games · Demo only">
      <BetVimaOriginalsClient />
    </PageShell>
  );
}
