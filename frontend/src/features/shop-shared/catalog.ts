// Customer marketplace data from the API (docs/api/phase2-catalog-inventory.md § Marketplace),
// flattened into the shapes the shop screens use. Listings and shops are keyed by their slug
// (`latte`, `happy-coffee`), which is what the customer URLs carry.
import {
  api,
  type ApiCategory,
  type ApiDistrict,
  type MarketDeal,
  type MarketItem,
  type MarketProduct,
  type MarketService,
  type MarketShop,
} from '@/lib/api';
import type { Promotion, Variant } from '@/lib/domain';
import { round2 } from '@/lib/money';

import type { Catalog, Item, ItemOption, OptValue, ShopView } from './types';

const sameOptions = (a: Record<string, string>, b: Record<string, string>) =>
  Object.keys(b).every((k) => a[k] === b[k]);

const toVariant = (v: MarketProduct['variants'][number]): Variant => ({
  id: v.id,
  productId: v.productId,
  options: v.options,
  price: v.price,
  ...(v.compareAt != null ? { compareAt: v.compareAt } : {}),
  sku: v.sku,
  barcode: '',
  stock: v.stock,
  ...(v.swatch ? { swatch: v.swatch } : {}),
});

/** Product + variants → a listing with option deltas, as the customer UI shows them. */
export function productToItem(p: MarketProduct): Item {
  const variants = p.variants.map(toVariant);
  const first = Object.fromEntries(p.options.map((o) => [o.name, o.values[0] ?? '']));
  const v0 = variants.find((v) => sameOptions(v.options, first)) ?? variants[0];
  const full = (v?: { price: number; compareAt?: number }) => v?.compareAt ?? v?.price ?? 0;
  const base = full(v0);
  const off = v0?.compareAt ? Math.round((1 - v0.price / v0.compareAt) * 100) : 0;
  const opts: ItemOption[] = p.options.map((o) => {
    const values = o.values.map((val) =>
      variants.find((v) => sameOptions(v.options, { ...first, [o.name]: val })),
    );
    const swatches = new Set(values.map((v) => v?.swatch));
    return {
      n: o.name,
      v: o.values.map((val, i): OptValue => {
        const v = values[i];
        const delta = round2(full(v) - base);
        return swatches.size > 1 && v?.swatch ? [val, delta, v.swatch] : [val, delta];
      }),
    };
  });
  const spec = Object.keys(p.specs ?? {}).length ? p.specs : undefined;
  return {
    id: p.slug,
    uuid: p.id,
    shop: p.shopSlug,
    type: 'product',
    name: p.title,
    price: base,
    off,
    stock: variants.reduce((a, v) => a + v.stock, 0),
    sold: p.sold,
    rating: p.rating,
    desc: p.description,
    ...(opts.length ? { opts } : {}),
    ...(spec ? { spec } : {}),
    variants,
    ...(p.photos?.length ? { photos: p.photos } : {}),
  };
}

export function serviceToItem(s: MarketService): Item {
  return {
    id: s.slug,
    uuid: s.id,
    shop: s.shopSlug,
    type: 'service',
    name: s.name,
    price: s.price,
    off: s.discountPct ?? 0,
    stock: 0,
    sold: s.sold,
    rating: s.rating,
    desc: s.description,
    dur: s.durationMin,
    staffIds: s.staffIds,
  };
}

export const marketItemToItem = (i: MarketItem): Item =>
  i.type === 'PRODUCT' ? productToItem(i) : serviceToItem(i);

/** "~10 min" / "~1 h" (how fast the shop replies). */
export const replyTime = (min?: number | null) =>
  !min ? '' : min >= 60 && min % 60 === 0 ? `~${min / 60} h` : `~${min} min`;

export function shopToView(b: MarketShop): ShopView {
  return {
    id: b.slug,
    uuid: b.id,
    name: b.name,
    catId: b.categoryId,
    kind: b.type === 'PRODUCT' ? 'product' : 'service',
    area: b.district,
    hue: b.tint,
    icon: b.icon,
    hours: b.hours,
    phone: b.phone,
    addr: b.street,
    ...(b.lat != null && b.lng != null ? { lat: b.lat, lng: b.lng } : {}),
    about: b.about ?? '',
    ...(b.logoUrl ? { logo: b.logoUrl } : {}),
    ...(b.coverUrl ? { cover: b.coverUrl } : {}),
    since: new Date(b.since).getUTCFullYear(),
    resp: replyTime(b.replyMinutes),
    ...(b.etaMinutes ? { eta: b.etaMinutes } : {}),
    staff: b.staff.map((m) => ({ id: m.id, name: m.name })),
    rating: b.rating,
    ...(b.type === 'PRODUCT' && b.productSettings
      ? {
          product: {
            ...b.productSettings,
            freeDeliveryOver: b.productSettings.freeDeliveryOver ?? undefined,
          },
        }
      : {}),
    ...(b.type === 'SERVICE' && b.bookingSettings ? { booking: b.bookingSettings } : {}),
  };
}

type ApiPromotion = Omit<Promotion, 'minSpend' | 'maxDiscount' | 'usageLimit'> & {
  minSpend?: number | null;
  maxDiscount?: number | null;
  usageLimit?: number | null;
};

export const toPromotion = (p: ApiPromotion): Promotion => ({
  id: p.id,
  businessId: p.businessId ?? null,
  name: p.name,
  type: p.type,
  value: p.value,
  code: p.code ?? null,
  scope: p.scope,
  targetIds: p.targetIds ?? [],
  ...(p.minSpend != null ? { minSpend: p.minSpend } : {}),
  ...(p.maxDiscount != null ? { maxDiscount: p.maxDiscount } : {}),
  startsAt: p.startsAt,
  endsAt: p.endsAt,
  uses: p.uses,
  ...(p.usageLimit != null ? { usageLimit: p.usageLimit } : {}),
});

const pub = { auth: false } as const;

/** Everything the customer marketplace reads, in one round of public API requests. */
export async function loadCatalog(): Promise<Catalog> {
  const [districts, categories, shops, items, deals, promos] = await Promise.all([
    api.get<ApiDistrict[]>('/meta/districts', pub),
    api.get<ApiCategory[]>('/meta/categories?marketplace=true', pub),
    api.get<MarketShop[]>('/marketplace/shops', pub),
    api.get<MarketItem[]>('/marketplace/items', pub),
    api.get<MarketDeal[]>('/marketplace/deals', pub),
    api.get<ApiPromotion[]>('/marketplace/promotions', pub),
  ]);
  return {
    items: items.map(marketItemToItem),
    shops: shops.map(shopToView),
    districts: districts.map((d) => d.name),
    districtIds: Object.fromEntries(districts.map((d) => [d.name, d.id])),
    categories: categories.map((c) => ({
      id: c.id,
      icon: c.icon,
      tint: c.tint,
      type: c.businessType === 'PRODUCT' ? 'product' : 'service',
      name: c.name,
      nameKh: c.nameKh,
    })),
    deals: deals.map((d) => ({
      id: d.id,
      shop: d.shopSlug,
      title: d.title,
      body: d.body,
      ends: Date.parse(d.endsAt),
    })),
    promos: promos.map(toPromotion),
  };
}
