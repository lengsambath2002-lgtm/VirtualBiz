import { describe, expect, it } from 'vitest';

import type { Category, District } from '@/lib/domain';

import { toLandingCategories, toLandingDistricts } from './referenceData';

/** Reference data as `GET /api/meta/districts` and `/api/meta/categories?marketplace=true` return it. */
const DISTRICTS: District[] = [
  'toul-kork',
  'bkk1',
  'daun-penh',
  'chamkar-mon',
  'sen-sok',
  'russey-keo',
  'chbar-ampov',
  'mean-chey',
  'por-senchey',
  'prampi-makara',
].map((id, i) => ({ id, name: id, km: i }));
const CATEGORIES: Category[] = (
  [
    ['cafe', 'cup', 1, 'PRODUCT'],
    ['electronics', 'phone', 2, 'PRODUCT'],
    ['fashion', 'shirt', 4, 'PRODUCT'],
    ['grocery', 'basket', 3, 'PRODUCT'],
    ['spa', 'leaf', 3, 'SERVICE'],
    ['beauty', 'brush', 5, 'SERVICE'],
    ['salon', 'scissors', 6, 'SERVICE'],
    ['repair', 'wrench', 2, 'SERVICE'],
  ] as const
).map(([id, icon, tint, businessType]) => ({ id, name: id, icon, tint, businessType }));

describe('landing reference data', () => {
  it('shows the prototype’s five districts, in order', async () => {
    expect(toLandingDistricts(DISTRICTS)).toEqual([
      'toul-kork',
      'bkk1',
      'daun-penh',
      'chamkar-mon',
      'sen-sok',
    ]);
  });

  it('maps all eight marketplace categories with icon and tint', async () => {
    const cats = toLandingCategories(CATEGORIES);
    expect(cats.map((c) => c.id)).toEqual([
      'cafe',
      'electronics',
      'fashion',
      'grocery',
      'spa',
      'beauty',
      'salon',
      'repair',
    ]);
    expect(cats[0]).toEqual({ id: 'cafe', icon: 'cup', tint: 1 });
  });

  it('skips unknown ids', () => {
    expect(toLandingDistricts([{ id: 'bkk1', name: 'BKK1', km: 2 }])).toEqual(['bkk1']);
    expect(
      toLandingCategories([
        { id: 'pets', name: 'Pets', icon: 'paw', tint: 1, businessType: 'PRODUCT' },
      ]),
    ).toEqual([]);
  });
});
