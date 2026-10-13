import { describe, it, expect } from 'vitest';
import { authenticatedFiveDollarH2h } from '@/providers/fivedollar-authenticated-h2h';

const now = Date.parse('2026-10-13T16:00:00Z');
const fixture = {
  id: 2677887066, status: 'live', kickoff_utc: '2026-10-13T15:00:00Z',
  odds: { '1x2': {opening:null, closing:null, inplay: {home:2.1,draw:3.2,away:3.7}} },
};
const history = {
  data: {
    fixture_id: 2677887066, bookmaker: {slug:'bet365'}, market:'1x2',
    ticks: [
      {minute:38,home:2.3,draw:3.1,away:3.4,recorded_at:'2026-10-13T15:59:15Z'},
      {minute:39,home:2.1,draw:3.2,away:3.7,recorded_at:'2026-10-13T15:59:39Z'},
    ],
  },
  pagination: {page:1,has_more:false},
};
function testCase(f: unknown=fixture,h: unknown=history,time=now) {
  return authenticatedFiveDollarH2h(f,h,time);
}
describe('authenticated 5Dollar football H2H quotes',()=>{
  it('accepts only source-dated snapshot-matching live Bet365 odds',()=>{
    const result=testCase();
    expect(result?.matchProviderId).toBe('2677887066');
    expect(result?.updatedAt).toBe('2026-10-13T15:59:39.000Z');
    expect(result?.markets[0]?.isLive).toBe(true);
    expect(result?.markets[0]?.selections.map(s=>[s.code,s.odds]))
      .toEqual([['HOME','2.1'],['DRAW','3.2'],['AWAY','3.7']]);
  });
  it('fails closed for stale/future source time',()=>{
    expect(testCase(fixture,history,now+46_000)).toBeNull();
    expect(testCase(fixture,history,now-30_000)).toBeNull();
  });
  it('fails closed for missing history, unknown source and incomplete pages',()=>{
    expect(testCase(fixture,{})).toBeNull();
    expect(testCase(fixture,{...history,pagination:{page:1,has_more:true}})).toBeNull();
    expect(testCase(fixture,{...history,data:{...history.data,bookmaker:{slug:'other'}}})).toBeNull();
    expect(testCase(fixture,{...history,data:{...history.data,market:'asian'}})).toBeNull();
  });
  it('never mistakes closed/suspended prices for live prices',()=>{
    expect(testCase(fixture,{...history,data:{...history.data,ticks:[...history.data.ticks,{minute:40,suspended:true,recorded_at:'2026-10-13T15:59:41Z'}]}})).toBeNull();
    expect(testCase({...fixture,odds:{'1x2':{inplay:null}}})).toBeNull();
    expect(testCase({...fixture,odds:{'1x2':{inplay:{home:2.12,draw:3.2,away:3.7}}}})).toBeNull();
    expect(testCase({...fixture,status:'finished'})).toBeNull();
  });
  it('never sells pre-match/unknown ticks as current live prices',()=>{
    expect(testCase(fixture,{...history,data:{...history.data,ticks:[{home:2.1,draw:3.2,away:3.7,minute:null,recorded_at:'2026-10-13T15:59:39Z'}]}})).toBeNull();
    expect(testCase({...fixture, id:123})).toBeNull();
  });
  it('requires a genuine recent closing tick for prematch odds',()=>{
    const pre={...fixture,status:'scheduled',kickoff_utc:'2026-10-13T19:00:00Z',odds:{'1x2':{closing:{home:2.1,draw:3.2,away:3.7}}}};
    const ticks={...history,data:{...history.data,ticks:[{minute:null,home:2.1,draw:3.2,away:3.7,recorded_at:'2026-10-13T15:59:39Z'}]}};
    expect(testCase(pre,ticks)?.markets[0]?.isLive).toBe(false);
    expect(testCase({...pre,kickoff_utc:'2026-10-13T15:00:00Z'},ticks)).toBeNull();
  });
});
