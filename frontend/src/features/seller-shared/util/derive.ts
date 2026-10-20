// Pure derivations over the seller state, ported from the prototype's "Derived" helpers.
import type { Client, Variant } from '@/lib/domain';
import { khrRate, round2 } from '@/lib/money';

import type {
  PayLabel,
  PosState,
  SellerDb,
  SellerOrder,
  SellerPosSale,
  SellerProduct,
  SellerShift,
} from '../types';

export const MIN = 60_000;
export const HOUR = 3_600_000;
export const DAY = 86_400_000;

/** Local midnight today (the prototype's `today0`). */
export function today0(now: number = Date.now()): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export const ms = (iso: string) => Date.parse(iso);

/** "Black / 128 GB" ('' for single-variant products). */
export const vname = (v: Pick<Variant, 'options'>) => Object.values(v.options).join(' / ');

export function findVariant(
  products: SellerProduct[],
  variantId: string,
): [SellerProduct, Variant] | [null, null] {
  for (const p of products) {
    const v = p.variants.find((x) => x.id === variantId);
    if (v) return [p, v];
  }
  return [null, null];
}

/** Variant by barcode or SKU (case-insensitive SKU), as scanners and the scan box use. */
export function findCode(
  products: SellerProduct[],
  raw: string,
): [SellerProduct, Variant] | [null, null] {
  const code = raw.trim().toLowerCase();
  if (!code) return [null, null];
  for (const p of products)
    for (const v of p.variants)
      if (v.barcode === code || v.sku.toLowerCase() === code) return [p, v];
  return [null, null];
}

export const stockOf = (p: SellerProduct) => p.variants.reduce((x, v) => x + v.stock, 0);

export type StockState = 'ok' | 'low' | 'out';
export const stockState = (p: SellerProduct, v: Variant): StockState =>
  v.stock === 0 ? 'out' : v.stock <= p.lowStockAt ? 'low' : 'ok';

/** Active-product variants at or below the product's alert level. */
export const lowVars = (products: SellerProduct[]) =>
  products
    .filter((p) => p.status === 'ACTIVE')
    .flatMap((p) =>
      p.variants
        .filter((v) => v.stock <= p.lowStockAt)
        .map((v) => [p, v] as [SellerProduct, Variant]),
    );

export function pStock(p: SellerProduct) {
  const s = stockOf(p);
  const out = p.variants.filter((v) => v.stock === 0).length;
  const low = p.variants.filter((v) => v.stock > 0 && v.stock <= p.lowStockAt).length;
  const cls: StockState = s === 0 ? 'out' : out || low ? 'low' : 'ok';
  return { s, out, low, cls };
}

export const payLabel = (o: SellerOrder): PayLabel =>
  o.payment.channel === 'COD'
    ? 'COD'
    : o.payment.method === 'CARD'
      ? 'CARD'
      : o.payment.method === 'CASH'
        ? 'CASH'
        : 'KHQR';

export type OrderTab = 'new' | 'pack' | 'ship' | 'done' | 'cancelled' | 'all';
export const ORDER_TABS: OrderTab[] = ['new', 'pack', 'ship', 'done', 'cancelled', 'all'];
export const tabOf = (o: SellerOrder): Exclude<OrderTab, 'all'> =>
  (
    ({
      NEW: 'new',
      ACCEPTED: 'pack',
      PACKED: 'ship',
      SHIPPED: 'ship',
      DELIVERED: 'done',
      PICKED_UP: 'done',
      CANCELLED: 'cancelled',
      RETURNED: 'cancelled',
    }) as const
  )[o.status];

export const itemCount = (o: SellerOrder) => o.lines.reduce((x, l) => x + l.qty, 0);

export function custStats(orders: SellerOrder[], customerId: string) {
  const os = orders.filter((o) => o.customerId === customerId && o.status !== 'CANCELLED');
  return {
    n: os.length,
    spent: os.reduce((x, o) => x + o.total, 0),
    last: os[0] ? ms(os[0].createdAt) : 0,
  };
}

