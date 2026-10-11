import type { ISODateString } from '@/lib/types';
import type { ProviderResult, ProviderStatus } from '@/lib/ports/providers';
import {
  type LiveDataProvider,
  type LiveFixture,
  type LiveEvent,
  type LiveStatistics,
} from '@/lib/ports/live-data-provider';

type ApiResponse<T> = {
  errors?: Record<string, unknown>;
  results?: number;
  response?: T;
};

type ApiFixture = {
  fixture?: {
    id?: number;
    date?: string;
    status?: {
      long?: string | null;
      short?: string | null;
      elapsed?: number | null;
      extra?: number | null;
    };
    periods?: {
      first?: number | null;
      second?: number | null;
    };
  };
  teams?: {
    home?: { id?: number; name?: string | null };
    away?: { id?: number; name?: string | null };
  };
  goals?: {
    home?: number | null;
    away?: number | null;
  };
};

type ApiEvent = {
  time?: { elapsed?: number | null; extra?: number | null };
  team?: { id?: number; name?: string | null };
  player?: { id?: number; name?: string | null };
  assist?: { id?: number; name?: string | null };
  type?: string | null;
  detail?: string | null;
  comments?: string | null;
};

type ApiStatistics = {
  team?: { id?: number; name?: string | null };
  statistics?: Array<{ type?: string | null; value?: string | number | null }>;
};

const BASE_URL = 'https://v3.football.api-sports.io';

function nowIso(): ISODateString {
  return new Date().toISOString() as ISODateString;
}

function errorText(errors: Record<string, unknown> | undefined): string | null {
  if (!errors || Object.keys(errors).length === 0) return null;
  return Object.entries(errors)
    .map(([key, value]) => `${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`)
    .join('; ');
}

export class ApiFootballLiveProvider implements LiveDataProvider {
  readonly name = 'api_football';
  readonly configured: boolean;
  private readonly apiKey: string;

  constructor() {
    this.apiKey = process.env.API_FOOTBALL_KEY ?? '';
    this.configured = Boolean(this.apiKey);
  }

  async health(): Promise<ProviderStatus> {
    if (!this.configured) {
      return {
        provider: this.name,
        category: 'sports',
        configured: false,
        enabled: false,
        reachable: null,
        lastError: null,
        lastSuccessAt: null,
        requiredEnv: ['API_FOOTBALL_KEY'],
        notes: 'API-Football live-data provider is not configured.',
      };
    }
    try {
      const response = await this.request<ApiResponse<unknown>>('/status');
      return {
        provider: this.name,
        category: 'sports',
        configured: true,
        enabled: true,
        reachable: response.ok,
        lastError: response.ok ? null : response.errorMessage ?? 'API-Football health check failed',
        lastSuccessAt: response.ok ? nowIso() : null,
        requiredEnv: ['API_FOOTBALL_KEY'],
        notes: 'Provides live fixture state, events and statistics for display only; settlement remains on the authoritative sports provider.',
      };
    } catch (error) {
      return {
        provider: this.name,
        category: 'sports',
        configured: true,
        enabled: true,
        reachable: false,
        lastError: error instanceof Error ? error.message : String(error),
        lastSuccessAt: null,
        requiredEnv: ['API_FOOTBALL_KEY'],
        notes: 'API-Football health check failed.',
      };
    }
  }

  async fetchLiveFixtures(): Promise<ProviderResult<LiveFixture[]>> {
    const result = await this.request<ApiResponse<ApiFixture[]>>('/fixtures?live=all');
    if (!result.ok || !result.value) {
      return {
        ok: false,
        value: null,
        errorCode: result.errorCode,
        errorMessage: result.errorMessage,
        retryable: result.retryable,
      };
    }
    const observedAt = nowIso();
    return {
      ok: true,
      value: (result.value.response ?? []).flatMap((item) => {
        const fixtureId = item.fixture?.id;
        const home = item.teams?.home;
        const away = item.teams?.away;
        if (!fixtureId || !home?.name || !away?.name) return [];
        const status = item.fixture?.status;
        const goals = item.goals;
        const elapsed = status?.elapsed ?? null;
        const extra = status?.extra ?? null;
        const short = status?.short ?? '';
        let period: string | null = null;
        if (short === 'HT') period = 'HT';
        else if (short === '1H' || short === '2H') period = short;
        else if (short === 'ET') period = 'ET';
        else if (short === 'P') period = 'P';
        else if (short) period = short;
        return [{
          fixtureId: String(fixtureId),
          homeTeamName: home.name,
          awayTeamName: away.name,
          homeTeamProviderId: home.id == null ? null : String(home.id),
          awayTeamProviderId: away.id == null ? null : String(away.id),
          status: status?.long ?? short ?? 'Unknown',
          statusShort: short,
          minute: elapsed,
          extraMinute: extra,
          period,
          homeScore: goals?.home ?? null,
          awayScore: goals?.away ?? null,
          firstHalfHomeScore: null,
          firstHalfAwayScore: null,
          observedAt,
        }];
      }),
    };
  }

