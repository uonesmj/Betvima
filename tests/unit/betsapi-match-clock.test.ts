import { describe, expect, it } from 'vitest';
import { betsApiLiveMinute } from '@/providers/betsapi-match-clock';
import { parseExplorerFixture } from '@/providers/betsapi-explorer';
import { parseBet365MatchStats } from '@/providers/betsapi-match-facts';
import { fillBetsApiMissingMinutes } from '@/server/betsapi-feed';
const origin = Date.UTC(2026,9,19,12,0,0);
describe('BetsAPI factual in-play clocks', () => {
  it('accepts actual Events timer and Bet365 EV TM', () => {
    expect(betsApiLiveMinute({timer:{tm:'23',ts:'58',tt:'0'}})).toBe(23);
    expect(betsApiLiveMinute({type:'EV',TM:'45',TS:'20',TT:'0'})).toBe(45);
    expect(betsApiLiveMinute({timer:{tm:0,ts:12}})).toBe(0);
    expect(betsApiLiveMinute({timer:{tm:null}})).toBeNull();
    expect(betsApiLiveMinute({timer:{tm:201}})).toBeNull();
  });
  it('advances ticking clock by validated London (BST) TU update stamp', () => {
    // 13:00 London in October before DST switch = 12:00 UTC.
    expect(betsApiLiveMinute({
      type:'EV',TM:'50',TS:'40',TT:'1',TU:'20261019130000'
    }, origin+90_000)).toBe(52);
    expect(betsApiLiveMinute({
      type:'EV',TM:'60',TS:'00',TT:'0',TU:'20261019130000'
    }, origin+90_000)).toBe(60);
  });
  it('never extrapolates a stale or invalid or missing TU', () => {
    expect(betsApiLiveMinute({TM:'13',TS:'20',TT:'1'},origin)).toBe(13);
    expect(betsApiLiveMinute({TM:'13',TS:'20',TT:'1',TU:'20261019130000'},origin+3_600_000)).toBe(13);
    expect(betsApiLiveMinute({TM:'13',TS:'20',TT:'1',TU:'20261020130000'},origin)).toBe(13);
  });
  const base = {id:'12345',our_event_id:'909',time_status:'1',time:'1792400000',
    home:{name:'Mexico A'},away:{name:'Mexico B'},league:{name:'Liga TDP'},ss:'0-0'};
  it('joins only exact bridged Events identity and teams, never unrelated fixtures',()=>{
    const bet = parseExplorerFixture(base,1)!;
    expect(bet.minute).toBeNull();
    const events = parseExplorerFixture({...base,id:'909',bet365_id:'12345',timer:{tm:'67',tt:'0'}},1,'events')!;
    const wrong = parseExplorerFixture({...base,id:'909',bet365_id:null,
      home:{name:'Another club'},timer:{tm:'99'}},1,'events')!;
    expect(fillBetsApiMissingMinutes([bet],[events])[0]?.minute).toBe(67);
    expect(fillBetsApiMissingMinutes([bet],[{...events,home:'Other Team'}])[0]?.minute).toBe(67);
    expect(fillBetsApiMissingMinutes([bet],[wrong])[0]?.minute).toBeNull();
    expect(fillBetsApiMissingMinutes([{...bet,minute:71}],[events])[0]?.minute).toBe(71);
  });
  it('uses real EV timer in match facts with no market-based fabricated score',()=>{
    const facts=parseBet365MatchStats('12345',[[{type:'EV',FI:'12345',TM:'62',TS:'12',TT:'0',SS:'0-0'}]]);
    expect(facts.minute).toBe(62);
    expect(facts.score).toBe('0-0');
  });
});
