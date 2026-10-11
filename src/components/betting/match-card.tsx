'use client';

import Link from 'next/link';
import { Tv } from 'lucide-react';
import { useApp } from '@/components/layout/providers';
import { formatOddsScaled, formatRelative } from '@/lib/i18n';
import { useBetSlip, type SlipItem } from '@/lib/store/betslip';
import { TeamLogo } from '@/components/ui/logo';

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

export function MatchCard({
  match,
  compact = false,
  onSelectionAdded,
}: {
  match: MatchView;
  compact?: boolean;
  onSelectionAdded?: () => void;
}) {
  const { t } = useApp();
  const market = match.isLive
    ? match.topMarkets?.find((item) => item.key === 'h2h')
      ?? match.topMarkets?.find((item) => item.key !== 'h2h_lay' && !item.key.startsWith('alternate_'))
      ?? match.topMarkets?.find((item) => item.key !== 'h2h_lay')
      ?? match.topMarkets?.[0]
    : match.topMarkets?.find((item) => item.key === 'h2h')
      ?? match.topMarkets?.find((item) => item.key === 'totals')
      ?? match.topMarkets?.find((item) => item.key === 'spreads')
      ?? match.topMarkets?.find((item) => item.key === 'btts')
      ?? match.topMarkets?.find((item) => item.key !== 'h2h_lay')
      ?? match.topMarkets?.[0];
  const home = match.participants.find((p) => p.role === 'HOME');
  const away = match.participants.find((p) => p.role === 'AWAY');

  return (
    <article
      className={`nova-match-card bg-white transition-colors hover:bg-[#FAFBFC] ${compact ? "rounded-none" : "rounded-xl"}`}
      data-testid="match-card"
      data-match-id={match.id}
      data-live={match.isLive ? 'true' : 'false'}
    >
      <div className={`grid items-center ${compact ? "grid-cols-[52px_minmax(0,1fr)] gap-2.5 px-3 py-2.5" : "grid-cols-[68px_minmax(220px,1fr)_minmax(270px,1fr)] gap-3.5 px-3.5 py-3 max-md:grid-cols-[56px_minmax(0,1fr)] max-md:gap-2.5 max-md:px-3 max-md:py-2.5"}`}>
        <Link
          href={`/match/${match.id}`}
          className="flex min-w-0 flex-col justify-center gap-0.5"
        >
          {match.isLive ? (
            <>
              <span className="text-[11px] font-extrabold leading-4 text-[#F04A63]">
                {match.minute !== null ? `${match.minute}'` : 'LIVE'}
              </span>
            </>
          ) : (
            <>
              <span className="text-[11px] font-extrabold leading-4 text-[#5E6670]">
                {new Date(match.scheduledAt).toLocaleTimeString('en-GB', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
              <span className="text-[10px] font-medium text-[#9298A1]">
                {new Date(match.scheduledAt).toLocaleDateString('en-GB')}
              </span>
            </>
          )}
        </Link>

        <Link
          href={`/match/${match.id}`}
          className="min-w-0 rounded-xl py-0.5"
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <TeamLogo url={home?.logoUrl} name={home?.name} size={compact ? 24 : 28} />

            <span className={`min-w-0 truncate font-extrabold text-[#20242A] ${compact ? "text-[11px] leading-4" : "text-[12px] leading-5"}`}>
              {home?.name ?? 'TBD'}
            </span>

            {match.homeScore !== null ? (
              <strong className="ml-auto shrink-0 text-sm font-black tabular-nums text-[#20242A]">
                {match.homeScore}
              </strong>
            ) : null}
          </div>

          <div className={`${compact ? "my-1 h-px" : "my-1.5 h-px"} bg-[#ECEEF1]`} />

          <div className="flex min-w-0 items-center gap-2.5">
            <TeamLogo url={away?.logoUrl} name={away?.name} size={compact ? 24 : 28} />

            <span className={`min-w-0 truncate font-extrabold text-[#20242A] ${compact ? "text-[11px] leading-4" : "text-[12px] leading-5"}`}>
              {away?.name ?? 'TBD'}
            </span>

            {match.awayScore !== null ? (
              <strong className="ml-auto shrink-0 text-sm font-black tabular-nums text-[#20242A]">
                {match.awayScore}
              </strong>
            ) : null}
          </div>
        </Link>

        {market ? (
          <div className="col-span-2 grid min-w-0 grid-cols-[repeat(3,minmax(0,1fr))_46px] items-center gap-2 max-md:grid-cols-[repeat(3,minmax(0,1fr))_42px] max-md:gap-1.5">
            {market.selections.slice(0, 3).map((selection) => (
              <OddsButton
                key={`${selection.id}-${selection.oddsVersion}-${selection.oddsScaled}`}
                match={match}
                market={market}
                selection={selection}
                onSelectionAdded={onSelectionAdded}
                disabled={
                  !match.isBettingAvailable ||
                  market.status !== 'open'
                }
              />
            ))}

            <Link
              href={`/match/${match.id}`}
              className="grid h-[42px] min-w-0 place-items-center rounded-[10px] border border-[#DDE1E6] bg-[#EEF0F3] text-xs font-extrabold tabular-nums text-[#4F5660] transition hover:bg-[#E6E9ED]"
              aria-label={t('match.allMarkets')}
            >
              +{Math.max((match.marketsCount ?? 1) - 1, 1)}
            </Link>
          </div>
        ) : (
          <div className={`flex items-center justify-center rounded-[10px] border border-[#E5E8EC] bg-[#F5F6F8] text-[11px] font-semibold text-[#969CA5] max-md:col-span-2 ${compact ? "h-9" : "h-[46px]"}`}>
            Odds unavailable
          </div>
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
}: {
  match: MatchView;
  market: MarketView;
  selection: SelectionView;
  disabled?: boolean;
  onSelectionAdded?: () => void;
}) {
  const addSelection = useBetSlip((s) => s.toggle);
  const items = useBetSlip((s) => s.items);
  const selected = items.some(
    (i) => i.selectionId === selection.id,
  );

  const locked =
    disabled ||
    market.status !== 'open' ||
    selection.status !== 'open';

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
    <button
      key={`${selection.id}-${selection.oddsVersion}`}
      type="button"
      className={`odds-btn nova-odds-motion h-[42px] min-w-0 flex-1 rounded-[10px] border border-[#DCE1E6] bg-[#F7F8F9] px-2.5 transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50 max-md:px-1.5 ${
        selection.movement === 'UP'
          ? 'nova-odds-flash-up'
          : selection.movement === 'DOWN'
            ? 'nova-odds-flash-down'
            : ''
      }`}
      data-selected={selected}
      data-locked={locked}
      data-testid="odds-button"
      disabled={locked}
      aria-pressed={selected}
      onClick={() => {
        addSelection(item);
        onSelectionAdded?.();
      }}
    >
      <span className="block truncate text-[10px] text-[#5D646D]">
        {selection.name}
      </span>

      <span className="block text-sm font-extrabold tabular-nums text-[#20242A]">
        {formatOddsScaled(selection.oddsScaled)}
      </span>
    </button>
  );
}
