import { PageShell } from '@/components/layout/page-shell';
import { BetsApiHomeReference } from '@/components/betsapi/betsapi-home-reference';

export const dynamic = 'force-dynamic';
export default function HomePage() {
  return <PageShell><BetsApiHomeReference /></PageShell>;
}
