'use client';

import { useApp } from '@/components/layout/providers';

export function OfflineMessage() {
  const { t, dir } = useApp();

  return (
    <p dir={dir} className="nova-card p-6 text-sm nova-muted">
      {t('offline.message')}
    </p>
  );
}
