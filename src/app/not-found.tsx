import Link from 'next/link';
import { PageShell } from '@/components/layout/page-shell';

export default function NotFound() {
  return (
    <PageShell title="404">
      <div className="nova-card p-8 text-center text-sm nova-muted">
        <p>This page does not exist.</p>
        <Link href="/" className="nova-btn-primary mt-3 inline-flex">Back to the sportsbook</Link>
      </div>
    </PageShell>
  );
}
