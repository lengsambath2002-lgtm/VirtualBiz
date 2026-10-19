import { describe, expect, it } from 'vitest';

import { blankDraft } from './draft';
import { draftToCreateInput, platformCategoryId, problemForField } from './toBusiness';

describe('draftToCreateInput', () => {
  it('maps the finished wizard to POST /api/businesses', () => {
    const d = {
      ...blankDraft(),
      type: 'service' as const,
      name: '  Leng Nails ',
      cat: 'nails',
      street: ' #12, St. 516 ',
      lat: 11.57,
      lng: 104.9,
      phone: '012 345 678',
      sunday: true,
      bakong: ' leng@aba ',
      idPhoto: 'data:image/png;base64,AA',
    };
    expect(draftToCreateInput(d)).toEqual({
      type: 'SERVICE',
      name: 'Leng Nails',
      categoryId: 'beauty',
      district: 'Toul Kork',
      street: '#12, St. 516',
      lat: 11.57,
      lng: 104.9,
      phone: '012345678',
      hours: { open: '08:00', close: '18:00', sunday: true },
      bakongId: 'leng@aba',
      idPhoto: 'data:image/png;base64,AA',
    });
  });

  it('leaves out the pin and photo when there are none', () => {
    const input = draftToCreateInput({ ...blankDraft(), type: 'product', cat: 'fitness' });
    expect(input).not.toHaveProperty('lat');
    expect(input).not.toHaveProperty('idPhoto');
    expect(input).not.toHaveProperty('bakongId');
    expect(input.type).toBe('PRODUCT');
  });

  it('maps onboarding chips to platform categories', () => {
    expect(platformCategoryId('cafe-food')).toBe('cafe');
    expect(platformCategoryId('other-product')).toBe('other-product');
  });

  it('maps API fields to wizard problems', () => {
    expect(problemForField('bakongId')).toBe('bakong');
    expect(problemForField('categoryId')).toBe('cat');
    expect(problemForField('unknown')).toBeUndefined();
    expect(problemForField(null)).toBeUndefined();
  });
});
