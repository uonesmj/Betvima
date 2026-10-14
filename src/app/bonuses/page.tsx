import { PageShell } from '@/components/layout/page-shell';
import { BonusesClient } from '@/components/bonuses/bonuses-client';

export default function BonusesPage() {
  return (
    <PageShell titleKey="page.bonuses" subtitleKey="page.bonusesSubtitle">
      <BonusesClient />
    </PageShell>
  );
}
