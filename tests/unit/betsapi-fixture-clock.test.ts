import { describe, it, expect, vi } from 'vitest';
import { supplementBet365LiveMinutes } from '@/server/betsapi-fixture-clock';
import { sourceMatch } from '@/server/betsapi-feed';
import type { ExplorerFixture } from '@/providers/betsapi-explorer';

const fixture = (fi:string, minute:number|null = null): ExplorerFixture => ({
  fi, eventId:null, sportId:1, league:'Mexico Liga TDP',
  country:'mx',home:'CDC Dominguez Osos',away:'Club de Futbol RX',
  kickoff:'2026-10-19T00:00:00Z',score:'0-0',
  minute,marketStatus:'not_requested',
});

describe('minute in unchanged native Home and Live cards',()=>{
  it('uses only the actual Bet365 EV clock for both the carousel and list',async()=>{
    const reader=vi.fn(async (_fi:string) => ({type:'EV',TM:'57',TS:'21',TT:'0'}));
    const first=await supplementBet365LiveMinutes([fixture('701109911')],reader);
    const home=sourceMatch(first[0]!,'football','live');
    const second=await supplementBet365LiveMinutes([fixture('701109911')],reader);
    const list=sourceMatch(second[0]!,'football','live');
    expect(home.minute).toBe(57);
    expect(list.minute).toBe(57);
    expect(home.isBettingAvailable).toBe(false);
    expect(list.isBettingAvailable).toBe(false);
    expect(reader).toHaveBeenCalledTimes(1);
  });
  it('does not fabricate minutes from fixture kickoff, odds, or a missing clock', async()=>{
    const f=fixture('701109922');
    const read=vi.fn(async()=>null);
    const [value]=await supplementBet365LiveMinutes([f],read);
    expect(value?.minute).toBeNull();
    expect(value?.score).toBe('0-0');
  });
  it('retains valid minutes already supplied by the Events or inplay feed',async()=>{
    const read=vi.fn(async()=>({TM:'99',TT:'0'}));
    const [f]=await supplementBet365LiveMinutes([fixture('701109933',62)],read);
    expect(f?.minute).toBe(62);
    expect(read).not.toHaveBeenCalled();
  });
  it('limits provider fanout while allowing later polls to fill the backlog',async()=>{
    const read=vi.fn(async()=>({TM:'32',TS:'01',TT:'0'}));
    const fixtures=Array.from({length:15},(_,i)=>fixture(String(701110000+i)));
    const first=await supplementBet365LiveMinutes(fixtures,read);
    expect(first.filter(f=>f.minute!==null).length).toBeLessThanOrEqual(4);
    expect(read.mock.calls.length).toBeLessThanOrEqual(4);
    const second=await supplementBet365LiveMinutes(fixtures,read);
    expect(second.filter(f=>f.minute!==null).length).toBeGreaterThan(first.filter(f=>f.minute!==null).length);
    expect(read.mock.calls.length).toBeLessThanOrEqual(8);
  });
  it('rejects bogus Bet365 FI values without contacting upstream',async()=>{
    const read=vi.fn(async()=>({TM:'31'}));
    const [f]=await supplementBet365LiveMinutes([fixture('untrusted-id')],read);
    expect(f?.minute).toBeNull();
    expect(read).not.toHaveBeenCalled();
  });
});
