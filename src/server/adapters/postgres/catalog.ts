import { rankUpcomingMatches } from '@/lib/upcoming-ranking';
import { LIVE_MATCH_STATUSES as LIVE_STATUSES, isLiveMatchStatus } from '@/lib/match-state';
import type { Db, ActorContext, SqlParam } from '@/lib/ports/db';
import type { CatalogRepository, MatchFilter, SelectionSnapshot } from '@/lib/ports/repositories';
import type {
  Country, League, Market, MarketSummary, Match, MatchParticipant, MatchResultSnapshot, Paginated, Selection, Sport, SportKey, UUID,
} from '@/lib/types';
import { pgArray, type Row, toBig, toBool, toIso, toIsoOrNull, toNum, toNumOrNull, toStr, toStrOrNull } from '@/server/db/rows';

// Never expose discontinued external fixtures in live discovery.
// Historical rows and financial settlement records remain unchanged.
const ODDS_ONLY_MATCH_SQL = "m.provider = 'the_odds_api'";

const SPORT_KEYS: SportKey[] = [
  'football',
  'basketball',
  'tennis',
  'volleyball',
  'handball',
  'hockey',
  'baseball',
  'american-football',
  'cricket',
  'mma',
  'boxing',
  'table-tennis',
  'esports',
  'other',
];

const SPORT_ALIASES: Record<string, SportKey> = {
  'ice-hockey': 'hockey',
};

const asSportKey = (value: unknown): SportKey => {
  const slug = toStr(value, 'other').toLowerCase();
  return SPORT_ALIASES[slug] ?? (
    SPORT_KEYS.includes(slug as SportKey) ? slug as SportKey : 'other'
  );
};

/** Only these matches may be shown as "live" and only these can be bet in-play. */
const BETTABLE_STATUSES = ['scheduled', 'live', 'in_play', 'paused', 'break', 'halftime', 'extra_time', 'penalties'];

const MATCH_SELECT = `
  m.id, m.status, m.scheduled_at, m.started_at, m.finished_at, m.minute, m.period,
  m.minute as display_minute, m.period as display_period,
  m.home_score, m.away_score, m.has_live_stream, m.provider, m.updated_at, m.league_id, m.sport_id,
  s.slug as sport_slug, l.name as league_name, l.name_fa as league_name_fa, l.logo as league_logo, c.code as country_code,
  ht.name as home_name, ht.name_fa as home_name_fa, ht.short_name as home_short, ht.logo as home_logo,
  at.name as away_name, at.name_fa as away_name_fa, at.short_name as away_short, at.logo as away_logo,
  (select count(*) from nova.markets mk where mk.match_id = m.id and mk.status <> 'closed') as markets_count,
  r.status::text as result_status, r.home_half_score, r.away_half_score`;

const MATCH_FROM = `
  from nova.matches m
  join nova.sports s on s.id = m.sport_id
  left join nova.leagues l on l.id = m.league_id
  left join nova.countries c on c.id = l.country_id
  left join nova.teams ht on ht.id = m.home_team_id
  left join nova.teams at on at.id = m.away_team_id
  left join lateral (select * from nova.match_results mr where mr.match_id = m.id order by mr.revision desc limit 1) r on true
 `;

