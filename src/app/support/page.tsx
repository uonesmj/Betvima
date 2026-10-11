import { PageShell } from '@/components/layout/page-shell';
import SupportClient from '@/components/support/support-client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Online Support' };

export default function SupportPage() {
  return <PageShell title="Support"><SupportClient /></PageShell>;
}
