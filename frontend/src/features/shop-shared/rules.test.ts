import { describe, expect, it } from 'vitest';

import type { MarketItem, MarketShop } from '@/lib/api';

import fixture from './__fixtures__/marketplace.json';
import { marketItemToItem, replyTime, shopToView } from './catalog';
import type { CartLine } from './types';
import {
  byShop,
  cartTotals,
  displayNumber,
  groupFee,
  net,
  promoDisc,
  promoShare,
  unitPriceOf,
} from './rules';

/** Answers of `GET /api/marketplace/items/{slug}` and `/shops/{slug}` (local seed). */
const cat = {
  items: (fixture.items as MarketItem[]).map(marketItemToItem),
  shops: (fixture.shops as unknown as MarketShop[]).map(shopToView),
};

describe('customer marketplace rules', () => {
  const item = (id: string) => cat.items.find((i) => i.id === id);
  const shop = (id: string) => cat.shops.find((s) => s.id === id);

  it("maps API listings and shops to the screens' shapes (keyed by slug)", () => {
    const latte = item('latte')!;
    expect(latte.shop).toBe('happy-coffee');
    expect(latte.stock).toBe(40);
    expect(latte.spec).toMatchObject({ Allergens: 'Milk' });
    const massage = item('massage')!;
    expect(massage).toMatchObject({ type: 'service', off: 20, dur: 60 });
    expect(massage.staffIds).toHaveLength(3);
    const spa = shop('jasmine-spa')!;
    expect(spa).toMatchObject({ kind: 'service', hue: 3, icon: 'leaf', resp: '~20 min' });
    expect(spa.staff.map((m) => m.name)).toEqual(['Sophea', 'Lina', 'Mony']);
    expect(shop('happy-coffee')!.eta).toEqual([20, 35]);
    expect(replyTime(60)).toBe('~1 h');
    expect(replyTime(null)).toBe('');
  });

  it('derives option deltas and the discount from the variants', () => {
    const latte = item('latte')!;
    expect(latte.price).toBe(2.5);
    expect(latte.off).toBe(20);
    expect(latte.opts?.[0]?.v.map((v) => v[1])).toEqual([0, 0.5, 1]);
    expect(net(latte, { Size: '16 oz', Sweetness: 'No sugar' })).toBe(2.4);
    const iphone = item('iphone')!;
    expect(unitPriceOf(iphone, { Colour: 'Pink', Storage: '256 GB' })).toBe(929);
    expect(net(iphone, { Colour: 'Pink', Storage: '256 GB' })).toBe(882.55);
    expect(iphone.opts?.[0]?.v[2]?.[2]).toBe('#F2D3D9');
    expect(iphone.opts?.[1]?.v[1]?.[2]).toBeUndefined();
  });

  it('totals the cart and the free-delivery rule per shop', () => {
    const lines: CartLine[] = [
      { pid: 'latte', sel: { Size: '16 oz', Sweetness: 'No sugar' }, qty: 2, on: true },
      { pid: 'croissant', sel: {}, qty: 3, on: true },
      { pid: 'iphone', sel: { Colour: 'Pink', Storage: '256 GB' }, qty: 1, on: true },
    ];
    const t = cartTotals(lines, item);
    expect(t).toEqual({ sub: 940.4, disc: 47.65, total: 892.75, count: 6 });
    const groups = byShop(lines, item);
    expect(groups.map(([sid]) => sid)).toEqual(['happy-coffee', 'king-techno']);
    expect(groupFee(shop('happy-coffee'), groups[0]![1], item, 'Toul Kork')).toBe(1.5);
    expect(groupFee(shop('king-techno'), groups[1]![1], item, 'Toul Kork')).toBe(0);
    expect(groupFee(shop('happy-coffee'), groups[0]![1], item, 'Toul Kork', 'PICKUP')).toBe(0);
  });

  it('applies promo codes and splits them per shop', () => {
    const waterfest = {
      code: 'WATERFEST',
      rule: { type: 'PERCENT' as const, value: 10, maxDiscount: 5 },
    };
    const new5 = { code: 'NEW5', rule: { type: 'FIXED' as const, value: 5, minSpend: 20 } };
    expect(promoDisc(waterfest, 892.75)).toBe(5);
    expect(promoDisc(new5, 19.99)).toBe(0);
    expect(promoShare(5, 10.2, 892.75)).toBe(0.06);
  });

  it('formats display numbers', () => {
    expect(displayNumber('VB', 24038)).toBe('VB-24038');
    expect(displayNumber('BK', 2201)).toBe('BK-02201');
  });
});
