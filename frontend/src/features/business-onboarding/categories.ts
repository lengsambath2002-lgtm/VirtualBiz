// Create Business's category chips (the prototype's own list). They are broader than the
// platform categories (`GET /api/meta/categories`): each chip names the platform category the
// business is filed under; onboarding-only chips (beauty products, fitness, other) are platform
// categories of their own with `inMarketplace = false`.
import type { BusinessType } from '@/lib/domain';

export interface OnboardingCategory {
  /** Chip id (message key `onboarding.categories.<id>`). */
  id: string;
  type: BusinessType;
  /** The platform category the API stores. */
  platformCategoryId: string;
}

export const ONBOARDING_CATEGORIES: OnboardingCategory[] = [
  { id: 'cafe-food', type: 'PRODUCT', platformCategoryId: 'cafe' },
  { id: 'phones-electronics', type: 'PRODUCT', platformCategoryId: 'electronics' },
  { id: 'fashion', type: 'PRODUCT', platformCategoryId: 'fashion' },
  { id: 'grocery', type: 'PRODUCT', platformCategoryId: 'grocery' },
  { id: 'beauty-products', type: 'PRODUCT', platformCategoryId: 'beauty-products' },
  { id: 'other-product', type: 'PRODUCT', platformCategoryId: 'other-product' },
  { id: 'salon-barber', type: 'SERVICE', platformCategoryId: 'salon' },
  { id: 'spa-massage', type: 'SERVICE', platformCategoryId: 'spa' },
  { id: 'nails', type: 'SERVICE', platformCategoryId: 'beauty' },
  { id: 'repair', type: 'SERVICE', platformCategoryId: 'repair' },
  { id: 'fitness', type: 'SERVICE', platformCategoryId: 'fitness' },
  { id: 'other-service', type: 'SERVICE', platformCategoryId: 'other-service' },
];

export const onboardingCategories = (type: BusinessType) =>
  ONBOARDING_CATEGORIES.filter((c) => c.type === type);
