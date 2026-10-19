'use client';

import Link from 'next/link';
import { sportsbookMatchHref } from '@/lib/betsapi-links';
import { BetsApiHeadlinePrices } from '@/components/betsapi/betsapi-headline-prices';
import { CalendarDays, ChevronRight, LockKeyhole, Radio } from 'lucide-react';
import { useApp } from '@/components/layout/providers';
import { translateSportName, translateBettingSelection } from '@/lib/i18n/ui-phrases';
import { formatOddsScaled } from '@/lib/i18n';
import { useBetSlip, type SlipItem } from '@/lib/store/betslip';
import { TeamLogo, LeagueLogo } from '@/components/ui/logo';
import { primaryBettingMarket } from '@/lib/primary-betting-market';
import { isDisplayBettableSelection } from '@/lib/odds/selection-eligibility';
import { matchMinuteLabel } from '@/lib/live-match-minute';
import { VerifiedClockText } from '@/components/betsapi/verified-clock';

export interface SelectionView {
  id: string;
  code: string;
  name: string;
  oddsScaled: string;
  previousOddsScaled: string | null;
  status: string;
  movement?: 'UP' | 'DOWN' | 'STABLE';
  oddsVersion: number;
}

export interface MarketView {
  id: string;
  key: string;
  name: string;
  status: string;
  specifier?: string | null;
  selections: SelectionView[];
}

export interface MatchView {
  id: string;
  sportKey: string;
  leagueId: string | null;
  leagueName: string | null;
  leagueLogoUrl: string | null;
  countryCode: string | null;
  status: string;
  scheduledAt: string;
  minute: number | null;
  betsApiEventId?: string | null;
  clockSeconds?: number | null;
  clockRunning?: boolean;
  clockObservedAt?: string | null;
  period?: string | null;
  homeScore: number | null;
  awayScore: number | null;
  participants: {
    teamId: string;
    role: string;
    name: string;
    logoUrl: string | null;
  }[];
  isLive: boolean;
  isBettingAvailable: boolean;
  marketsCount?: number;
  topMarkets?: MarketView[];
}

/**
 * Shared fixture layout. Search, catalogue, live, upcoming and Top Bets render
 * exactly the same information hierarchy; only the content width can differ.
 * Prices and scores always come from the official match API.
 */
export function MatchCard({
  match, compact = false, onSelectionAdded,
}: {
  match: MatchView; compact?: boolean; onSelectionAdded?: () => void;
}) {
  const { t, locale } = useApp();
  const market = primaryBettingMarket(match.topMarkets, match.isLive);
  const home = match.participants.find((p) => p.role === 'HOME') ?? match.participants[0];
  const away = match.participants.find((p) => p.role === 'AWAY') ?? match.participants[1];
  const kickoffDate = new Date(match.scheduledAt);
  const validKickoff = !Number.isNaN(kickoffDate.getTime());
  const kickoff = validKickoff
    ? new Intl.DateTimeFormat(locale === 'fa' ? 'fa-IR' : 'en-GB', {
        hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric',
      }).format(kickoffDate).replace(',', ' •')
    : '—';
  const marketName = market?.name ?? (locale === 'fa' ? 'ضریب موجود نیست' : 'Odds unavailable');
  const teams = [
    { team: home, score: match.homeScore },
    { team: away, score: match.awayScore },
  ];
  return (
    <article data-testid="match-card" data-match-id={match.id}
      data-live={match.isLive ? 'true' : 'false'}
      className="nova-match-card overflow-hidden rounded-[21px] border border-[#E2E7EC] bg-white shadow-[0_3px_13px_rgba(18,35,51,.055)]" data-compact={compact}>
      <Link href={sportsbookMatchHref(match.id, match)}
        className="flex min-w-0 items-center gap-2.5 border-b border-[#E2E7EC] bg-gradient-to-r from-[#F1F7F9] to-[#FCFDFE] px-3.5 py-3">
        <span className="grid h-[37px] w-[37px] shrink-0 place-items-center rounded-xl border border-[#E2E7EC] bg-white">
          <LeagueLogo url={match.leagueLogoUrl} name={match.leagueName} sportKey={match.sportKey} size={26} />
        </span>
        <span className="min-w-0 flex-1">
          <strong className="block truncate text-[13px] font-extrabold text-[#202832]">
            {match.leagueName ?? match.sportKey}
          </strong>
          <span className="block truncate text-[10px] capitalize text-[#798592]">
            {match.sportKey.replaceAll('-', ' ')}
          </span>
        </span>
        <span className={`inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-[6px] text-[10px] font-extrabold ${match.isLive
          ? 'bg-[#FFEAF2] text-[#C71961]' : 'bg-[#E8F8F1] text-[#008957]'}`}>
          {match.isLive ? <Radio size={12}/> : <CalendarDays size={12}/>}
          {match.isLive ? (locale === 'fa' ? 'زنده' : 'LIVE') : (locale === 'fa' ? 'آینده' : 'PRE')}
        </span>
      </Link>
      <div className="space-y-2.5 px-3.5 pb-3.5 pt-2.5">
        <Link href={sportsbookMatchHref(match.id, match)} className="flex items-center gap-2">
          <span className={match.isLive ? 'text-[#E91F70]' : 'text-[#00A66A]'}>
            {match.isLive ? <Radio size={15}/> : <CalendarDays size={15}/>}
          </span>
          <span className="rounded-lg bg-[#F3F6F9] px-2.5 py-[6px] text-[11px] font-bold text-[#202832]">
            {match.isLive ? (match.id.startsWith('betsapi:') ?
              <VerifiedClockText source={match} fallback={matchMinuteLabel(match.minute, match.period)}/> :
              matchMinuteLabel(match.minute, match.period)) : kickoff}
          </span>
          {match.isLive && (match.homeScore !== null || match.awayScore !== null) &&
            <span className="ml-auto text-[9px] font-bold text-[#798592]">{locale === 'fa' ? 'نتیجه' : 'SCORE'}</span>}
        </Link>
        <Link href={sportsbookMatchHref(match.id, match)} className="block space-y-2">
          {teams.map(({ team, score }, i) => (
            <div key={i} className="flex min-w-0 items-center gap-2">
              <TeamLogo url={team?.logoUrl} name={team?.name} size={27} />
              <strong className="min-w-0 flex-1 truncate text-[13px] font-extrabold text-[#202832]">
                {locale === 'fa' ? translateSportName(team?.name ?? 'TBD') : team?.name ?? 'TBD'}
              </strong>
              {match.isLive && score !== null &&
                <span className="min-w-[26px] rounded-[7px] bg-[#EDF1F5] px-2 py-1 text-center text-[13px] font-black tabular-nums text-[#202832]">{score}</span>}
            </div>
          ))}
        </Link>
        <div className="h-px bg-[#E2E7EC]/70" />
        {match.id.startsWith('betsapi:') ? (
          <BetsApiHeadlinePrices matchId={match.id} />
        ) : (
          <>
        <div className="flex min-w-0 items-center justify-between gap-2">
          <span className="min-w-0 truncate text-[11px] text-[#798592]">{marketName}</span>
          <span className="shrink-0 text-[9px] font-bold text-[#798592]">{locale === 'fa' ? 'ضرایب' : 'ODDS'}</span>
        </div>
        <div className="grid grid-cols-[repeat(3,minmax(0,1fr))_46px] gap-1.5">
          {Array.from({length:3},(_,index)=>{
            const selection = market?.selections[index];
            return market && selection ? (
              <OddsButton key={selection.id} match={match} market={market}
                selection={selection} disabled={!match.isBettingAvailable}
                onSelectionAdded={onSelectionAdded}
                shortLabel={market.key === 'h2h' && market.selections.length >= 3 ? ['1','X','2'][index] : undefined} />
            ) : <div key={index} className="grid h-[53px] place-items-center rounded-[10px] bg-[#F3F6F9] text-sm text-[#798592]">—</div>;
          })}
          <Link href={sportsbookMatchHref(match.id, match)} aria-label={t('match.allMarkets')}
            className="grid h-[53px] place-items-center rounded-[10px] border border-[#D4E5F8] bg-[#EAF3FF] text-[12px] font-black text-[#087FF5]">
            {match.marketsCount ? `+${match.marketsCount}` : <ChevronRight size={17}/>}
          </Link>
        </div>
          </>
        )}
      </div>
    </article>
  );
}

