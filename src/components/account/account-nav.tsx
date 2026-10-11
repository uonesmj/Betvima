'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useApp } from '@/components/layout/providers';

const ITEMS = [
  { href: '/account/profile', key: 'account.profile' },
];

export function AccountNav() {
  const { t } = useApp();
  const pathname = usePathname();
  return (
    <nav className="mb-4 flex gap-1 overflow-x-auto">
      {ITEMS.map((item) => (
        <Link key={item.href} href={item.href} onClick={(event) => { if (item.key === 'account.profile') { event.preventDefault(); window.dispatchEvent(new CustomEvent('nova:open-profile-sheet')); } }} className={`nova-tab ${pathname === item.href ? 'nova-tab-active' : ''}`}>{t(item.key)}</Link>
      ))}
    </nav>
  );
}