function mapMatch(row: Row, topMarkets: MarketSummary[] = []): Match {
  const status = toStr(row.status, 'scheduled');
  const participants: MatchParticipant[] = [];
  if (row.home_name || row.home_team_id) {
    participants.push({
      teamId: toStr(row.home_team_id), role: 'HOME', name: toStr(row.home_name, 'TBD'),
      shortName: toStrOrNull(row.home_short), logoUrl: toStrOrNull(row.home_logo),
    });
  }
  if (row.away_name || row.away_team_id) {
    participants.push({
      teamId: toStr(row.away_team_id), role: 'AWAY', name: toStr(row.away_name, 'TBD'),
      shortName: toStrOrNull(row.away_short), logoUrl: toStrOrNull(row.away_logo),
    });
  }
  return {
    id: toStr(row.id), sportKey: asSportKey(row.sport_slug), leagueId: toStrOrNull(row.league_id),
    leagueName: toStrOrNull(row.league_name_fa) ?? toStrOrNull(row.league_name), leagueLogoUrl: toStrOrNull(row.league_logo), countryCode: toStrOrNull(row.country_code),
    status: status as Match['status'], scheduledAt: toIso(row.scheduled_at), startedAt: toIsoOrNull(row.started_at),
    finishedAt: toIsoOrNull(row.finished_at), minute: toNumOrNull(row.display_minute ?? row.minute), period: toStrOrNull(row.display_period ?? row.period),
    homeScore: toNumOrNull(row.home_score), awayScore: toNumOrNull(row.away_score),
    homeHalfScore: toNumOrNull(row.home_half_score), awayHalfScore: toNumOrNull(row.away_half_score),
    participants, provider: toStrOrNull(row.provider),
    isLive: LIVE_STATUSES.includes(status),
    isBettingAvailable: BETTABLE_STATUSES.includes(status) && !['settled', 'cancelled', 'abandoned'].includes(status),
    hasLiveStream: toBool(row.has_live_stream), updatedAt: toIso(row.updated_at),
    marketsCount: toNumOrNull(row.markets_count) ?? undefined,
    topMarkets: topMarkets.length > 0 ? topMarkets : undefined,
  };
}

function mapSelection(row: Row): Selection {
  const current = toBig(row.odds_scaled);
  const previous = row.previous_odds_scaled === null || row.previous_odds_scaled === undefined ? null : toBig(row.previous_odds_scaled);
  return {
    id: toStr(row.id), marketId: toStr(row.market_id), code: toStr(row.code), nameEn: toStr(row.name), nameFa: toStr(row.name_fa, toStr(row.name)),
    shortName: null, participantType: toStr(row.participant_type, 'NEUTRAL') as Selection['participantType'],
    line: row.line === null || row.line === undefined ? null : String(row.line),
    oddsScaled: current, previousOddsScaled: previous, oddsVersion: toNum(row.odds_version, 1),
    status: toStr(row.status, 'open') as Selection['status'],
    updatedAt: toIso(row.odds_updated_at ?? row.updated_at),
    movement: previous === null || previous === current ? 'STABLE' : current > previous ? 'UP' : 'DOWN',
  };
}

function mapMarket(row: Row, selections: Selection[]): Market {
  const status = toStr(row.status, 'open');
  return {
    id: toStr(row.id), matchId: toStr(row.match_id), key: toStr(row.key), type: toStr(row.type, toStr(row.key)),
    nameEn: toStr(row.name, toStr(row.key)), nameFa: toStr(row.name_fa, toStr(row.name, toStr(row.key))),
    status: status as Market['status'],
    selections, specifier: toStrOrNull(row.specifier), isLive: toBool(row.is_live),
    sortOrder: toNum(row.display_order), margin: null, version: toNum(row.version, 1),
    openedAt: toIsoOrNull(row.created_at), closedAt: null, settledAt: toIsoOrNull(row.settled_at),
    settledBy: null, maxStakeMinor: null, updatedAt: toIso(row.updated_at),
  };
}

export class PostgresCatalogRepository implements CatalogRepository {
  constructor(readonly db: Db) {}

  async listSports(_c: ActorContext, filter?: { from?: string; to?: string }): Promise<(Sport & { matchCount?: number })[]> {
    const rows = await this.db.query<Row>(
      `select
         s.*,
         count(m.id)::int as match_count
       from nova.sports s
       left join nova.matches m
         on m.sport_id = s.id
        and m.status = 'scheduled'
        and ($1::timestamptz is null or m.scheduled_at >= $1)
        and ($2::timestamptz is null or m.scheduled_at <= $2)
       where s.is_active
       group by s.id
       order by s.display_order, s.slug`,
      [filter?.from ?? null, filter?.to ?? null],
    );
    return rows.map((r) => ({
      key: asSportKey(r.slug),
      nameEn: toStr(r.name_en),
      nameFa: toStr(r.name_fa, toStr(r.name_en)),
      icon: toStr(r.icon, 'ball'),
      sortOrder: toNum(r.display_order),
      isActive: toBool(r.is_active, true),
      matchCount: toNum(r.match_count),
    }));
  }

