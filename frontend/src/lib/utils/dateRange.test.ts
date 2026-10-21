import { describe, expect, it } from 'vitest';

import { presetOf, rangeOf } from './dateRange';

// 21 Oct 2026, 01:30 in Phnom Penh is still 20 Oct in UTC: ranges follow the shop's day.
const now = new Date('2026-10-20T18:30:00Z');

describe('export ranges', () => {
  it('counts back whole Phnom Penh days, today included', () => {
    expect(rangeOf('last7', now)).toEqual({ from: '2026-10-15', to: '2026-10-21' });
    expect(rangeOf('last30', now)).toEqual({ from: '2026-09-22', to: '2026-10-21' });
    expect(rangeOf('last365', now)).toEqual({ from: '2025-10-22', to: '2026-10-21' });
  });

  it('takes calendar months, across a year end', () => {
    expect(rangeOf('thisMonth', now)).toEqual({ from: '2026-10-01', to: '2026-10-21' });
    expect(rangeOf('lastMonth', now)).toEqual({ from: '2026-09-01', to: '2026-09-30' });
    expect(rangeOf('lastMonth', new Date('2026-01-10T05:00:00Z'))).toEqual({
      from: '2025-12-01',
      to: '2025-12-31',
    });
  });
});

describe('presets', () => {
  it('names a range that matches one', () => {
    expect(rangeOf('today', now)).toEqual({ from: '2026-10-21', to: '2026-10-21' });
    expect(presetOf({ from: '2026-09-22', to: '2026-10-21' }, now)).toBe('last30');
    expect(presetOf({ from: '2026-09-23', to: '2026-10-21' }, now)).toBeNull();
  });
});
