import { describe, expect, it } from 'vitest';
import { selectFairPrematchRefreshes } from '@/workers/prematch-selection-fairness';

const start=Date.parse('2026-10-13T02:00:00Z');
function fixture(i:number,hours=12) {
  return {
    match_id: `game-${String(i).padStart(4, '0')}`,
    provider_id: `soccer_test:event-${i}`,
    status: 'scheduled',
    scheduled_at: new Date(start+hours*3600_000).toISOString(),
  };
}

describe('fair per-fixture prematch odds refresh scheduler', () => {
  it('rotates over missing-price fixtures instead of permanently choosing the same oldest 12', () => {
    const attempts=new Map<string,number>();
    const all=Array.from({length:59},(_,i)=>fixture(i));
    const seen=new Set<string>();
    for(let tick=0;tick<5;tick++){
      const chosen=selectFairPrematchRefreshes(all,start+tick*30_000,{near:16,mid:12,far:12},{near:false,mid:true,far:false},attempts);
      expect(chosen).toHaveLength(12);
      for(const item of chosen) {
        if(tick<4) expect(seen.has(item.match_id)).toBe(false);
        seen.add(item.match_id);
      }
    }
    expect(seen.size).toBe(59);
  });

  it('rotates 55 far-future fixtures with 12 per 45-second cycle', () => {
    const attempts=new Map<string,number>();
    const all=Array.from({length:55},(_,i)=>fixture(i,36));
    const covered=new Set<string>();
    for(let tick=0;tick<5;tick++){
      const chosen=selectFairPrematchRefreshes(all,start+tick*45_000,{near:16,mid:12,far:12},{near:false,mid:false,far:true},attempts);
      chosen.forEach(f=>covered.add(f.match_id));
    }
    expect(covered.size).toBe(55);
  });

  it('never selects absent provider IDs, finished or already started matches', () => {
    const items=[fixture(0,0),fixture(1),{...fixture(2),provider_id:null},{...fixture(3),status:'finished'}];
    const attempts=new Map<string,number>();
    const chosen=selectFairPrematchRefreshes(items,start,{near:16,mid:12,far:12},{near:true,mid:true,far:true},attempts);
    expect(chosen.map(f=>f.match_id)).toEqual(['game-0001']);
    expect(attempts.size).toBe(1);
  });

  it('never breaks per-bucket limits and respects disabled buckets', () => {
    const rows=[...Array.from({length:20},(_,i)=>fixture(i,.25)),
      ...Array.from({length:30},(_,i)=>fixture(100+i,8)),
      ...Array.from({length:30},(_,i)=>fixture(200+i,35))];
    const chosen=selectFairPrematchRefreshes(rows,start,{near:16,mid:12,far:12},{near:true,mid:false,far:true},new Map());
    expect(chosen).toHaveLength(28);
    expect(chosen.filter(f=>Date.parse(f.scheduled_at)<=start+30*60_000)).toHaveLength(16);
    expect(chosen.filter(f=>Date.parse(f.scheduled_at)>start+24*3600_000)).toHaveLength(12);
  });

  it('treats a failed or empty upstream response as a consumed attempt', () => {
    const rows=Array.from({length:13},(_,i)=>fixture(i));
    const last=new Map<string,number>();
    const first=selectFairPrematchRefreshes(rows,start,{near:0,mid:12,far:0},{near:false,mid:true,far:false},last);
    const second=selectFairPrematchRefreshes(rows,start+30_000,{near:0,mid:12,far:0},{near:false,mid:true,far:false},last);
    expect(first.map(x=>x.match_id)).not.toContain(second[0]?.match_id);
    expect(second[0]?.match_id).toBe('game-0012');
  });
});
