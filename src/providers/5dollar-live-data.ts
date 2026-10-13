import type { ISODateString } from '@/lib/types';
import type { ProviderMatch, ProviderResult, ProviderStatus } from '@/lib/ports/providers';
import type { LiveDataProvider, LiveEvent, LiveFixture, LiveStatistics } from '@/lib/ports/live-data-provider';
import { FiveDollarFootballApiSportsProvider } from './5dollar-football-api';

const observedAt = (): ISODateString => new Date().toISOString() as ISODateString;

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}

function nameOf(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim();
  const rec = asRecord(value);
  const name = rec.name ?? rec.full_name ?? rec.player_name;
  return typeof name === 'string' && name.trim() ? name.trim() : null;
}

function fixtureStatus(match: ProviderMatch): string {
  return match.status === 'live' ? match.period ?? 'LIVE' : match.status;
}

export class FiveDollarLiveDataProvider implements LiveDataProvider {
  readonly name = '5dollarfootballapi';
  readonly configured: boolean;

  constructor(private readonly football: FiveDollarFootballApiSportsProvider = new FiveDollarFootballApiSportsProvider()) {
    this.configured = football.configured;
  }

  health(): Promise<ProviderStatus> {
    return this.football.health();
  }

  async fetchLiveFixtures(): Promise<ProviderResult<LiveFixture[]>> {
    const response = await this.football.fetchLiveMatches('football');
    if (!response.ok || !response.value) return { ...response, value: null };
    const at = observedAt();
    return {
      ok: true,
      value: response.value.map((match) => ({
        fixtureId: match.providerId,
        homeTeamName: match.homeTeamName,
        awayTeamName: match.awayTeamName,
        homeTeamProviderId: match.homeTeamProviderId ?? null,
        awayTeamProviderId: match.awayTeamProviderId ?? null,
        status: match.status,
        statusShort: fixtureStatus(match),
        minute: match.minute,
        extraMinute: null,
        period: match.period,
        homeScore: match.homeScore,
        awayScore: match.awayScore,
        firstHalfHomeScore: match.homeHalfScore ?? null,
        firstHalfAwayScore: match.awayHalfScore ?? null,
        observedAt: at,
      })),
    };
  }

  async fetchEvents(fixtureId: string): Promise<ProviderResult<LiveEvent[]>> {
    const response = await this.football.fetchFixture(fixtureId);
    if (!response.ok || !response.value) return { ...response, value: null };
    const at = observedAt();
    const rawEvents = response.value.liveEvents ?? [];
    return {
      ok: true,
      value: rawEvents.flatMap((item, index) => {
        const event = asRecord(item);
        if (Object.keys(event).length === 0) return [];
        const player = event.player ?? event.player_name;
        const assist = event.assist ?? event.assist_name;
        const team = event.team ?? event.team_name;
        const teamRecord = asRecord(team);
        const minute = numberOrNull(event.minute ?? event.elapsed);
        const extraMinute = numberOrNull(event.extra_minute ?? event.extra);
        return [{
          providerEventId: String(event.id ?? event.event_id ?? `${fixtureId}:${index}:${minute ?? ''}:${event.type ?? ''}`),
          type: String(event.type ?? 'event'),
          minute,
          extraMinute,
          period: event.period == null ? null : String(event.period),
          teamProviderId: teamRecord.id == null ? null : String(teamRecord.id),
          teamName: nameOf(team),
          playerName: nameOf(player),
          assistName: nameOf(assist),
          detail: event.detail == null ? null : String(event.detail),
          comments: event.comments == null ? null : String(event.comments),
          observedAt: at,
        }];
      }),
    };
  }

  async fetchStatistics(fixtureId: string): Promise<ProviderResult<LiveStatistics>> {
    const response = await this.football.fetchFixture(fixtureId);
    if (!response.ok || !response.value) return { ...response, value: null };
    const match = response.value;
    const stats = asRecord(match.liveStats);
    const toTeam = (side: 'home' | 'away') => {
      const entries: Array<{ type: string; value: string | number | null }> = [];
      for (const [key, raw] of Object.entries(stats)) {
        const teamValue = asRecord(raw)[side];
        if (teamValue === undefined) continue;
        const nested = asRecord(teamValue);
        if (Object.keys(nested).length > 0) {
          for (const [part, value] of Object.entries(nested)) {
            if (typeof value === 'string' || typeof value === 'number' || value === null) {
              entries.push({ type: `${key}_${part}`, value });
            }
          }
        } else if (typeof teamValue === 'string' || typeof teamValue === 'number' || teamValue === null) {
          entries.push({ type: key, value: teamValue });
        }
      }
      return {
        providerTeamId: side === 'home' ? match.homeTeamProviderId ?? null : match.awayTeamProviderId ?? null,
        teamName: side === 'home' ? match.homeTeamName : match.awayTeamName,
        statistics: entries,
      };
    };
    return {
      ok: true,
      value: { fixtureId, teams: [toTeam('home'), toTeam('away')], observedAt: observedAt() },
    };
  }
}
