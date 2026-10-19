import { describe, expect, it } from 'vitest';

import { blankDraft, checkStep, furthestStep, isCloseAfterOpen, shopSlug } from './draft';

describe('business draft', () => {
  it('prefills the user phone in display form', () => {
    expect(blankDraft('0968189261').phone).toBe('096 818 9261');
    expect(blankDraft().district).toBe('Toul Kork');
  });

  it('checks step 1 like the prototype', () => {
    const d = blankDraft();
    expect(checkStep(d, 1)).toEqual(['type', 'name', 'cat']);
    expect(checkStep({ ...d, type: 'product', name: ' A ', cat: 'fashion' }, 1)).toEqual(['name']);
    expect(checkStep({ ...d, type: 'product', name: 'Ab', cat: 'fashion' }, 1)).toEqual([]);
  });

  it('checks step 2: street ≥ 3 chars and a 0-prefixed 9–10 digit phone', () => {
    const d = { ...blankDraft('0968189261'), street: 'St' };
    expect(checkStep(d, 2)).toEqual(['street']);
    expect(checkStep({ ...d, street: '#12', phone: '012 345 678' }, 2)).toEqual([]);
    expect(checkStep({ ...d, street: '#12', phone: '12 345 678' }, 2)).toEqual(['phone']);
    expect(checkStep({ ...d, street: '#12', phone: '012 345 67' }, 2)).toEqual(['phone']);
  });

  it('checks step 3: payout is optional, a typed Bakong ID must be well formed', () => {
    const d = blankDraft();
    expect(checkStep(d, 3)).toEqual([]);
    expect(checkStep({ ...d, bakong: 'sonita@aba' }, 3)).toEqual([]);
    expect(checkStep({ ...d, bakong: 'sonita@aba1', idPhoto: 'data:' }, 3)).toEqual(['bakong']);
    expect(checkStep({ ...d, bakong: ' so.ni_ta-1@ABA ', idPhoto: 'data:' }, 3)).toEqual([]);
  });

  it('finds the furthest reachable step', () => {
    const d = blankDraft('0968189261');
    expect(furthestStep(d)).toBe(1);
    const s1 = { ...d, type: 'service' as const, name: 'Sonita Beauty', cat: 'nails' };
    expect(furthestStep(s1)).toBe(2);
    expect(furthestStep({ ...s1, street: '#12, St. 516' })).toBe(3);
  });

  it('slugs and compares hours like the prototype', () => {
    expect(shopSlug('  Sonita Beauty & Spa! ')).toBe('sonita-beauty-spa');
    expect(isCloseAfterOpen('08:00', '18:00')).toBe(true);
    expect(isCloseAfterOpen('08:00', '08:00')).toBe(false);
  });
});
