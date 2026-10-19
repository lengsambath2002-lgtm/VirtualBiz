// Customer marketplace rules, ported from customer.html. Money math goes through the shared
// pricing/money helpers; delivery uses the shop's zones (open question #7).
import { DISTRICT_CENTER, distanceKm, type LatLng } from '@/lib/geo';
import type { FulfilmentMethod } from '@/lib/domain';
import { round2 } from '@/lib/money';
import { deliveryFee, netPrice, promoDiscount } from '@/lib/pricing';

import type { AppliedPromo, CartLine, Item, Selection, ShopView } from './types';

export const DAY_MS = 86_400_000;
/** Customers may cancel an order within this window while it's still "placed". */
export const CANCEL_WINDOW_MS = 5 * 60_000;
/** Order tracking advances one step every 7 s while the page is open (prototype simulation). */
export const TRACK_TICK_MS = 7000;
/** Toasts stay for 4 s. */
export const TOAST_MS = 4000;

export const defSel = (it: Item): Selection =>
  Object.fromEntries((it.opts ?? []).map((g) => [g.n, g.v[0]?.[0] ?? '']));

export const selDeltas = (it: Item, sel: Selection = {}) =>
  (it.opts ?? []).map((g) => (g.v.find((x) => x[0] === sel[g.n]) ?? g.v[0])?.[1] ?? 0);

/** Price before the discount for the chosen options. */
export const unitPriceOf = (it: Item, sel?: Selection) =>
  round2(selDeltas(it, sel).reduce((a, d) => a + d, it.price));

/** Price the customer pays per unit (options + discount). */
export const net = (it: Item, sel?: Selection) => netPrice(it.price, selDeltas(it, sel), it.off);

export const selTxt = (sel?: Selection) => Object.values(sel ?? {}).join(' · ');

/** Variant matching the selection (products). */
export const variantFor = (it: Item, sel: Selection) =>
  it.variants?.find((v) => Object.entries(sel).every(([k, val]) => v.options[k] === val));

/** "Swatch" colour of the selection (first option that has one). */
export const swatchOf = (it: Item, sel?: Selection) => {
  const s = sel ?? defSel(it);
  for (const g of it.opts ?? []) {
    const v = g.v.find((x) => x[2] && s[g.n] === x[0]);
    if (v?.[2]) return v[2];
  }
  return undefined;
};

export const initials = (n: string) =>
  n
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

export const hueOf = (s: string) =>
  ((s.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 6) + 1) as 1 | 2 | 3 | 4 | 5 | 6;

/** "2.8k" for 2812. */
export const kfmt = (n: number) =>
  n >= 1000 ? (n / 1000).toFixed(1).replace('.0', '') + 'k' : String(n);

/** "07:30" for 450. */
export const hm = (m: number) =>
  String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');

export const today0 = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};
export const nowMin = () => {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
};

/** Monday-first weekday index of a date (hours[] index). */
export const weekdayIdx = (t: number) => (new Date(t).getDay() + 6) % 7;

/** Opening hours [open, close] in minutes for the day of `t`, or null when closed. */
export const hoursOn = (s: ShopView, t: number = Date.now()) => s.hours[weekdayIdx(t)] ?? null;

export const isOpen = (s: ShopView, t: number = Date.now()) => {
  const h = hoursOn(s, t);
  if (!h) return false;
  const d = new Date(t);
  const m = d.getHours() * 60 + d.getMinutes();
  return m >= h[0] && m < h[1];
};

/** Distance in km from the customer's district (prototype formula, by district order). */
/**
 * Km from the customer to a shop: from their exact point ("Use my current location") or their
 * district's centre to the shop's pin; district-order estimate for shops without a pin.
 */
export function dist(s: ShopView, area: string, districts: string[], here?: LatLng | null) {
  const from = here ?? DISTRICT_CENTER[area];
  if (from && s.lat != null && s.lng != null) {
    return Math.max(0.1, +distanceKm(from, { lat: s.lat, lng: s.lng }).toFixed(1));
  }
  if (s.area === area) return 0.8 + (s.name.length % 5) / 10;
  const a = districts.indexOf(s.area);
  const b = districts.indexOf(area);
  return +(2 + Math.abs(a - b) * 1.3 + (s.name.length % 4) / 10).toFixed(1);
}

/** Delivery fee for a shop to a district before the free-over rule (zone fee). */
export const zoneFee = (s: ShopView, district: string) =>
  s.product ? deliveryFee({ settings: s.product, district, subtotal: 0 }) : 0;

export const freeOver = (s: ShopView) => s.product?.freeDeliveryOver ?? Infinity;

export interface Totals {
  sub: number;
  disc: number;
  total: number;
  count: number;
}

export function cartTotals(lines: CartLine[], item: (id: string) => Item | undefined): Totals {
  let sub = 0;
  let disc = 0;
  let count = 0;
  for (const l of lines) {
    const it = item(l.pid);
    if (!it) continue;
    const u = unitPriceOf(it, l.sel);
    sub += u * l.qty;
    disc += (u - net(it, l.sel)) * l.qty;
    count += l.qty;
  }
  return { sub: round2(sub), disc: round2(disc), total: round2(sub - disc), count };
}

/** Lines grouped by shop, in first-seen order. */
export function byShop(lines: CartLine[], item: (id: string) => Item | undefined) {
  const m = new Map<string, CartLine[]>();
  for (const l of lines) {
    const sid = item(l.pid)?.shop;
    if (!sid) continue;
    m.set(sid, [...(m.get(sid) ?? []), l]);
  }
  return [...m.entries()];
}

/** One shop's delivery fee: pickup free, free over the shop's threshold, else its zone fee. */
export function groupFee(
  s: ShopView | undefined,
  lines: CartLine[],
  item: (id: string) => Item | undefined,
  district: string,
  method: FulfilmentMethod = 'DELIVERY',
) {
  if (!s?.product) return 0;
  return deliveryFee({
    settings: s.product,
    district,
    subtotal: cartTotals(lines, item).total,
    method,
  });
}

export const promoDisc = (promo: AppliedPromo | null, total: number) =>
  promo ? promoDiscount(promo.rule, total) : 0;

/** Per-shop share of a promo discount, proportional to the shop's total. */
export const promoShare = (pd: number, shopTotal: number, allTotal: number) =>
  allTotal ? round2((pd * shopTotal) / allTotal) : 0;

export const SLOT_GROUPS = [
  ['morning', 0, 720],
  ['afternoon', 720, 1020],
  ['evening', 1020, 1440],
] as const;

/** Checkout "Schedule for today" windows: from 2 h ahead (not before 9:00) until 22:00. */
export function deliveryWindows() {
  const out: string[] = [];
  for (let h = Math.max(new Date().getHours() + 2, 9); h < 22; h++)
    out.push(`${hm(h * 60)}–${hm(h * 60 + 60)}`);
  return out;
}

/** Display number with 5 digits: VB-24038, BK-02201. */
export const displayNumber = (prefix: 'VB' | 'BK', n: number) =>
  `${prefix}-${String(n).padStart(5, '0')}`;