  async fetchEvents(fixtureId: string): Promise<ProviderResult<LiveEvent[]>> {
    const result = await this.request<ApiResponse<ApiEvent[]>>(`/fixtures/events?fixture=${encodeURIComponent(fixtureId)}`);
    if (!result.ok || !result.value) {
      return {
        ok: false,
        value: null,
        errorCode: result.errorCode,
        errorMessage: result.errorMessage,
        retryable: result.retryable,
      };
    }
    const observedAt = nowIso();
    return {
      ok: true,
      value: (result.value.response ?? []).map((event, index) => ({
        providerEventId: `${fixtureId}:${index}:${event.time?.elapsed ?? ''}:${event.time?.extra ?? ''}:${event.type ?? ''}:${event.team?.id ?? ''}:${event.player?.id ?? ''}:${event.detail ?? ''}`,
        type: event.type ?? 'Unknown',
        minute: event.time?.elapsed ?? null,
        extraMinute: event.time?.extra ?? null,
        period:
          event.time?.elapsed == null
            ? null
            : event.time.elapsed <= 45
              ? '1H'
              : '2H',
        teamProviderId: event.team?.id == null ? null : String(event.team.id),
        teamName: event.team?.name ?? null,
        playerName: event.player?.name ?? null,
        assistName: event.assist?.name ?? null,
        detail: event.detail ?? null,
        comments: event.comments ?? null,
        observedAt,
      })),
    };
  }

  async fetchStatistics(fixtureId: string): Promise<ProviderResult<LiveStatistics>> {
    const result = await this.request<ApiResponse<ApiStatistics[]>>(`/fixtures/statistics?fixture=${encodeURIComponent(fixtureId)}`);
    if (!result.ok || !result.value) {
      return {
        ok: false,
        value: null,
        errorCode: result.errorCode,
        errorMessage: result.errorMessage,
        retryable: result.retryable,
      };
    }
    return {
      ok: true,
      value: {
        fixtureId,
        teams: (result.value.response ?? []).map((team) => ({
          providerTeamId: team.team?.id == null ? null : String(team.team.id),
          teamName: team.team?.name ?? null,
          statistics: (team.statistics ?? []).map((stat) => ({
            type: stat.type ?? 'Unknown',
            value: stat.value ?? null,
          })),
        })),
        observedAt: nowIso(),
      },
    };
  }

  private async request<T>(path: string): Promise<ProviderResult<T>> {
    if (!this.configured) {
      return {
        ok: false,
        value: null,
        errorCode: 'NOT_CONFIGURED',
        errorMessage: 'API-Football requires API_FOOTBALL_KEY',
        retryable: false,
      };
    }
    try {
      const response = await fetch(`${BASE_URL}${path}`, {
        method: 'GET',
        headers: {
          accept: 'application/json',
          'x-apisports-key': this.apiKey,
        },
        cache: 'no-store',
      });
      const text = await response.text();
      let body: T | null = null;
      try {
        body = JSON.parse(text) as T;
      } catch {
        body = null;
      }
      if (!response.ok || !body) {
        return {
          ok: false,
          value: null,
          errorCode: `HTTP_${response.status}`,
          errorMessage: text.slice(0, 500) || `HTTP ${response.status}`,
          retryable: response.status >= 500 || response.status === 429,
        };
      }
      const apiErrors = errorText((body as ApiResponse<unknown>).errors);
      if (apiErrors) {
        return {
          ok: false,
          value: null,
          errorCode: 'API_ERROR',
          errorMessage: apiErrors,
          retryable: false,
        };
      }
      return { ok: true, value: body };
    } catch (error) {
      return {
        ok: false,
        value: null,
        errorCode: 'NETWORK_ERROR',
        errorMessage: error instanceof Error ? error.message : String(error),
        retryable: true,
      };
    }
  }
}
