import { PageShell } from '@/components/layout/page-shell';
import { CasinoCatalogueClient } from '@/components/casino/casino-showcase';

export const dynamic = 'force-dynamic';

export default function CasinoPage() {
  return (
    <PageShell title="Casino" subtitle="Slots and live casino games">
      <CasinoCatalogueClient />
    </PageShell>
  );
}
