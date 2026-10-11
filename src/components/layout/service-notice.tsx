'use client';

import type { ReactNode } from 'react';
import { useApp } from './providers';

/**
 * Honest degradation banner: shown whenever a capability is not configured. It never
 * hides the fact that odds, payments or auth are unavailable.
 */
export function ServiceNotice({ tone = 'info', title, titleKey, children, childrenKey, action }: { tone?: 'info' | 'warning' | 'danger'; title?: string; titleKey?: string; children?: ReactNode; childrenKey?: string; action?: ReactNode }) {
  const { t } = useApp();
  const tones = {
    info: 'border-nova-info/40 bg-nova-info/10 text-nova-info',
    warning: 'border-nova-warn/40 bg-nova-warn/10 text-nova-warn',
    danger: 'border-nova-danger/40 bg-nova-danger/10 text-nova-danger',
  } as const;
  return (
    <div className={`mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-sm ${tones[tone]}`} role="status">
      <div>
        <div className="font-semibold">{titleKey ? t(titleKey) : title}</div>
        {childrenKey ? <div className="text-xs opacity-90">{t(childrenKey)}</div> : children ? <div className="text-xs opacity-90">{children}</div> : null}
      </div>
      {action}
    </div>
  );
}
