import type { FootballFixture, FootballMarket } from './football-live-feed';

/** Entirely fictional fixtures. NEVER substitute this sample for genuine live odds. */
const select = (id: string, label: string, decimalOdds: number) => ({
  id, label, decimalOdds, status: 'open' as const,
});
const mk = (id: string, name: string, category: string,
  choices: Array<[string, string, number]>, line: string | null = null): FootballMarket => ({
  id, name, category, line, status: 'open', lastPriceChangeUtc: null,
  selections: choices.map(([key, label, price]) => select(key, label, price)),
});
const firstMarkets: FootballMarket[] = [
  mk('result', 'Full-time result', 'Result', [['1', 'Home', 2.16], ['x', 'Draw', 3.28], ['2', 'Away', 3.42]]),
  mk('double', 'Double chance', 'Result', [['1x', '1X', 1.32], ['12', '12', 1.36], ['x2', 'X2', 1.72]]),
  mk('goals', 'Match goals', 'Goals', [['over25', 'Over', 1.88], ['under25', 'Under', 1.92]], '2.5'),
  mk('btts', 'Both teams to score', 'Goals', [['yes', 'Yes', 1.76], ['no', 'No', 1.98]]),
  mk('corners', 'Total corners', 'Corners', [['over95', 'Over', 1.85], ['under95', 'Under', 1.95]], '9.5'),
  mk('cards', 'Total cards', 'Cards', [['over35', 'Over', 1.82], ['under35', 'Under', 1.98]], '3.5'),
  mk('handicap', 'Asian handicap', 'Handicap', [['h-05', 'Home -0.5', 1.94], ['a+05', 'Away +0.5', 1.90]], '0.5'),
  mk('score', 'Correct score', 'Score', [['11','1-1',5.3],['21','2-1',8.1],['12','1-2',8.4]]),
  mk('first', 'First-half result', 'Halves', [['h', 'Home', 2.46], ['d', 'Draw', 2.12], ['a', 'Away', 3.65]]),
  mk('shots', 'Total shots on target', 'Shots', [['o85', 'Over', 1.87], ['u85', 'Under', 1.91]], '8.5'),
];
const scores = (home: number, away: number) => ({ home, away });

export const DEMO_LIVE_FOOTBALL_FIXTURES: FootballFixture[] = [
  {
    id: 'fictional-premier-001', leagueId: 'fictional-premier', leagueName: 'Demo Premier League',
    country: 'Demo Country', home: { id: 'north', name: 'North City FC (Demo)' },
    away: { id: 'harbour', name: 'Harbour United (Demo)' },
    kickoffUtc: '2026-10-16T18:00:00Z', state: 'live', minute: 63, addedMinute: null,
    score: scores(2, 1), statistics: {
      possession: scores(57, 43), shots: scores(13, 9),
      shotsOnTarget: scores(6, 4), corners: scores(7, 3),
      yellowCards: scores(2, 1), redCards: scores(0, 0), fouls: scores(9, 12),
    },
    incidents: [
      { id:'e1',minute:12,addedMinute:null,side:'home',type:'goal',description:'North City FC scored (Demo)' },
      { id:'e2',minute:31,addedMinute:null,side:'away',type:'yellow_card',description:'Yellow card (Demo)' },
      { id:'e3',minute:47,addedMinute:null,side:'away',type:'goal',description:'Harbour United equalized (Demo)' },
      { id:'e4',minute:59,addedMinute:null,side:'home',type:'goal',description:'North City FC scored (Demo)' },
    ],
    markets: firstMarkets,
  },
  {
    id: 'fictional-premier-002', leagueId: 'fictional-premier', leagueName: 'Demo Premier League',
    country: 'Demo Country', home: { id: 'lakes', name: 'Lakeside Athletic (Demo)' },
    away: { id: 'south', name: 'South Rovers (Demo)' },
    kickoffUtc: '2026-10-16T18:30:00Z', state: 'halftime', minute: 45, addedMinute: null,
    score: scores(0, 0), statistics: {
      possession: scores(51, 49), shots: scores(7, 5),
      shotsOnTarget: scores(2, 2), corners: scores(4, 2),
      yellowCards: scores(1, 2), redCards: scores(0, 0), fouls: scores(7, 8),
    },
    incidents: [{ id:'half',minute:45,addedMinute:null,side:'neutral',type:'halftime',description:'Halftime (Demo)' }],
    markets: [
      mk('res2','Full-time result','Result',[['1','Home',2.28],['x','Draw',2.94],['2','Away',3.51]]),
      mk('goals2','Total goals','Goals',[['o15','Over',1.65],['u15','Under',2.06]],'1.5'),
      { ...mk('cards2','Total cards','Cards',[['o45','Over',1.82],['u45','Under',1.9]],'4.5'), status: 'suspended' },
    ],
  },
  {
    id:'fictional-cup-003',leagueId:'fictional-cup',leagueName:'Demo Continental Cup',
    country:'Demo Region',home:{id:'mountains',name:'Mountain FC (Demo)'},
    away:{id:'coastal',name:'Coastal SC (Demo)'},
    kickoffUtc:'2026-10-16T19:00:00Z',state:'live',minute:21,addedMinute:null,
    score:scores(0,1),statistics:{
      possession:scores(46,54),shots:scores(3,6),shotsOnTarget:scores(1,3),
      corners:scores(1,4),yellowCards:scores(0,1),redCards:scores(0,0),fouls:scores(4,5),
    },
    incidents:[{id:'goal3',minute:16,addedMinute:null,side:'away',type:'goal',description:'Coastal SC scored (Demo)'}],
    markets:[
      mk('res3','Full-time result','Result',[['1','Home',4.2],['x','Draw',3.1],['2','Away',1.78]]),
      mk('total3','Total goals','Goals',[['o25','Over',1.92],['u25','Under',1.86]],'2.5'),
      mk('corners3','Total corners','Corners',[['o85','Over',1.81],['u85','Under',1.97]],'8.5'),
    ],
  },
];
