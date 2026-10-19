/**
 * Server-side bridge from Bet365 FI preview prices to the canonical Events API
 * odds ingested by the betting worker. A preview never becomes an authorized
 * wager merely because it has a numeric price. Only an exact provider identity,
 * settlement-supported football 1X2 outcome, fresh DB price and identical
 * bookmaker price can produce a bet slip identity.
 */
import type { Bet365PreviewMarket } from '@/providers/betsapi-bet365-preview';
import { createServices } from '@/server/services/container';
import { oddsFromDecimalString } from '@/domain/odds';

export interface CanonicalWager {
  matchId: string;
  marketId: string;
  selectionId: string;
  oddsScaled: string;
  oddsVersion: number;
}

export type WagerableMarket = Omit<Bet365PreviewMarket, 'selections'> & {
  selections: Array<Bet365PreviewMarket['selections'][number] & { wager?: CanonicalWager }>;
};

export const wagerFeedEnabled = (): boolean =>
  process.env.BETSAPI_WAGER_INGEST_ENABLED === 'true' &&
  process.env.BETSAPI_TRIAL_ENABLED === 'true' &&
  process.env.SPORTS_PROVIDER === 'betsapi' &&
  Boolean(process.env.BETSAPI_TRIAL_TOKEN?.trim());

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase('en').replace(/[\s\-_.]+/g, ' ');
}

/** Conservative interpretation: never map a player, period or corner offer to full-time 1X2. */
export function fullTimeOutcome(
  marketTitle: string, label: string, homeName: string, awayName: string,
): 'HOME' | 'DRAW' | 'AWAY' | null {
  if (!/^(full ?time result|match result|ft result|1x2|match winner|full time result)$/i.test(marketTitle.trim())) {
    return null;
  }
  const value = normalized(label);
  const home = normalized(homeName);
  const away = normalized(awayName);
  if (!value || !home || !away || home === away) return null;
  if (value === 'x' || value === 'draw' || value === 'tie') return 'DRAW';
  if (value === '1' || value === 'home' || value === home) return 'HOME';
  if (value === '2' || value === 'away' || value === away) return 'AWAY';
  return null;
}

export function pricesAgree(previewDecimal: string, databaseScaled: string): boolean {
  try {
    return oddsFromDecimalString(previewDecimal).toString() === databaseScaled &&
      BigInt(databaseScaled) >= 10100n;
  } catch {
    return false;
  }
}

interface CanonicalRow extends CanonicalWager {
  code: string;
  matchStatus: string;
  homeName: string;
  awayName: string;
}

export async function attachCanonicalWagers(
  markets: Bet365PreviewMarket[],
  input: {
    fi: string;
    eventId: string | null | undefined;
    sportId: number;
    mode: 'live' | 'upcoming';
    home: string;
    away: string;
  },
): Promise<WagerableMarket[]> {
  // An FI and an Events API event_id are distinct. The eventId MUST come from
  // the server-observed Bet365 our_event_id bridge, not a client-supplied field.
  if (!wagerFeedEnabled() || input.sportId !== 1 ||
      !/^\d{1,16}$/.test(input.fi) ||
      !/^\d{1,16}$/.test(input.eventId ?? '') ||
      !input.home.trim() || !input.away.trim() || input.home === input.away) {
    return markets;
  }
  let canonical: CanonicalRow[];
  try {
    canonical = await createServices().db.query<CanonicalRow>(
      [
        'select m.id::text as "matchId", mk.id::text as "marketId",',
        's.id::text as "selectionId", s.code, s.odds_scaled::text as "oddsScaled",',
        's.odds_version as "oddsVersion", m.status::text as "matchStatus",',
        'ht.name as "homeName", at.name as "awayName"',
        'from nova.matches m',
        'join nova.teams ht on ht.id = m.home_team_id',
        'join nova.teams at on at.id = m.away_team_id',
        'join nova.markets mk on mk.match_id = m.id',
        'join nova.selections s on s.market_id = mk.id and s.match_id = m.id',
        'where m.provider = $1 and m.provider_id = $2',
        "and mk.provider = 'betsapi' and s.provider = 'betsapi'",
        "and mk.key = 'h2h' and mk.type = '1X2'",
        "and mk.status::text = 'open' and s.status::text = 'open'",
        'and mk.is_live = $3 and s.is_live = $3',
        "and m.status::text = $4",
        'and ($3::boolean or m.scheduled_at > now())',
        "and s.odds_updated_at > now() - case when $3::boolean then interval '45 seconds' else interval '300 seconds' end",
        'and s.odds_version > 0 and s.odds_scaled >= 10100',
        'order by s.odds_updated_at desc',
      ].join(' '),
      ['betsapi', '1:' + input.eventId, input.mode === 'live',
        input.mode === 'live' ? 'live' : 'scheduled'],
    );
  } catch {
    // Never mark a selection wagerable if the wallet-authoritative DB is down.
    return markets;
  }
  const byCode = new Map<string, CanonicalRow>();
  for (const item of canonical) {
    // The upstream FI link alone does not prove that the Events and Bet365
    // feeds use the same home/away orientation. Reject mismatched names.
    if (normalized(item.homeName) !== normalized(input.home) ||
        normalized(item.awayName) !== normalized(input.away)) continue;
    if (['HOME', 'DRAW', 'AWAY'].includes(item.code) && !byCode.has(item.code)) {
      byCode.set(item.code, item);
    }
  }
  return markets.map(market => ({
    ...market,
    selections: market.selections.map(selection => {
      const code = fullTimeOutcome(market.title, selection.label, input.home, input.away);
      const row = code ? byCode.get(code) : null;
      if (!row || !pricesAgree(selection.decimal, row.oddsScaled)) return selection;
      return {
        ...selection,
        wager: {
          matchId: row.matchId, marketId: row.marketId,
          selectionId: row.selectionId, oddsScaled: row.oddsScaled,
          oddsVersion: row.oddsVersion,
        },
      };
    }),
  }));
}