  async listCountries(_c: ActorContext): Promise<Country[]> {
    const rows = await this.db.query<Row>(`select code, name_en, name_fa, flag_emoji from nova.countries where not is_blocked order by name_en`);
    return rows.map((r) => ({
      code: toStr(r.code), nameEn: toStr(r.name_en), nameFa: toStr(r.name_fa, toStr(r.name_en)), flag: toStrOrNull(r.flag_emoji),
    }));
  }

  async listLeagues(_c: ActorContext, filter: { sportKey?: string; countryCode?: string; search?: string; leagueId?: UUID; limit?: number }): Promise<League[]> {
    const rows = await this.db.query<Row>(
      `select l.*, s.slug as sport_slug, c.code as country_code,
              (
                select count(*)
                  from nova.matches mc
                 where mc.league_id = l.id
                   and mc.status::text = 'scheduled'
                   and mc.scheduled_at >= now()
              ) as match_count
         from nova.leagues l join nova.sports s on s.id = l.sport_id
         left join nova.countries c on c.id = l.country_id
        where l.is_active
          and ($1::text is null or s.slug = lower($1))
          and ($2::text is null or c.code = upper($2))
          and ($3::text is null or l.name ilike '%' || $3 || '%' or l.name_fa ilike '%' || $3 || '%')
          and ($4::uuid is null or l.id = $4)
        order by l.tier nulls last, l.name limit $5`,
      [
        filter.sportKey ?? null,
        filter.countryCode ?? null,
        filter.search ?? null,
        filter.leagueId ?? null,
        Math.min(filter.limit ?? 200, 500),
      ],
    );
    return rows.map((r) => ({
      id: toStr(r.id), sportKey: asSportKey(r.sport_slug), countryCode: toStrOrNull(r.country_code),
      nameEn: toStr(r.name), nameFa: toStr(r.name_fa, toStr(r.name)), slug: toStr(r.slug),
      tier: toNumOrNull(r.tier), isActive: toBool(r.is_active, true), priority: 0,
      logoUrl: toStrOrNull(r.logo), matchCount: toNum(r.match_count),
    }));
  }

  async listMatches(_c: ActorContext, filter: MatchFilter): Promise<Paginated<Match>> {
    const page = Math.max(1, filter.page ?? 1);
    const pageSize = Math.min(500, Math.max(1, filter.pageSize ?? 20));
    const base = [
      filter.sportKey ?? null, filter.leagueId ?? null, filter.search ?? null, pgArray(LIVE_STATUSES),
      filter.live === undefined ? null : filter.live,
      filter.from ?? null, filter.to ?? null,
      filter.status?.length ? pgArray(filter.status) : null,
    ];
    const conditions = `${ODDS_ONLY_MATCH_SQL} and ($1::text is null or s.slug = lower($1))
        and ($2::uuid is null or m.league_id = $2)
        and ($3::text is null or ht.name ilike '%' || $3 || '%' or at.name ilike '%' || $3 || '%'
             or l.name ilike '%' || $3 || '%' or l.name_fa ilike '%' || $3 || '%')
        and ($5::boolean is null or (m.status::text = any($4::text[])) = $5)
        and ($6::timestamptz is null or m.scheduled_at >= $6)
        and ($7::timestamptz is null or m.scheduled_at <= $7)
        and ($8::text[] is null or m.status::text = any($8::text[]))`;

    const includeTotal = filter.includeTotal !== false;
    const fetchLimit = includeTotal ? pageSize : pageSize + 1;

    const rows = await this.db.query<Row>(
      `select ${MATCH_SELECT} ${MATCH_FROM} where ${conditions}
        order by m.scheduled_at asc limit $9 offset $10`,
      [...base, fetchLimit, (page - 1) * pageSize],
    );

    const hasExtra = !includeTotal && rows.length > pageSize;
    const pageRows = includeTotal ? rows : rows.slice(0, pageSize);
    const items = await this.attachTopMarkets(pageRows);

    if (!includeTotal) {
      return {
        items,
        total: items.length,
        page,
        pageSize,
        hasMore: hasExtra,
      };
    }

    const countRow = await this.db.queryOne<Row>(
      `select count(*) as total ${MATCH_FROM} where ${conditions}`, base,
    );
    const total = toNum(countRow?.total);

    return {
      items,
      total,
      page,
      pageSize,
      hasMore: page * pageSize < total,
    };
  }

