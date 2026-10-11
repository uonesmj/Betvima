import type { BetGrade, ISODateString, MarketStatus, MatchStatus, SportKey, UUID } from './common';

export interface Sport { key: SportKey; nameEn: string; nameFa: string; icon: string; sortOrder: number; isActive: boolean }
export interface Country { code: string; nameEn: string; nameFa: string; flag: string | null }
export interface League {
  id: UUID; sportKey: SportKey; countryCode: string | null; nameEn: string; nameFa: string;
  slug: string; tier: number | null; isActive: boolean; priority: number; logoUrl: string | null;
  matchCount?: number;
}
export interface Team { id: UUID; sportKey: SportKey; nameEn: string; nameFa: string; shortName: string | null; logoUrl: string | null }
export interface MatchParticipant { teamId: UUID; role: 'HOME' | 'AWAY' | 'NEUTRAL'; name: string; shortName: string | null; logoUrl: string | null }

export interface Match {
  id: UUID; sportKey: SportKey; leagueId: UUID | null; leagueName: string | null; leagueLogoUrl: string | null; countryCode: string | null;
  status: MatchStatus; scheduledAt: ISODateString; startedAt: ISODateString | null; finishedAt: ISODateString | null;
  minute: number | null; period: string | null;
  homeScore: number | null; awayScore: number | null; homeHalfScore: number | null; awayHalfScore: number | null;
  participants: MatchParticipant[]; provider: string | null; isLive: boolean; isBettingAvailable: boolean;
  hasLiveStream: boolean; updatedAt: ISODateString;
  marketsCount?: number; topMarkets?: MarketSummary[];
}

export interface Selection {
  id: UUID; marketId: UUID; code: string; nameEn: string; nameFa: string; shortName: string | null;
  participantType: 'HOME' | 'AWAY' | 'DRAW' | 'NEUTRAL'; line: string | null;
  oddsScaled: bigint; previousOddsScaled: bigint | null; oddsVersion: number;
  status: 'active' | 'suspended' | 'closed' | 'settled' | 'void';
  updatedAt: ISODateString; movement?: 'UP' | 'DOWN' | 'STABLE';
}
export interface MarketSummary { id: UUID; key: string; nameEn: string; nameFa: string; status: MarketStatus; selections: Selection[] }
export interface Market extends MarketSummary {
  matchId: UUID; type: string; specifier: string | null; isLive: boolean; sortOrder: number;
  margin: number | null; version: number; openedAt: ISODateString | null; closedAt: ISODateString | null;
  settledAt: ISODateString | null; settledBy: UUID | null; maxStakeMinor: bigint | null; updatedAt: ISODateString;
}
export interface MatchEventView {
  id: UUID;
  providerEventId: string;
  type: string;
  minute: number | null;
  period: string | null;
  teamId?: UUID | null;
  teamName?: string | null;
  playerName: string | null;
  detail: string | null;
  occurredAt: ISODateString;
}
export interface MatchStatsView {
  provider: string | null;
  updatedAt: ISODateString;
  payload: Record<string, unknown>;
}
export interface MatchResultSnapshot {
  matchId: UUID; status: MatchStatus; homeScore: number | null; awayScore: number | null;
  homeHalfScore: number | null; awayHalfScore: number | null; homeCorners: number | null; awayCorners: number | null;
  homeCards: number | null; awayCards: number | null; extraTime: boolean; penalties: boolean;
  penaltyHome: number | null; penaltyAway: number | null;
  provider: string | null; providerResultId: string | null; authoritative: boolean; revision: number; observedAt: ISODateString;
}
export interface SelectionForGrading { selectionId: UUID; marketId: UUID; marketKey: string; legId: UUID; grade: BetGrade; oddsScaled: bigint }