export function OddsButton({
  match,
  market,
  selection,
  disabled,
  onSelectionAdded,
  shortLabel,
}: {
  match: MatchView;
  market: MarketView;
  selection: SelectionView;
  disabled?: boolean;
  onSelectionAdded?: () => void;
  shortLabel?: string;
}) {
  const { locale } = useApp();
  const addSelection = useBetSlip((s) => s.toggle);
  const items = useBetSlip((s) => s.items);
  const selected = items.some(
    (i) => i.selectionId === selection.id,
  );

  const locked = !isDisplayBettableSelection({
    matchBettingAvailable: !disabled,
    marketStatus: market.status,
    selectionStatus: selection.status,
    oddsScaled: selection.oddsScaled,
  });

  const item: SlipItem = {
    selectionId: selection.id,
    marketId: market.id,
    matchId: match.id,
    label: selection.name,
    marketLabel: market.name,
    matchLabel: `${match.participants.find((p) => p.role === 'HOME')?.name ?? ''} - ${match.participants.find((p) => p.role === 'AWAY')?.name ?? ''}`.trim(),
    sportSlug: match.sportKey,
    oddsScaled: selection.oddsScaled,
    oddsVersionSeen: selection.oddsVersion,
    addedAt: Date.now(),
  };

  return (
    <button key={`${selection.id}-${selection.oddsVersion}`} type="button"
      disabled={locked} data-selected={selected} data-locked={locked}
      data-testid="odds-button" aria-pressed={selected}
      aria-label={`${selection.name}: ${locked ? 'Unavailable' : formatOddsScaled(selection.oddsScaled)}`}
      title={locked ? 'Odds paused — waiting for a valid current price' : 'Add to bet slip'}
      className={`odds-btn nova-odds-motion flex h-[53px] min-w-0 flex-col items-center justify-center rounded-[10px] border px-1.5 py-1 transition-colors duration-150 disabled:cursor-not-allowed
        ${selected ? 'border-[#087FF5] bg-[#E0EDFF] text-[#087FF5]' : 'border-[#E9EDF2] bg-[#F3F6F9] text-[#202832]'}
        ${selection.movement === 'UP' && !locked ? 'nova-odds-flash-up' : selection.movement === 'DOWN' && !locked ? 'nova-odds-flash-down' : ''}`}
      onClick={() => { addSelection(item); onSelectionAdded?.(); }}>
      <span className="w-full truncate text-center text-[10px] leading-[14px] text-[#798592]">
        {shortLabel ?? (locale === 'fa' ? translateBettingSelection(selection.name) : selection.name)}
      </span>
      <span className="mt-0.5 flex items-center gap-1 text-[14px] font-black tabular-nums">
        {locked ? <LockKeyhole size={13} className="text-[#798592]"/> : formatOddsScaled(selection.oddsScaled)}
      </span>
    </button>
  );
}