  async getMatch(_c: ActorContext, matchId: UUID): Promise<Match | null> {
    const row = await this.db.queryOne<Row>(`select ${MATCH_SELECT} ${MATCH_FROM} where m.id = $1 and ${ODDS_ONLY_MATCH_SQL}`, [matchId]);
    return row ? mapMatch(row) : null;
  }

  async getMatchBySlugOrId(_c: ActorContext, key: string): Promise<Match | null> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key);
    const row = await this.db.queryOne<Row>(
      isUuid ? `select ${MATCH_SELECT} ${MATCH_FROM} where m.id = $1 and ${ODDS_ONLY_MATCH_SQL}`
             : `select ${MATCH_SELECT} ${MATCH_FROM} where m.provider_id = $1 and ${ODDS_ONLY_MATCH_SQL} limit 1`,
      [key],
    );
    return row ? mapMatch(row) : null;
  }

  async listMarkets(_c: ActorContext, matchId: UUID, filter?: { isLive?: boolean; includeSuspended?: boolean }): Promise<Market[]> {
    const rows = await this.db.query<Row>(
      `select * from nova.markets
        where match_id = $1
          and ($2::boolean is null or is_live = $2)
          and status <> 'manual_review'
          and ($3::boolean or status <> 'closed')
          and ($3::boolean or status <> 'suspended')
        order by is_live desc, display_order, key`,
      [matchId, filter?.isLive ?? null, filter?.includeSuspended ?? false],
    );
    if (rows.length === 0) return [];
    const selections = await this.db.query<Row>(
      `select sel.*
         from nova.selections sel
         join nova.markets mk on mk.id = sel.market_id
         join nova.matches fixture on fixture.id = mk.match_id
        where sel.market_id = any($1::uuid[])
          and sel.odds_updated_at is not null
          and sel.odds_updated_at >= now() - case
            when coalesce(mk.is_live, false) or fixture.status::text = any($2::text[])
              then interval '45 seconds'
            else interval '300 seconds'
          end
          -- A newly re-ingested cached bookmaker quote is not a fresh live price.
          and (
            sel.provider not in ('the_odds_api', '5dollarfootballapi')
            or not (coalesce(mk.is_live, false) or fixture.status::text = any($2::text[]))
            or (sel.provider_timestamp between now() - interval '45 seconds' and now() + interval '15 seconds')
          )
        order by sel.participant_type, sel.code`,
      [pgArray(rows.map((r) => toStr(r.id))), pgArray(LIVE_STATUSES)],
    );
    const byMarket = new Map<string, Selection[]>();
    for (const row of selections) {
      const marketId = toStr(row.market_id);
      byMarket.set(marketId, [...(byMarket.get(marketId) ?? []), mapSelection(row)]);
    }
    return rows.map((r) => mapMarket(r, byMarket.get(toStr(r.id)) ?? []));
  }

  async getMarket(_c: ActorContext, marketId: UUID): Promise<Market | null> {
    const row = await this.db.queryOne<Row>(`select * from nova.markets where id = $1`, [marketId]);
    if (!row) return null;
    const selections = await this.db.query<Row>(
      `select * from nova.selections where market_id = $1 order by participant_type, code`, [marketId],
    );
    return mapMarket(row, selections.map(mapSelection));
  }

  async getSelectionsForPlacement(matchId: UUID, selectionIds: UUID[]): Promise<SelectionSnapshot[]> {
    // Authoritative odds read used by pricing: every field comes from the database,
    // never from the request. Suspended/closed state is returned so the caller can refuse.
    const rows = await this.db.query<Row>(
      `select sel.id, sel.market_id, sel.match_id, sel.odds_scaled, sel.odds_version, sel.odds_updated_at, sel.line,
              sel.status as selection_status, sel.name as selection_name,
              mk.key as market_key, mk.name as market_name, mk.name_fa as market_name_fa,
              mk.status as market_status, mk.is_live,
              m.status as match_status, m.scheduled_at,
              coalesce(ht.name, 'TBD') as home_name, coalesce(at.name, 'TBD') as away_name
         from nova.selections sel
         join nova.markets mk on mk.id = sel.market_id
         join nova.matches m on m.id = sel.match_id
         left join nova.teams ht on ht.id = m.home_team_id
         left join nova.teams at on at.id = m.away_team_id
        where sel.match_id = $1 and sel.id = any($2::uuid[])`,
      [matchId, pgArray(selectionIds)],
    );
    return rows.map((r) => ({
      selectionId: toStr(r.id), marketId: toStr(r.market_id), matchId: toStr(r.match_id),
      marketKey: toStr(r.market_key), marketStatus: toStr(r.market_status),
      selectionStatus: toStr(r.selection_status), oddsScaled: toBig(r.odds_scaled),
      oddsVersion: toNum(r.odds_version, 1),
      oddsUpdatedAt: r.odds_updated_at == null ? null : toIso(r.odds_updated_at),
      line: r.line === null || r.line === undefined ? null : String(r.line),
      matchStatus: toStr(r.match_status), scheduledAt: toIso(r.scheduled_at),
      isLive: toBool(r.is_live) || isLiveMatchStatus(toStr(r.match_status)), maxStakeMinor: null,
      selectionName: toStr(r.selection_name),
      marketName: toStr(r.market_name_fa) || toStr(r.market_name, toStr(r.market_key)),
      matchLabel: `${toStr(r.home_name)} - ${toStr(r.away_name)}`,
    }));
  }

  async listMatchEvents(matchId: UUID): Promise<import('@/lib/types').MatchEventView[]> {
    const rows = await this.db.query<Row>(
      `select e.id, e.provider_event_id, e.type, e.minute, e.period, e.team_id,
              e.player_name, e.detail, e.occurred_at, t.name as team_name
         from nova.match_events e
         left join nova.teams t on t.id = e.team_id
        where e.match_id = $1
          and e.provider_event_id like '5dollar:%'
        order by e.minute asc nulls last, e.occurred_at asc, e.created_at asc`,
      [matchId],
    );
    return rows.map((r) => ({
      id: toStr(r.id),
      providerEventId: toStr(r.provider_event_id),
      type: toStr(r.type, 'event'),
      minute: toNumOrNull(r.minute),
      period: toStrOrNull(r.period),
      teamId: toStrOrNull(r.team_id) || null,
      teamName: toStrOrNull(r.team_name),
      playerName: toStrOrNull(r.player_name),
      detail: toStrOrNull(r.detail),
      occurredAt: toIso(r.occurred_at),
    }));
  }

  async getMatchStats(matchId: UUID): Promise<import('@/lib/types').MatchStatsView | null> {
    const row = await this.db.queryOne<Row>(
      `select provider, updated_at, payload
         from nova.match_stats
        where match_id = $1
        order by updated_at desc
        limit 1`,
      [matchId],
    );
    if (!row) return null;
    return {
      provider: toStrOrNull(row.provider),
      updatedAt: toIso(row.updated_at),
      payload: (row.payload ?? {}) as Record<string, unknown>,
    };
  }

  async getResult(matchId: UUID): Promise<MatchResultSnapshot | null> {
    const row = await this.db.queryOne<Row>(
      `select * from nova.match_results where match_id = $1 order by revision desc limit 1`, [matchId],
    );
    if (!row) return null;
    return {
      matchId: toStr(row.match_id), status: toStr(row.status, 'unknown') as MatchResultSnapshot['status'],
      homeScore: toNumOrNull(row.home_score), awayScore: toNumOrNull(row.away_score),
      homeHalfScore: toNumOrNull(row.home_half_score), awayHalfScore: toNumOrNull(row.away_half_score),
      homeCorners: toNumOrNull(row.home_corners), awayCorners: toNumOrNull(row.away_corners),
      homeCards: toNumOrNull(row.home_cards), awayCards: toNumOrNull(row.away_cards),
      extraTime: toBool(row.extra_time), penalties: toBool(row.penalties),
      penaltyHome: toNumOrNull(row.penalty_home), penaltyAway: toNumOrNull(row.penalty_away),
      provider: toStrOrNull(row.provider), providerResultId: toStrOrNull(row.provider_result_id),
      authoritative: toBool(row.authoritative, false),
      revision: toNum(row.revision, 1), observedAt: toIso(row.observed_at),
    };
  }

  async listLiveMatches(_c: ActorContext, limit: number): Promise<Match[]> {
    const rows = await this.db.query<Row>(
      `select ${MATCH_SELECT} ${MATCH_FROM} where m.status::text = any($1::text[]) and ${ODDS_ONLY_MATCH_SQL}
        order by m.minute desc nulls last, m.scheduled_at asc limit $2`,
      [pgArray(LIVE_STATUSES), Math.min(limit, 100)],
    );
    return this.attachTopMarkets(rows);
  }
  async listLiveSportCounts(_c: ActorContext): Promise<Record<string, number>> {
    const rows = await this.db.query<Row>(
      `select s.slug as sport_slug, count(*)::int as live_count
         from nova.matches m
         join nova.sports s on s.id = m.sport_id
        where m.status::text = any($1::text[]) and ${ODDS_ONLY_MATCH_SQL}
        group by s.slug`,
      [pgArray(LIVE_STATUSES)],
    );
    const counts: Record<string, number> = {};
    for (const row of rows) {
      const key = asSportKey(row.sport_slug);
      counts[key] = (counts[key] ?? 0) + toNum(row.live_count);
    }
    return counts;
  }

  async listUpcomingMatches(_c: ActorContext, hours: number, limit: number): Promise<Match[]> {
    const rows = await this.db.query<Row>(
      `select ${MATCH_SELECT} ${MATCH_FROM}
        where ${ODDS_ONLY_MATCH_SQL} and m.status = 'scheduled' and m.scheduled_at between now() and now() + ($1::int * interval '1 hour')
        order by m.scheduled_at asc limit $2`,
      [hours, Math.min(Math.max(limit * 20, 200), 500)],
    );
    const matches = await this.attachTopMarkets(rows);
    return rankUpcomingMatches(matches).slice(0, Math.min(limit, 100));
  }

  async search(_c: ActorContext, query: string, limit: number): Promise<Match[]> {
    const rows = await this.db.query<Row>(
      `select ${MATCH_SELECT} ${MATCH_FROM}
        where ${ODDS_ONLY_MATCH_SQL} and (ht.name ilike '%' || $1 || '%' or at.name ilike '%' || $1 || '%'
               or ht.name_fa ilike '%' || $1 || '%' or at.name_fa ilike '%' || $1 || '%'
               or l.name ilike '%' || $1 || '%' or l.name_fa ilike '%' || $1 || '%')
          and m.status::text not in ('settled','cancelled','abandoned')
        order by (m.status::text = any($2::text[])) desc, m.scheduled_at asc limit $3`,
      [query, pgArray(LIVE_STATUSES), Math.min(limit, 30)],
    );
    return this.attachTopMarkets(rows);
  }

  private async attachTopMarkets(rows: Row[]): Promise<Match[]> {
    if (rows.length === 0) return [];

    const matchIds = rows.map((r) => toStr(r.id));
    const marketSelections = await this.db.query<Row>(
      `select
          mk.*,
          sel.id as selection_id,
          sel.market_id as selection_market_id,
          sel.code as selection_code,
          sel.name as selection_name,
          sel.name_fa as selection_name_fa,
          sel.participant_type as selection_participant_type,
          sel.line as selection_line,
          sel.odds_scaled as selection_odds_scaled,
          sel.previous_odds_scaled as selection_previous_odds_scaled,
          sel.odds_version as selection_odds_version,
          sel.status as selection_status,
          sel.odds_updated_at as selection_odds_updated_at,
          sel.updated_at as selection_updated_at
        from (
          select
            m.*,
            case
              when coalesce(m.is_live, false) or fixture.status::text = any($2::text[])
                then interval '45 seconds'
              else interval '300 seconds'
            end as maximum_quote_age,
            (coalesce(m.is_live, false) or fixture.status::text = any($2::text[])) as in_play_quote,
            row_number() over (
              partition by m.match_id
              order by
                -- Rank genuinely bookable markets first, not stale empty 1X2 blocks.
                case when exists (
                  select 1 from nova.selections candidate
                   where candidate.market_id = m.id
                     and candidate.status = 'open'
                     and candidate.odds_updated_at >= now() - case
                       when coalesce(m.is_live, false) or fixture.status::text = any($2::text[])
                         then interval '45 seconds'
                       else interval '300 seconds'
                     end
                     and (
                       candidate.provider not in ('the_odds_api', '5dollarfootballapi')
                       or not (coalesce(m.is_live, false) or fixture.status::text = any($2::text[]))
                       or candidate.provider_timestamp between now() - interval '45 seconds' and now() + interval '15 seconds'
                     )
                ) then 0 else 1 end,
                m.is_live desc, m.display_order, m.key
            ) as market_rank
          from nova.markets m
          join nova.matches fixture on fixture.id = m.match_id
          where m.match_id = any($1::uuid[])
            and m.status = 'open'
        ) mk
        left join nova.selections sel
          on sel.market_id = mk.id
         and sel.status = 'open'
         and sel.odds_updated_at is not null
         and sel.odds_updated_at >= now() - mk.maximum_quote_age
         and (
           sel.provider not in ('the_odds_api', '5dollarfootballapi')
           or not mk.in_play_quote
           or sel.provider_timestamp between now() - interval '45 seconds' and now() + interval '15 seconds'
         )
        where mk.market_rank <= 3
        order by mk.match_id, mk.market_rank, sel.participant_type, sel.code`,
      [pgArray(matchIds), pgArray(LIVE_STATUSES)],
    );

    const marketsByMatch = new Map<string, MarketSummary[]>();
    const marketById = new Map<string, MarketSummary>();

    for (const row of marketSelections) {
      const matchId = toStr(row.match_id);
      const marketId = toStr(row.id);

      let market = marketById.get(marketId);
      if (!market) {
        market = {
          id: marketId,
          key: toStr(row.key),
          nameEn: toStr(row.name, toStr(row.key)),
          nameFa: toStr(row.name_fa, toStr(row.name, toStr(row.key))),
          status: toStr(row.status, 'open') as MarketSummary['status'],
          selections: [],
        };
        marketById.set(marketId, market);
        const list = marketsByMatch.get(matchId) ?? [];
        list.push(market);
        marketsByMatch.set(matchId, list);
      }

      if (row.selection_id !== null && row.selection_id !== undefined) {
        market.selections.push({
          id: toStr(row.selection_id),
          marketId: toStr(row.selection_market_id, marketId),
          code: toStr(row.selection_code),
          nameEn: toStr(row.selection_name, toStr(row.selection_code)),
          nameFa: toStr(row.selection_name_fa, toStr(row.selection_name, toStr(row.selection_code))),
          shortName: null,
          participantType: toStr(row.selection_participant_type, 'NEUTRAL') as Selection['participantType'],
          line: row.selection_line === null || row.selection_line === undefined ? null : String(row.selection_line),
          oddsScaled: toBig(row.selection_odds_scaled),
          previousOddsScaled: row.selection_previous_odds_scaled === null || row.selection_previous_odds_scaled === undefined
            ? null
            : toBig(row.selection_previous_odds_scaled),
          oddsVersion: toNum(row.selection_odds_version, 1),
          status: toStr(row.selection_status, 'open') as Selection['status'],
          updatedAt: toIso(row.selection_odds_updated_at ?? row.selection_updated_at),
          movement: row.selection_previous_odds_scaled === null || row.selection_previous_odds_scaled === undefined
            || toBig(row.selection_previous_odds_scaled) === toBig(row.selection_odds_scaled)
            ? 'STABLE'
            : toBig(row.selection_odds_scaled) > toBig(row.selection_previous_odds_scaled)
              ? 'UP'
              : 'DOWN',
        });
      }
    }

    return rows.map((r) => mapMatch(r, (marketsByMatch.get(toStr(r.id)) ?? []).filter((market) => market.selections.length > 0)));
  }
}
