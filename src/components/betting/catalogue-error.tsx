'use client';

import { PageShell } from '@/components/layout/page-shell';
import { ServiceNotice } from '@/components/layout/service-notice';
import { useApp } from '@/components/layout/providers';

export function CatalogueError({ reset }: { reset: () => void }) {
  const { t } = useApp();
  return (
    <PageShell>
      <ServiceNotice tone="warning" titleKey="page.catalogueUnavailable" childrenKey="page.catalogueUnavailableDetail" />
      <button type="button" className="nova-btn-primary" onClick={reset}>{t('common.retry')}</button>
    </PageShell>
  );
}
