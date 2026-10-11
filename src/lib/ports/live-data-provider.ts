import type { ISODateString } from '@/lib/types';
import type { ProviderResult, ProviderStatus } from '@/lib/ports/providers';

export interface LiveFixture {
  fixtureId: string;
  homeTeamName: string;
  awayTeamName: string;
  homeTeamProviderId: string | null;
  awayTeamProviderId: string | null;
  status: string;
  statusShort: string;
  minute: number | null;
  extraMinute: number | null;
  period: string | null;
  homeScore: number | null;
  awayScore: number | null;
  firstHalfHomeScore: number | null;
  firstHalfAwayScore: number | null;
  observedAt: ISODateString;
}

export interface LiveEvent {
  providerEventId: string | null;
  type: string;
  minute: number | null;
  extraMinute: number | null;
  period: string | null;
  teamProviderId: string | null;
  teamName: string | null;
  playerName: string | null;
  assistName: string | null;
  detail: string | null;
  comments: string | null;
  observedAt: ISODateString;
}

export interface LiveStatistics {
  fixtureId: string;
  teams: Array<{
    providerTeamId: string | null;
    teamName: string | null;
    statistics: Array<{
      type: string;
      value: string | number | null;
    }>;
  }>;
  observedAt: ISODateString;
}

export interface LiveDataProvider {
  readonly name: string;
  readonly configured: boolean;
  health(): Promise<ProviderStatus>;
  fetchLiveFixtures(): Promise<ProviderResult<LiveFixture[]>>;
  fetchEvents(fixtureId: string): Promise<ProviderResult<LiveEvent[]>>;
  fetchStatistics(fixtureId: string): Promise<ProviderResult<LiveStatistics>>;
}

export function normalizeLiveTeamName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\b(fc|sc|afc|cf|ac|ec|club|sporting)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}
