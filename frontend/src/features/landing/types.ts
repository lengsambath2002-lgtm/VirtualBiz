import type messages from '../../../messages/en/index';

/** Districts and categories that have a translated display name (common.districts / .categories). */
export type DistrictId = keyof (typeof messages)['common']['districts'];
export type CategoryId = keyof (typeof messages)['common']['categories'];

export interface LandingCategory {
  id: CategoryId;
  icon: string;
  tint: 1 | 2 | 3 | 4 | 5 | 6;
}

/** Customer search (`/search`) query string params. */
export interface SearchQuery {
  q?: string;
  district?: string;
  category?: string;
}
