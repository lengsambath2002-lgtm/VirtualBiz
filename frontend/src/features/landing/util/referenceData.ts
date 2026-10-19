import type { Category, District } from '@/lib/domain';

import type { CategoryId, DistrictId, LandingCategory } from '../types';

/** The landing's district picker shows these five, in this order (landing prototype). */
export const LANDING_DISTRICTS: readonly DistrictId[] = [
  'toul-kork',
  'bkk1',
  'daun-penh',
  'chamkar-mon',
  'sen-sok',
];

const KNOWN_CATEGORIES: readonly CategoryId[] = [
  'cafe',
  'electronics',
  'fashion',
  'grocery',
  'spa',
  'beauty',
  'salon',
  'repair',
];

/** Reference districts → the landing's five, keeping only ids that exist in the data. */
export function toLandingDistricts(districts: District[]): DistrictId[] {
  const ids = new Set(districts.map((d) => d.id));
  return LANDING_DISTRICTS.filter((id) => ids.has(id));
}

/** Reference categories → tiles (only those with a translated name), in data order. */
export function toLandingCategories(categories: Category[]): LandingCategory[] {
  return categories.flatMap((c) =>
    (KNOWN_CATEGORIES as readonly string[]).includes(c.id)
      ? [{ id: c.id as CategoryId, icon: c.icon, tint: c.tint }]
      : [],
  );
}
