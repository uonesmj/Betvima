import {describe,it,expect} from 'vitest';
import {referralDateRange} from '@/lib/affiliate/referral-date-range';

describe('affiliate referral reporting dates',()=>{
  it('uses an inclusive calendar date window for referral reporting',()=>{
    expect(referralDateRange('2026-10-13','2026-10-19','Asia/Tehran'))
      .toEqual({from:'2026-10-13',to:'2026-10-19',timezone:'Asia/Tehran'});
  });
  it('starts with a 7-day default period in the affiliate timezone',()=>{
    const r=referralDateRange(null,null,'Asia/Tehran');
    const days=(Date.parse(r.to+'T00:00:00Z')-Date.parse(r.from+'T00:00:00Z'))/86400000;
    expect(days).toBe(6);
    expect(r.timezone).toBe('Asia/Tehran');
  });
  it('rejects missing or invalid date bounds',()=>{
    expect(()=>referralDateRange('2026-10-18',null,'UTC')).toThrow();
    expect(()=>referralDateRange('2026-02-30','2026-03-01','UTC')).toThrow();
    expect(()=>referralDateRange('2026-10-19','2026-10-18','UTC')).toThrow();
    expect(()=>referralDateRange('2025-01-01','2026-10-19','UTC')).toThrow();
  });
});
