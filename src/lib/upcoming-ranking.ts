import type { Match } from '@/lib/types';

const LEAGUE_PRIORITY: Array<[RegExp, number]> = [
  [/world cup|fifa world cup/i, 100],
  [/euro( |$)|uefa euro/i, 98],
  [/champions league/i, 97],
  [/premier league/i, 96],
  [/la liga( |$)/i, 95],
  [/serie a/i, 95],
  [/bundesliga/i, 95],
  [/ligue 1/i, 94],
  [/europa league/i, 93],
  [/conference league/i, 91],
  [/nations league/i, 90],
  [/copa america/i, 96],
  [/copa libertadores/i, 93],
  [/mls/i, 84],
  [/liga mx/i, 83],
  [/eredivisie/i, 88],
  [/primeira liga/i, 88],
  [/super lig/i, 84],
  [/brasileiro|série a/i, 84],
  [/euroleague/i, 94],
  [/wnba/i, 90],
  [/nba/i, 96],
  [/ncaa|ncaaf/i, 82],
  [/nfl/i, 97],
  [/cfl/i, 82],
  [/mlb/i, 94],
  [/npb/i, 88],
  [/kbo/i, 88],
  [/wta/i, 87],
  [/atp/i, 90],
  [/grand slam|us open|australian open|french open|wimbledon/i, 98],
  [/shl|liiga|nhl|khl/i, 88],
  [/ufc|mma/i, 86],
  [/boxing/i, 82],
];

const SPORT_PRIORITY: Record<string, number> = {
  football: 100,
  basketball: 94,
  americanfootball: 93,
  'american-football': 93,
  tennis: 92,
  baseball: 90,
  'ice-hockey': 88,
  hockey: 88,
  cricket: 82,
  volleyball: 80,
  handball: 79,
  boxing: 76,
  mma: 76,
};

function normalized(value: string | null | undefined) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function leaguePriority(name: string | null | undefined) {
  const value = normalized(name);
  for (const [pattern, score] of LEAGUE_PRIORITY) {
    if (pattern.test(value)) return score;
  }
  return 60;
}

function sportPriority(sportKey: string | null | undefined) {
  return SPORT_PRIORITY[normalized(sportKey)] ?? 60;
}

function nationalTeamSignal(match: Match) {
  const league = normalized(match.leagueName);
  const home = normalized(match.participants.find((p) => p.role === 'HOME')?.name);
  const away = normalized(match.participants.find((p) => p.role === 'AWAY')?.name);
  const nationalCompetition =
    /nations league|world cup|euro|copa america|international|qualif/i.test(league);
  if (!nationalCompetition) return 0;

  const countryWords = [
    'germany','italy','france','spain','england','portugal','netherlands',
    'belgium','brazil','argentina','uruguay','colombia','mexico','croatia',
    'turkey','ukraine','poland','sweden','norway','denmark','scotland',
    'ireland','wales','switzerland','austria','serbia','greece','romania',
    'hungary','czech','slovakia','slovenia','armenia','latvia','georgia',
    'northern ireland','montenegro','cyprus','bahamas','bermuda',
  ];
  const count = [home, away].filter((team) =>
    countryWords.some((country) => team.includes(country)),
  ).length;

  return count >= 2 ? 18 : count === 1 ? 8 : 0;
}

function matchContextPriority(match: Match) {
  const league = normalized(match.leagueName);
  const teams = match.participants.map((p) => normalized(p.name)).join(' ');
  let score = 0;

  if (/final|semi-final|semifinal|quarter-final|quarterfinal|playoff|play-off|knockout/i.test(`${league} ${teams}`)) {
    score += 18;
  }

  score += nationalTeamSignal(match);

  if (/derby|classic|clasico/i.test(`${league} ${teams}`)) score += 10;

  return score;
}

