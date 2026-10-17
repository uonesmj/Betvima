import { BetsApiExplorer } from '@/components/betsapi/betsapi-explorer';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'BetsAPI Live and Upcoming Markets | BetVima',
  description: 'Read-only multisport BetsAPI and Bet365 sports catalogue and market inspection.',
};

export default function BetsApiPage() {
  return <BetsApiExplorer />;
}
