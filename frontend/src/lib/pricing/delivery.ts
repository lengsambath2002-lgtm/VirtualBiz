import type { FulfilmentMethod, ProductSettings } from '@/lib/domain';
import { round2 } from '@/lib/money';

export interface DeliveryFeeInput {
  settings: Pick<ProductSettings, 'zones' | 'freeDeliveryOver'>;
  /** Customer's district name. */
  district: string;
  /** Shop subtotal (after item discounts, before promo), USD. */
  subtotal: number;
  method?: FulfilmentMethod;
}

/**
 * Delivery fee for one shop's order (domain-model.md § Business rules › Delivery):
 * pickup is free; delivery is free at/above `freeDeliveryOver`; otherwise the shop's zone fee
 * for the district. A district in no zone falls into the last ("further") zone, as the
 * Seller prototype does. Returns 0 when the shop has no zones configured.
 */
export function deliveryFee({
  settings,
  district,
  subtotal,
  method = 'DELIVERY',
}: DeliveryFeeInput): number {
  if (method === 'PICKUP') return 0;
  if (settings.freeDeliveryOver != null && subtotal >= settings.freeDeliveryOver) return 0;
  const zone =
    settings.zones.find((z) => z.districts.includes(district)) ??
    settings.zones[settings.zones.length - 1];
  return zone ? round2(zone.fee) : 0;
}

/** How much more the customer must add to unlock free delivery (0 when already free / n/a). */
export function amountToFreeDelivery(
  settings: Pick<ProductSettings, 'freeDeliveryOver'>,
  subtotal: number,
): number {
  if (settings.freeDeliveryOver == null) return 0;
  return Math.max(0, round2(settings.freeDeliveryOver - subtotal));
}