const TEAM_PROMINENCE: Array<[RegExp, number]> = [
  [/germany|deutschland/i, 100],
  [/england/i, 100],
  [/spain|españa/i, 100],
  [/france/i, 100],
  [/brazil|brasil/i, 100],
  [/argentina/i, 100],
  [/portugal/i, 98],
  [/italy|italia/i, 98],
  [/netherlands|holland/i, 97],
  [/belgium/i, 94],
  [/croatia/i, 91],
  [/uruguay/i, 91],
  [/colombia/i, 90],
  [/mexico/i, 88],
  [/turkey|türkiye/i, 86],
  [/switzerland/i, 86],
  [/denmark/i, 85],
  [/austria/i, 84],
  [/poland/i, 84],
  [/sweden/i, 83],
  [/norway/i, 83],
  [/serbia/i, 82],
  [/ukraine/i, 82],
  [/greece/i, 81],
  [/romania/i, 80],
  [/japan/i, 86],
  [/south korea|korea/i, 84],
  [/australia/i, 84],
  [/usa|united states/i, 88],
  [/canada/i, 82],
  [/new zealand/i, 78],
  [/new york yankees/i, 98],
  [/los angeles dodgers/i, 98],
  [/boston red sox/i, 94],
  [/chicago cubs/i, 92],
  [/san francisco giants/i, 91],
  [/new york mets/i, 90],
  [/philadelphia phillies/i, 90],
  [/los angeles lakers/i, 98],
  [/boston celtics/i, 98],
  [/golden state warriors/i, 96],
  [/new york knicks/i, 94],
  [/brooklyn nets/i, 90],
  [/minnesota lynx/i, 92],
  [/new york liberty/i, 92],
  [/fenerbahce/i, 91],
  [/olympia milano/i, 89],
  [/partizan/i, 88],
  [/valencia basket/i, 86],
  [/beşiktaş|besiktas/i, 84],
  [/real madrid/i, 100],
  [/barcelona/i, 100],
  [/manchester city/i, 100],
  [/manchester united/i, 100],
  [/liverpool/i, 100],
  [/arsenal/i, 98],
  [/chelsea/i, 96],
  [/bayern munich|bayern münchen/i, 100],
  [/borussia dortmund/i, 96],
  [/juventus/i, 96],
  [/inter milan|internazionale/i, 96],
  [/ac milan/i, 95],
  [/psg|paris saint-germain/i, 98],
];

function teamProminence(name: string) {
  const value = normalized(name);
  for (const [pattern, score] of TEAM_PROMINENCE) {
    if (pattern.test(value)) return score;
  }
  return 0;
}

function teamProminenceScore(match: Match) {
  const scores = match.participants.map((p) => teamProminence(p.name));
  const sorted = scores.sort((a, b) => b - a);
  const first = sorted[0] ?? 0;
  const second = sorted[1] ?? 0;
  return first + second * 0.65;
}

function marketSignal(match: Match) {
  const count = Number(match.marketsCount ?? match.topMarkets?.length ?? 0);
  if (!Number.isFinite(count) || count <= 0) return 0;
  return Math.min(12, Math.log2(count + 1) * 2.5);
}

export function getUpcomingPriority(match: Match) {
  return (
    leaguePriority(match.leagueName) * 1000 +
    teamProminenceScore(match) * 8 +
    sportPriority(match.sportKey) * 10 +
    matchContextPriority(match) * 10 +
    marketSignal(match)
  );
}

export function rankUpcomingMatches(matches: Match[]) {
  const now = Date.now();

  return [...matches]
    .map((match, index) => ({
      match,
      index,
      priority: getUpcomingPriority(match),
      kickoff: new Date(match.scheduledAt).getTime(),
    }))
    .sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;

      const aDistance = Math.max(0, a.kickoff - now);
      const bDistance = Math.max(0, b.kickoff - now);
      if (aDistance !== bDistance) return aDistance - bDistance;

      return a.index - b.index;
    })
    .map(({ match }) => match);
}
