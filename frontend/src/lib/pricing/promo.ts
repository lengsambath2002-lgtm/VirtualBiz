import type { Promotion, PromotionState } from '@/lib/domain';
import { round2 } from '@/lib/money';

export type PromoRule = Pick<Promotion, 'type' | 'value' | 'minSpend' | 'maxDiscount'>;

/**
 * Discount a promotion gives on a subtotal (USD), ported from the Customer prototype's
 * `promoDisc()`:
 * - PERCENT: subtotal × value%, capped at `maxDiscount`.
 * - FIXED: `value`, never more than the subtotal.
 * - FREE_SHIPPING: no item discount (it waives the delivery fee — see `promoWaivesDelivery`).
 * Nothing applies below `minSpend`.
 */
export function promoDiscount(promo: PromoRule, subtotal: number): number {
  if (subtotal <= 0) return 0;
  if (promo.minSpend != null && subtotal < promo.minSpend) return 0;
  switch (promo.type) {
    case 'PERCENT': {
      const raw = (subtotal * promo.value) / 100;
      return round2(promo.maxDiscount != null ? Math.min(raw, promo.maxDiscount) : raw);
    }
    case 'FIXED':
      return round2(Math.min(promo.value, subtotal));
    case 'FREE_SHIPPING':
      return 0;
  }
}

/** True when a FREE_SHIPPING promotion applies to this subtotal. */
export function promoWaivesDelivery(promo: PromoRule, subtotal: number): boolean {
  return promo.type === 'FREE_SHIPPING' && (promo.minSpend == null || subtotal >= promo.minSpend);
}

/** Derived PromotionState at `now` (Ended → Scheduled → Used up → Active, as in the Seller prototype). */
export function promotionState(
  promo: Pick<Promotion, 'startsAt' | 'endsAt' | 'uses' | 'usageLimit'>,
  now: Date = new Date(),
): PromotionState {
  const t = now.getTime();
  if (Date.parse(promo.endsAt) < t) return 'ENDED';
  if (Date.parse(promo.startsAt) > t) return 'SCHEDULED';
  if (promo.usageLimit != null && promo.uses >= promo.usageLimit) return 'USED_UP';
  return 'ACTIVE';
}
