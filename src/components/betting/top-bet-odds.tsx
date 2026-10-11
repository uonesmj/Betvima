'use client';
import { OddsButton, type MatchView, type MarketView, type SelectionView } from './match-card';

export function TopBetOdds({ match, market, selections }: { match: MatchView; market: MarketView; selections: SelectionView[] }) {
  return <div className='grid grid-cols-3 gap-2'>{selections.map((selection) => <OddsButton key={selection.id} match={match} market={market} selection={selection} />)}</div>;
}
