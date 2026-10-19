import type { DeliveryZone } from '@/lib/domain';

/**
 * Seller prototype's three delivery zones (open question #7: per-shop zones replace the
 * Customer prototype's distance formula). Districts not listed fall into the last zone. The
 * API gives every new shop the same defaults; the workspace falls back to them for a shop
 * that has none.
 */
export const DEFAULT_ZONES: DeliveryZone[] = [
  {
    label: 'BKK1 · Chamkar Mon · Daun Penh',
    districts: ['BKK1', 'Chamkar Mon', 'Daun Penh'],
    fee: 0.75,
  },
  {
    label: 'Toul Kork · Sen Sok · Russey Keo',
    districts: ['Toul Kork', 'Sen Sok', 'Russey Keo'],
    fee: 1.5,
  },
  {
    label: 'Chbar Ampov · Mean Chey · further',
    districts: ['Chbar Ampov', 'Mean Chey', 'Por Senchey', 'Prampi Makara'],
    fee: 2.5,
  },
];
