import { redirect } from 'next/navigation';
import { sportByKey } from '@/lib/betsapi-sports-map';
export const dynamic = 'force-dynamic';
/** Old provider league UUIDs cannot filter Bet365 fixtures; redirect to the new sport feed. */
export default async function LeaguePage({ params }: { params: Promise<{ sport: string; leagueId: string }> }) {
  const { sport } = await params;
  redirect('/sports/' + (sportByKey(sport)?.key ?? 'football'));
}
