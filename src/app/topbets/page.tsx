import { PageShell } from '@/components/layout/page-shell';
import Link from 'next/link';
export const dynamic = 'force-dynamic';
/** No old source or unverified BetsAPI prices can be represented as recommended bets. */
export default function TopBetsPage() {
  return <PageShell title="Top Bets">
    <div className="mx-3 my-3 rounded-xl border border-slate-200 bg-white p-6">
      <p className="text-sm text-slate-600">Top bets will appear after BetsAPI markets and payout rules are independently verified.</p>
      <Link href="/sports/football" className="mt-3 inline-block text-sm font-semibold text-[#087FF5]">Browse BetsAPI upcoming matches</Link>
    </div>
  </PageShell>;
}
