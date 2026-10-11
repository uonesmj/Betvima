import type { BetGrade, BetStatus, BetType, Currency, ISODateString, LegStatus, UUID } from './common';

export interface BetSlipLegInput {
  matchId: UUID; marketId: UUID; selectionId: UUID;
  /** Odds the USER saw and accepted. Never trusted for pricing - only compared to server truth. */
  clientOddsScaled: bigint | null;
  marketVersion: number | null;
  acceptOddsChange: boolean;
}
export interface BetSlipInput {
  type: BetType;
  stakeMinor: bigint;
  currency: Currency;
  fundingSource?: 'main' | 'bonus';
  bonusGrantId?: UUID | null;
  legs: BetSlipLegInput[];
  /** Required for SYSTEM bets. */
  systemSelections?: number[];
  /** User acknowledged a system-bet or accumulator warning. */
  acceptWarnings?: boolean;
}
export interface BetLeg {
  id: UUID; betId: UUID; matchId: UUID; marketId: UUID; selectionId: UUID;
  matchLabel: string; marketLabel: string; selectionLabel: string;
  oddsAtPlacementScaled: bigint; acceptedOddsScaled: bigint | null; status: LegStatus; grade: BetGrade | null;
  settledAt: ISODateString | null;
  match: {
    leagueName: string | null;
    leagueLogoUrl: string | null;
    homeTeamName: string | null;
    homeTeamShortName: string | null;
    homeTeamLogoUrl: string | null;
    awayTeamName: string | null;
    awayTeamShortName: string | null;
    awayTeamLogoUrl: string | null;
    scheduledAt: ISODateString | null;
    status: string | null;
    clock: string | null;
    minute: number | null;
    period: string | null;
    homeScore: number | null;
    awayScore: number | null;
    venue: string | null;
  };
}
export interface Bet {
  id: UUID; publicId: string; userId: UUID; type: BetType; status: BetStatus; currency: Currency;
  stakeMinor: bigint; potentialPayoutMinor: bigint; settledPayoutMinor: bigint | null; netResultMinor: bigint | null;
  combinedOddsScaled: bigint; legs: BetLeg[]; placedAt: ISODateString; settledAt: ISODateString | null;
  revision: number; isLive: boolean; isCashoutAvailable: boolean; cashoutValueMinor: bigint | null;
  affiliateId: UUID | null; source: 'web' | 'mobile' | 'admin' | 'api';
}
export interface OddsChange { selectionId: UUID; previousOddsScaled: bigint; currentOddsScaled: bigint; currentOddsVersion: number; direction: 'UP' | 'DOWN' }
export interface PlacementQuote {
  type: BetType; currency: Currency; stakeMinor: bigint;
  combinedOddsScaled: bigint; potentialPayoutMinor: bigint; maxPayout: bigint;
  warnings: string[]; oddsChanges: OddsChange[];
  /** Opaque token binding the quote to the exact odds versions it was priced against. */
  quoteToken: string; expiresAt: ISODateString;
}
export interface PlacementResult {
  status: 'accepted' | 'idempotent_replay';
  bet: Bet; balanceAfterMinor: bigint; quote: PlacementQuote;
}
export interface BetFilter {
  userId?: UUID; status?: BetStatus[]; type?: BetType; from?: ISODateString; to?: ISODateString;
  currency?: Currency; minStakeMinor?: bigint; maxStakeMinor?: bigint; search?: string;
  page?: number; pageSize?: number; sortBy?: 'placed_at' | 'stake_minor' | 'potential_payout_minor'; sortDirection?: 'asc' | 'desc';
}
export interface CashoutQuote {
  betId: UUID; available: boolean; reason?: string; offerMinor: bigint | null; quoteId?: UUID;
  originalStakeMinor: bigint; potentialPayoutMinor: bigint; expiresAt: ISODateString | null; margin: number | null;
}