/** "line, district" — the order's delivery address, or the customer's district (pickup). */
export function orderAddr(o: SellerOrder, customer: Pick<Client, 'district'> | undefined): string {
  if (o.address) return `${o.address.line}, ${o.address.district}`;
  return customer?.district ?? '';
}

/** Who placed an order: the shop's CRM record when there is one, else the account on the order. */
export interface OrderCustomer {
  id: string;
  name: string;
  phone: string;
  email: string;
  district: string;
  /** A CRM record exists (its drawer can open). */
  crm: boolean;
}

export function orderCustomer(db: Pick<SellerDb, 'customers'>, o: SellerOrder): OrderCustomer {
  const c = db.customers.find((x) => x.id === o.customerId);
  return {
    id: o.customerId,
    name: c?.name ?? o.customer?.name ?? '',
    phone: c?.phone ?? o.customer?.phone ?? o.address?.phone ?? '',
    email: c?.email ?? o.customer?.email ?? '',
    district: c?.district ?? o.address?.district ?? '',
    crm: !!c,
  };
}

/** The street line of a customer's latest delivery order ('' when none). */
export function lastAddressLine(orders: SellerOrder[], customerId: string): string {
  return orders.find((o) => o.customerId === customerId && o.address)?.address?.line ?? '';
}

export const saleNet = (s: SellerPosSale) =>
  round2(s.total - s.refunds.reduce((x, r) => x + r.amount, 0));

export const posSalesFrom = (sales: SellerPosSale[], t: number) =>
  sales.filter((s) => ms(s.at) >= t);

export const shiftFloat = (sh: Pick<SellerShift, 'floatUsd' | 'floatKhr'>) =>
  round2(sh.floatUsd + sh.floatKhr / khrRate());

/** Cash that should be in the drawer: float + cash sales − cash refunds ± cash moves. */
export function shiftCash(pos: Pick<PosState, 'shift' | 'sales'>): number {
  const sh = pos.shift;
  if (!sh) return 0;
  const ss = posSalesFrom(pos.sales, ms(sh.openedAt));
  const cashIn = ss.reduce(
    (x, s) => x + s.payments.filter((p) => p.method === 'CASH').reduce((y, p) => y + p.amount, 0),
    0,
  );
  const cashRef = ss.reduce(
    (x, s) => x + s.refunds.filter((r) => r.method === 'CASH').reduce((y, r) => y + r.amount, 0),
    0,
  );
  return round2(shiftFloat(sh) + cashIn - cashRef + sh.moves.reduce((x, m) => x + m.amount, 0));
}

/** Daily sales (online, not cancelled + counter net) for the last `days` days. */
export function series(
  orders: SellerOrder[],
  sales: SellerPosSale[],
  days: number,
  t0: number = today0(),
) {
  return Array.from({ length: days }, (_, i) => {
    const d = t0 - (days - 1 - i) * DAY;
    const online = orders
      .filter((o) => ms(o.createdAt) >= d && ms(o.createdAt) < d + DAY && o.status !== 'CANCELLED')
      .reduce((x, o) => x + o.total, 0);
    const store = sales
      .filter((s) => ms(s.at) >= d && ms(s.at) < d + DAY)
      .reduce((x, s) => x + saleNet(s), 0);
    return { d, v: online + store };
  });
}

/** Cart subtotal, discount and total (POS). */
export function posTotals(pos: Pick<PosState, 'cart' | 'disc'>) {
  const sub = round2(pos.cart.reduce((x, l) => x + l.unitPrice * l.qty, 0));
  const disc = !pos.disc
    ? 0
    : round2(pos.disc.type === '%' ? (sub * pos.disc.v) / 100 : Math.min(pos.disc.v, sub));
  return { sub, disc, total: round2(sub - disc), n: pos.cart.reduce((x, l) => x + l.qty, 0) };
}

export const initials = (n: string) =>
  n
    .split(/\s+/)
    .map((w) => w[0] ?? '')
    .slice(0, 2)
    .join('')
    .toUpperCase();

/** Prototype thumbnail tint per collection. */
export const COLLECTION_TINT: Record<string, 1 | 2 | 3 | 5 | 6> = {
  Phones: 2,
  Audio: 5,
  Wearables: 3,
  Laptops: 6,
  Accessories: 1,
};
