import { describe, expect, it } from 'vitest';
import { createRequestAdmissionQueue } from '@/providers/odds-request-admission';

describe('The Odds API request admission', () => {
  it('prioritises core price requests above waiting extended-market requests', async () => {
    const gate = createRequestAdmissionQueue();
    const order: string[] = [];
    const releaseFirst = await gate.acquire('core');
    const extended = gate.acquire('extended').then((release) => {
      order.push('extended');
      return release;
    });
    const nextCore = gate.acquire('core').then((release) => {
      order.push('core');
      return release;
    });

    releaseFirst();
    const releaseNext = await nextCore;
    expect(order).toEqual(['core']);
    releaseNext();
    const releaseExtended = await extended;
    expect(order).toEqual(['core', 'extended']);
    releaseExtended();
  });

  it('keeps same-priority FIFO order and safely handles double release', async () => {
    const gate = createRequestAdmissionQueue();
    const releaseFirst = await gate.acquire('extended');
    const order: number[] = [];
    const second = gate.acquire('extended').then((release) => {
      order.push(2);
      return release;
    });
    const third = gate.acquire('extended').then((release) => {
      order.push(3);
      return release;
    });
    releaseFirst();
    releaseFirst();
    const releaseSecond = await second;
    expect(order).toEqual([2]);
    releaseSecond();
    const releaseThird = await third;
    expect(order).toEqual([2, 3]);
    releaseThird();
  });
});
