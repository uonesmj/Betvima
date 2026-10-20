import { describe, expect, it, vi } from 'vitest';
import {
  parseBet365MatchStats, resolveEventsMatch, fetchMatchBackground,
} from '@/providers/betsapi-match-facts';

describe('Bet365 match statistics are factual, not odds-derived', () => {
  it('reads SC/SL actual corners and cards, and EV/TE shot and possession columns', () => {
    const actual = parseBet365MatchStats('92667833', [[
      { type:'EV', TM:'45', SS:'0-1', S1:'On Target', S2:'Off Target', S7:'Possession %' },
      { type:'TE', ID:'1', NA:'Alajuelense', S1:'0', S2:'5', S7:'52' },
      { type:'TE', ID:'2', NA:'Santos', S1:'1', S2:'3', S7:'48' },
      { type:'SC', NA:'ICorner', ID:'2' },
      { type:'SL', ID:'0', D1:'4' }, { type:'SL', ID:'1', D1:'1' },
      { type:'SC', NA:'IThrowIn', ID:'5' },
      { type:'SL', ID:'0', D1:'-' }, { type:'SL', ID:'1', D1:'-' },
      { type:'SC', NA:'IYellowCard', ID:'3' },
      { type:'SL', ID:'0', D1:'2' }, { type:'SL', ID:'1', D1:'2' },
      // PA are ODDS. These must NEVER count as match statistics.
      { type:'MG', NA:'Match Corners' },
      { type:'PA', NA:'Over 8.5', OD:'2/1' },
    ]]);
    expect(actual.score).toBe('0-1');
    expect(actual.minute).toBe(45);
    expect(actual.home).toBe('Alajuelense');
    expect(actual.stats.find(s=>s.key==='corners')).toMatchObject({home:4,away:1});
    expect(actual.stats.find(s=>s.key==='possession')).toMatchObject({home:52,away:48});
    expect(actual.stats.find(s=>s.key==='yellowcards')).toMatchObject({home:2,away:2});
    expect(actual.stats.some(s=>s.key==='throwins')).toBe(false);
    expect(actual.stats.some(s=>s.key==='fouls')).toBe(false);
  });

  it('only exposes provider-supplied penalty counters, never an odds market', () => {
    const actual = parseBet365MatchStats('92667833', [[
      { type: 'EV', SS: '0-0' },
      { type: 'TE', ID: '1', NA: 'Home' },
      { type: 'TE', ID: '2', NA: 'Away' },
      { type: 'SC', NA: 'IPenalty' },
      { type: 'SL', ID: '0', D1: '1' },
      { type: 'SL', ID: '1', D1: '0' },
      { type: 'MG', NA: 'Penalty awarded' },
      { type: 'PA', NA: 'Yes', OD: '1/2' },
    ]]);
    expect(actual.stats.find(s=>s.key === 'penalties'))
      .toMatchObject({ home: 1, away: 0 });
    const onlyOdds = parseBet365MatchStats('92667833', [[
      { type: 'EV', SS: '0-0' }, { type:'MG', NA:'Penalty' },
      { type:'PA', NA:'Yes', OD:'1/2' },
    ]]);
    expect(onlyOdds.stats.some(s=>s.key==='penalties')).toBe(false);
  });

  const kickoff='2026-10-18T17:00:00.000Z';
  const valid = {
    id:'678', bet365_id:'202819155',
    home:{ id:'200', name:'Home FC' }, away:{ id:'201', name:'Away FC' },
    time:String(Date.parse(kickoff)/1000), time_status:'1',
  };
  it('never confuses Bet365 FI with Events API event IDs or other fixtures', () => {
    expect(resolveEventsMatch([valid], '202819155','Home FC','Away FC',kickoff)?.id).toBe('678');
    expect(resolveEventsMatch([valid], '202819155','Different FC','Away FC',kickoff)).toBeNull();
    expect(resolveEventsMatch([{...valid,bet365_id:'987'}],
      '202819155','Home FC','Away FC',kickoff)).toBeNull();
    expect(resolveEventsMatch([{...valid,time:'1602952200'}],
      '202819155','Home FC','Away FC',kickoff)).toBeNull();
  });
  it('fetches only matched team form, venue and future dates (never betting markets)', async () => {
    const calls: string[]=[];
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url=new URL(String(input));
      calls.push(url.pathname);
      const data: Record<string,unknown> = url.pathname === '/v1/events/search'
        ? { results:[valid] }
        : url.pathname === '/v1/event/view'
        ? { results:[{
            ...valid, extra:{ stadium:'Main Stadium',
              stadium_data:{name:'Main Stadium',city:'City A',country:'Country B'},
              referee:{name:'Referee C'} },
          }] }
        : url.pathname === '/v1/event/history'
        ? {results:{home:[{...valid,id:'650',time_status:'3',ss:'2-0'}],away:[],h2h:[]}}
        : url.pathname === '/v3/events/upcoming'
        ? {results:[{...valid,id:'700',time_status:'0',ss:null,time:String((Date.parse(kickoff)+86400000)/1000)}]}
        : {results:[]};
      return new Response(JSON.stringify({success:1,...data}));
    });
    const info=await fetchMatchBackground('FAKE_TEST_TOKEN','202819155',1,
      'Home FC','Away FC',kickoff,fetcher as typeof fetch);
    expect(info.matched).toBe(true);
    expect(info.stadium).toBe('Main Stadium');
    expect(info.referee).toBe('Referee C');
    expect(info.pastHome[0]?.score).toBe('2-0');
    expect(info.nextHome[0]?.id).toBe('700');
    expect(info.nextAway[0]?.id).toBe('700');
    expect(calls).toContain('/v1/event/history');
    expect(calls.filter(x=>x==='/v3/events/upcoming')).toHaveLength(2);
    expect(calls.some(x=>x.includes('/bet365/prematch')||x.includes('odds'))).toBe(false);
  });
});
