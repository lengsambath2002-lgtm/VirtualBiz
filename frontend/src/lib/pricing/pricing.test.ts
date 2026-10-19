import { describe, expect, it } from 'vitest';

import type { ProductSettings } from '@/lib/domain';

import { amountToFreeDelivery, deliveryFee } from './delivery';
import { netPrice, unitPrice } from './netPrice';
import { promoDiscount, promotionState, promoWaivesDelivery } from './promo';

const settings: Pick<ProductSettings, 'zones' | 'freeDeliveryOver'> = {
  freeDeliveryOver: 25,
  zones: [
    { label: 'Zone 1', districts: ['BKK1', 'Chamkar Mon', 'Daun Penh'], fee: 0.75 },
    { label: 'Zone 2', districts: ['Toul Kork', 'Sen Sok', 'Russey Keo'], fee: 1.5 },
    { label: 'Zone 3', districts: ['Chbar Ampov', 'Mean Chey'], fee: 2.5 },
  ],
};

describe('deliveryFee', () => {
  it('charges the zone fee for the district', () => {
    expect(deliveryFee({ settings, district: 'BKK1', subtotal: 10 })).toBe(0.75);
    expect(deliveryFee({ settings, district: 'Toul Kork', subtotal: 10 })).toBe(1.5);
    expect(deliveryFee({ settings, district: 'Mean Chey', subtotal: 10 })).toBe(2.5);
  });
  it('falls back to the last zone for unlisted districts', () => {
    expect(deliveryFee({ settings, district: 'Por Senchey', subtotal: 10 })).toBe(2.5);
  });
  it('is free at or above the free-over threshold', () => {
    expect(deliveryFee({ settings, district: 'Toul Kork', subtotal: 25 })).toBe(0);
    expect(deliveryFee({ settings, district: 'Toul Kork', subtotal: 24.99 })).toBe(1.5);
  });
  it('is free for pickup', () => {
    expect(deliveryFee({ settings, district: 'Mean Chey', subtotal: 1, method: 'PICKUP' })).toBe(0);
  });
  it('never makes delivery free without a threshold', () => {
    expect(
      deliveryFee({
        settings: { ...settings, freeDeliveryOver: undefined },
        district: 'BKK1',
        subtotal: 999,
      }),
    ).toBe(0.75);
  });
  it('reports the gap to free delivery', () => {
    expect(amountToFreeDelivery(settings, 18.5)).toBe(6.5);
    expect(amountToFreeDelivery(settings, 30)).toBe(0);
  });
});

describe('netPrice', () => {
  it('adds option deltas then applies off%', () => {
    // Iced latte: $2.50 + 16 oz $0.50, 20% off → $2.40
    expect(netPrice(2.5, [0.5, 0], 20)).toBe(2.4);
    // iPhone 15 256 GB: $829 + $100, 5% off → $882.55
    expect(netPrice(829, [0, 100], 5)).toBe(882.55);
    expect(netPrice(6)).toBe(6);
    expect(unitPrice(18, [0, 0])).toBe(18);
  });
  it('rounds to cents', () => {
    expect(netPrice(18, [], 15)).toBe(15.3);
    expect(netPrice(1.8, [], 33)).toBe(1.21);
  });
});

describe('promoDiscount', () => {
  const waterfest = { type: 'PERCENT' as const, value: 10, maxDiscount: 5 };
  const new5 = { type: 'FIXED' as const, value: 5, minSpend: 20 };
  it('percent off with a cap', () => {
    expect(promoDiscount(waterfest, 30)).toBe(3);
    expect(promoDiscount(waterfest, 80)).toBe(5);
  });
  it('percent off with a minimum', () => {
    expect(promoDiscount({ type: 'PERCENT', value: 15, minSpend: 50 }, 40)).toBe(0);
    expect(promoDiscount({ type: 'PERCENT', value: 15, minSpend: 50 }, 100)).toBe(15);
  });
  it('flat off with a minimum', () => {
    expect(promoDiscount(new5, 19.99)).toBe(0);
    expect(promoDiscount(new5, 20)).toBe(5);
  });
  it('flat off never exceeds the subtotal', () => {
    expect(promoDiscount({ type: 'FIXED', value: 5 }, 3)).toBe(3);
  });
  it('free shipping gives no item discount but waives delivery over its minimum', () => {
    const ship = { type: 'FREE_SHIPPING' as const, value: 0, minSpend: 15 };
    expect(promoDiscount(ship, 30)).toBe(0);
    expect(promoWaivesDelivery(ship, 30)).toBe(true);
    expect(promoWaivesDelivery(ship, 10)).toBe(false);
  });
});

describe('promotionState', () => {
  const now = new Date('2026-10-09T05:00:00Z');
  const base = { startsAt: '2026-10-01T00:00:00Z', endsAt: '2026-10-20T00:00:00Z', uses: 0 };
  it('derives each state', () => {
    expect(promotionState(base, now)).toBe('ACTIVE');
    expect(promotionState({ ...base, startsAt: '2026-10-12T00:00:00Z' }, now)).toBe('SCHEDULED');
    expect(promotionState({ ...base, endsAt: '2026-10-02T00:00:00Z' }, now)).toBe('ENDED');
    expect(promotionState({ ...base, uses: 50, usageLimit: 50 }, now)).toBe('USED_UP');
  });
});
