import { describe, expect, it } from 'vitest';

import { commissionEstimate, ONLINE_COMMISSION_RATE } from './commission';

describe('commissionEstimate', () => {
  it('charges 5% of online sales only', () => {
    expect(ONLINE_COMMISSION_RATE).toBe(0.05);
    const r = commissionEstimate(2000, 4000);
    expect(r.fee).toBe(100);
    expect(r.keep).toBe(5900);
    expect(r.effectivePct.toFixed(1)).toBe('1.7');
  });

  it('is free for counter-only sales', () => {
    expect(commissionEstimate(0, 20000)).toEqual({ fee: 0, keep: 20000, effectivePct: 0 });
  });

  it('returns 0% when there are no sales', () => {
    expect(commissionEstimate(0, 0)).toEqual({ fee: 0, keep: 0, effectivePct: 0 });
  });

  it('is exactly 5% when everything is online', () => {
    expect(commissionEstimate(10000, 0)).toEqual({ fee: 500, keep: 9500, effectivePct: 5 });
  });
});
