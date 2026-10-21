// Seller catalogue and inventory endpoints (docs/api/phase2-catalog-inventory.md § Seller
// catalog, § Inventory), with the mappers to the workspace's shapes. Every call sends the
// open business as X-Business-Id.
import {
  api,
  type ApiClient,
  type ApiCollection,
  type ApiNotification,
  type ApiOrder,
  type OrderSource,
  type ApiPosSale,
  type ApiPromotion,
  type ApiSellerProduct,
  type ApiShift,
  type ApiShopReview,
  type ApiStockMovement,
  type BulkResult,
  type PosSaleInput,
  type ProductInput,
  type PromotionInput,
  type StockWriteResult,
  type VariantStock,
} from '@/lib/api';
import type {
  Client,
  DeliveryProvider,
  PaymentMethod,
  Promotion,
  Review,
  StockReason,
} from '@/lib/domain';

import type {
  SellerNotification,
  SellerOrder,
  SellerPosSale,
  SellerProduct,
  SellerShift,
  SellerShop,
  SellerStockMovement,
} from './types';

export const SYSTEM_USER = 'system';

export function toSellerProduct(p: ApiSellerProduct): SellerProduct {
  return {
    id: p.id,
    slug: p.slug,
    businessId: p.businessId,
    title: p.title,
    description: p.description,
    categoryId: p.categoryId,
    collection: p.collection ?? '',
    status: p.status,
    options: p.options,
    variants: p.variants.map((v) => ({
      id: v.id,
      productId: v.productId,
      options: v.options,
      price: v.price,
      ...(v.compareAt != null ? { compareAt: v.compareAt } : {}),
      ...(v.cost != null ? { cost: v.cost } : {}),
      sku: v.sku,
      barcode: v.barcode,
      stock: v.stock,
      ...(v.swatch ? { swatch: v.swatch } : {}),
    })),
    photos: p.photos,
    lowStockAt: p.lowStockAt,
    sold: p.sold,
    rating: p.rating,
  };
}

export const toMovement = (m: ApiStockMovement): SellerStockMovement => ({
  id: m.id,
  variantId: m.variantId,
  delta: m.delta,
  reason: m.reason,
  byUserId: m.byUserId ?? SYSTEM_USER,
  ...(m.byName ? { byName: m.byName } : {}),
  ...(m.note ? { note: m.note } : {}),
  at: m.at,
});

const opts = (businessId: string) => ({ businessId });

/** The workspace's catalogue: products, the latest 500 movements (oldest first) and collections. */
export async function fetchSellerCatalog(businessId: string) {
  const [products, log, collections] = await Promise.all([
    api.get<ApiSellerProduct[]>('/catalog/products', opts(businessId)),
    api.get<ApiStockMovement[]>('/inventory/movements?limit=500', opts(businessId)),
    api.get<ApiCollection[]>('/catalog/collections', opts(businessId)),
  ]);
  return {
    products: products.map(toSellerProduct),
    log: log.map(toMovement).reverse(),
    collections: collections.map((c) => c.name),
  };
}

export const createProduct = (businessId: string, input: ProductInput) =>
  api.post<ApiSellerProduct>('/catalog/products', input, opts(businessId)).then(toSellerProduct);

export const replaceProduct = (businessId: string, id: string, input: ProductInput) =>
  api
    .put<ApiSellerProduct>(`/catalog/products/${id}`, input, opts(businessId))
    .then(toSellerProduct);

export const setProductStatus = (businessId: string, id: string, status: 'ACTIVE' | 'DRAFT') =>
  api
    .patch<ApiSellerProduct>(`/catalog/products/${id}/status`, { status }, opts(businessId))
    .then(toSellerProduct);

export const duplicateProduct = (businessId: string, id: string) =>
  api
    .post<ApiSellerProduct>(`/catalog/products/${id}/duplicate`, undefined, opts(businessId))
    .then(toSellerProduct);

export const deleteProduct = (businessId: string, id: string) =>
  api.delete<void>(`/catalog/products/${id}`, opts(businessId));

export interface StockWriteInput {
  variantId: string;
  delta: number;
  reason: StockReason;
  note?: string;
  mergeQuick?: boolean;
}

export const postMovement = (businessId: string, w: StockWriteInput) =>
  api.post<StockWriteResult>('/inventory/movements', w, opts(businessId));

export const revertMovementApi = (businessId: string, id: string) =>
  api.delete<{ variant: VariantStock }>(`/inventory/movements/${id}`, opts(businessId));

// ---- Orders and the shop inbox (docs/api/phase3-orders-checkout.md § Seller, § Notifications) ----

/** API order → the workspace's order. */
export function toSellerOrder(o: ApiOrder): SellerOrder {
  return {
    id: o.id,
    number: o.number,
    businessId: o.businessId,
    customerId: o.customer?.id ?? '',
    ...(o.customer
      ? {
          customer: {
            id: o.customer.id ?? '',
            name: o.customer.name,
            ...(o.customer.phone ? { phone: o.customer.phone } : {}),
            ...(o.customer.email ? { email: o.customer.email } : {}),
          },
        }
      : {}),
    lines: o.lines.map((l) => ({
      variantId: l.variantId,
      title: l.title,
      variantName: l.variantName,
      qty: l.qty,
      unitPrice: l.unitPrice,
    })),
    subtotal: o.subtotal,
    // The shop's discounts and the promo code's share, together (the drawer shows one line).
    discount: Math.round((o.discount + o.promoDiscount) * 100) / 100,
    ...(o.promoCode ? { promoCode: o.promoCode } : {}),
    deliveryFee: o.deliveryFee,
    total: o.total,
    payment: { method: o.payment.method, channel: o.payment.channel, paid: o.payment.paid },
    paymentStatus: o.payment.status,
    method: o.method,
    ...(o.address
      ? {
          address: {
            name: o.address.name,
            phone: o.address.phone,
            line: o.address.line,
            district: o.address.district,
            ...(o.address.note ? { note: o.address.note } : {}),
          },
        }
      : {}),
    scheduledFor: o.scheduledFor ?? null,
    ...(o.note ? { note: o.note } : {}),
    status: o.status,
    timeline: o.timeline.map((e) => ({
      status: e.status,
      at: e.at,
      ...(e.note ? { note: e.note } : {}),
    })),
    ...(o.rider ? { rider: o.rider } : {}),
    ...(o.deliveryBy ? { deliveryBy: o.deliveryBy === 'OWN_DELIVERY' ? 'OWN' : 'VB' } : {}),
    ...(o.cancelReason ? { cancelReason: o.cancelReason } : {}),
    reviewed: o.reviewed,
    source: o.source ?? 'ONLINE',
    createdAt: o.placedAt ?? o.createdAt,
  };
}

export const toSellerNotification = (n: ApiNotification): SellerNotification => ({
  id: n.id,
  kind: n.kind,
  params: n.params,
  route: n.route,
  unread: n.unread,
  at: n.at,
});

/** `POST /api/orders/manual` (docs/api/phase8-manual-orders.md). */
export interface ManualOrderInput {
  source: Exclude<OrderSource, 'ONLINE'>;
  name: string;
  phone?: string;
  method: 'DELIVERY' | 'PICKUP';
  line?: string;
  district?: string;
  addressNote?: string;
  lines: { variantId: string; qty: number }[];
  deliveryFee?: number;
  discount?: number;
  payment: 'COD' | 'PAID_CASH' | 'PAID_KHQR';
  note?: string;
}

/** An order the shop took by phone, Facebook, Telegram or at the counter; it starts ACCEPTED. */
export const createManualOrder = async (businessId: string, input: ManualOrderInput) =>
  toSellerOrder(await api.post<ApiOrder>('/orders/manual', input, opts(businessId)));

/** The shop's placed orders (newest first) and its inbox. */
export async function fetchSellerOrders(businessId: string) {
  const [orders, notifs] = await Promise.all([
    api.get<ApiOrder[]>('/orders', opts(businessId)),
    api.get<ApiNotification[]>('/notifications', opts(businessId)),
  ]);
  return { orders: orders.map(toSellerOrder), notifs: notifs.map(toSellerNotification) };
}

const one = (p: Promise<ApiOrder>) => p.then(toSellerOrder);

/** One page of the shop's order history (`GET /api/orders/history`, docs/api/phase16-shop-lists.md). */
export async function fetchOrderHistory(businessId: string, query: string) {
  const p = await api.get<{ items: ApiOrder[]; total: number; page: number; size: number }>(
    `/orders/history?${query}`,
    opts(businessId),
  );
  return { ...p, items: p.items.map(toSellerOrder) };
}
const many = (p: Promise<BulkResult>) =>
  p.then((r) => ({ orders: r.orders.map(toSellerOrder), skipped: r.skipped }));

export const orderApi = {
  accept: (b: string, ids: string[]) =>
    many(api.post<BulkResult>('/orders/accept', { ids }, opts(b))),
  undoAccept: (b: string, ids: string[]) =>
    many(api.post<BulkResult>('/orders/accept/undo', { ids }, opts(b))),
  bulk: (b: string, action: 'PACK' | 'SHIP', ids: string[]) =>
    many(api.post<BulkResult>('/orders/bulk', { action, ids }, opts(b))),
  reject: (b: string, id: string, reason: string, markSoldOut: boolean) =>
    one(api.post<ApiOrder>(`/orders/${id}/reject`, { reason, markSoldOut }, opts(b))),
  pack: (b: string, id: string) =>
    one(api.post<ApiOrder>(`/orders/${id}/pack`, undefined, opts(b))),
  ship: (b: string, id: string, deliveryBy: DeliveryProvider) =>
    one(api.post<ApiOrder>(`/orders/${id}/ship`, { deliveryBy }, opts(b))),
  pickup: (b: string, id: string) =>
    one(api.post<ApiOrder>(`/orders/${id}/pickup`, undefined, opts(b))),
  deliver: (b: string, id: string) =>
    one(api.post<ApiOrder>(`/orders/${id}/deliver`, undefined, opts(b))),
  fail: (b: string, id: string, reason: string) =>
    one(api.post<ApiOrder>(`/orders/${id}/fail`, { reason }, opts(b))),
  giveBack: (b: string, id: string, reason: string, restock: boolean) =>
    one(api.post<ApiOrder>(`/orders/${id}/return`, { reason, restock }, opts(b))),
};

export const readNotificationApi = (b: string, id: string) =>
  api.post<ApiNotification>(`/notifications/${id}/read`, undefined, opts(b));
export const readAllNotificationsApi = (b: string) =>
  api.post<void>('/notifications/read-all', undefined, opts(b));

// ---- Register, promotions, reviews, customers (docs/api/phase5-pos-promotions-reviews.md) ----

export const toShift = (s: ApiShift, businessId: string): SellerShift => ({
  id: s.id,
  businessId,
  openedBy: s.openedBy ?? '',
  openedByName: s.openedByName,
  openedAt: s.openedAt,
  floatUsd: s.floatUsd,
  floatKhr: s.floatKhr,
  moves: s.moves.map((m) => ({ at: m.at, amount: m.amount, note: m.note })),
  ...(s.closedAt ? { closedAt: s.closedAt } : {}),
  ...(s.countedUsd != null ? { countedUsd: s.countedUsd } : {}),
  ...(s.difference != null ? { difference: s.difference } : {}),
});

/** A receipt in the register's shape; its id is the register's own (`clientRef`) when it has one. */
export const toPosSale = (s: ApiPosSale, businessId: string): SellerPosSale => ({
  id: s.clientRef ?? s.id,
  number: s.number,
  businessId,
  shiftId: s.shiftId ?? '',
  lines: s.lines.map((l) => ({
    productId: l.productId ?? '',
    variantId: l.variantId,
    title: l.title,
    variantName: l.variantName,
    qty: l.qty,
    unitPrice: l.unitPrice,
  })),
  subtotal: s.subtotal,
  discount: s.discount,
  tip: 0,
  total: s.total,
  payments: s.payments,
  ...(s.cash
    ? { cash: { usd: s.cash.usd, khr: s.cash.khr ?? 0, change: s.cash.change ?? 0 } }
    : {}),
  ...(s.customerName ? { customerName: s.customerName } : {}),
  refunds: s.refunds.map((r) => ({ at: r.at, amount: r.amount, method: r.method, lines: r.lines })),
  ...(s.byName ? { byName: s.byName } : {}),
  at: s.at,
});

/** The Seller's customer list: keyed by the account id (orders name the account). */
export const toCustomer = (c: ApiClient): Client => ({
  id: c.userId ?? c.id,
  clientId: c.id,
  businessId: c.businessId,
  name: c.name,
  phone: c.phone,
  ...(c.email ? { email: c.email } : {}),
  ...(c.note ? { note: c.note } : {}),
  ...(c.district ? { district: c.district } : {}),
  since: c.since,
  tags: [],
});

/** A review of a product; the workspace shows `authorId` as the reviewer's name. */
export const toSellerReview = (r: ApiShopReview, businessId: string): Review => ({
  id: r.id,
  businessId,
  targetId: r.targetId,
  authorId: r.authorName,
  stars: r.stars,
  text: r.text,
  tags: r.tags,
  ...(r.variantName ? { variantName: r.variantName } : {}),
  verified: r.verified,
  ...(r.reply ? { reply: r.reply } : {}),
  at: r.at,
});

/** Promotions name collections by name in the workspace and by id on the wire. */
export function toPromotion(p: ApiPromotion, collectionName: Map<string, string>): Promotion {
  return {
    id: p.id,
    businessId: p.businessId ?? null,
    name: p.name,
    type: p.type,
    value: p.value,
    code: p.code ?? null,
    scope: p.scope,
    targetIds:
      p.scope === 'CATEGORY' ? p.targetIds.map((id) => collectionName.get(id) ?? id) : p.targetIds,
    ...(p.minSpend != null ? { minSpend: p.minSpend } : {}),
    ...(p.maxDiscount != null ? { maxDiscount: p.maxDiscount } : {}),
    startsAt: p.startsAt,
    endsAt: p.endsAt,
    uses: p.uses,
    ...(p.usageLimit != null ? { usageLimit: p.usageLimit } : {}),
  } as Promotion;
}

const collectionMaps = async (businessId: string) => {
  const list = await api.get<ApiCollection[]>('/catalog/collections', opts(businessId));
  const withId = list.filter((c): c is ApiCollection & { id: string } => !!c.id);
  return {
    name: new Map(withId.map((c) => [c.id, c.name])),
    id: new Map(withId.map((c) => [c.name, c.id])),
  };
};

export async function fetchPromotions(businessId: string) {
  const [list, maps] = await Promise.all([
    api.get<ApiPromotion[]>('/promotions', opts(businessId)),
    collectionMaps(businessId),
  ]);
  return list.map((p) => toPromotion(p, maps.name));
}

/** Create or update (by id) from the workspace's shape. */
export async function savePromotion(businessId: string, p: Promotion, isNew: boolean) {
  const maps = await collectionMaps(businessId);
  const input: PromotionInput = {
    name: p.name,
    type: p.type,
    value: p.value,
    code: p.code ?? '',
    scope: p.scope,
    targetIds: p.scope === 'CATEGORY' ? p.targetIds.map((n) => maps.id.get(n) ?? n) : p.targetIds,
    minSpend: p.minSpend ?? 0,
    maxDiscount: p.maxDiscount ?? 0,
    startsAt: p.startsAt,
    endsAt: p.endsAt,
    usageLimit: p.usageLimit ?? 0,
  };
  const saved = isNew
    ? await api.post<ApiPromotion>('/promotions', input, opts(businessId))
    : await api.patch<ApiPromotion>(`/promotions/${p.id}`, input, opts(businessId));
  return toPromotion(saved, maps.name);
}

export async function endPromotion(businessId: string, id: string) {
  const [r, maps] = await Promise.all([
    api.post<{ promotion: ApiPromotion; previousEndsAt: string }>(
      `/promotions/${id}/end`,
      undefined,
      opts(businessId),
    ),
    collectionMaps(businessId),
  ]);
  return { promotion: toPromotion(r.promotion, maps.name), previousEndsAt: r.previousEndsAt };
}

export async function setPromotionEnd(businessId: string, id: string, endsAt: string) {
  const [p, maps] = await Promise.all([
    api.patch<ApiPromotion>(`/promotions/${id}`, { endsAt }, opts(businessId)),
    collectionMaps(businessId),
  ]);
  return toPromotion(p, maps.name);
}

export const replyReviewApi = (businessId: string, id: string, text: string) =>
  api.post<ApiShopReview>(`/reviews/${id}/reply`, { text }, opts(businessId));

/** Everything the register, promotions, reviews and customer pages read. */
export async function fetchSellerExtras(businessId: string) {
  const [promos, reviews, clients, shift, shifts, sales] = await Promise.all([
    fetchPromotions(businessId),
    api.get<ApiShopReview[]>('/reviews', opts(businessId)),
    api.get<ApiClient[]>('/clients', opts(businessId)),
    api.get<ApiShift | null | undefined>('/pos/shift', opts(businessId)),
    api.get<ApiShift[]>('/pos/shifts?limit=30', opts(businessId)),
    api.get<ApiPosSale[]>('/pos/sales', opts(businessId)),
  ]);
  return {
    promos,
    reviews: reviews
      .filter((r) => r.targetType === 'PRODUCT')
      .map((r) => toSellerReview(r, businessId)),
    customers: clients.map(toCustomer),
    shift: shift ? toShift(shift, businessId) : null,
    shifts: shifts.map((s) => toShift(s, businessId)),
    // Oldest first, as the register appends them.
    sales: sales.map((s) => toPosSale(s, businessId)).reverse(),
  };
}
export type SellerExtras = Awaited<ReturnType<typeof fetchSellerExtras>>;

export const posApi = {
  open: async (b: string, floatUsd: number, floatKhr: number) =>
    toShift(await api.post<ApiShift>('/pos/shift', { floatUsd, floatKhr }, opts(b)), b),
  move: async (b: string, amount: number, note: string) =>
    toShift(await api.post<ApiShift>('/pos/shift/moves', { amount, note }, opts(b)), b),
  close: async (b: string, countedUsd: number) =>
    toShift(await api.post<ApiShift>('/pos/shift/close', { countedUsd }, opts(b)), b),
  ring: async (b: string, input: PosSaleInput) =>
    toPosSale(await api.post<ApiPosSale>('/pos/sales', input, opts(b)), b),
  refund: async (
    b: string,
    number: string,
    lines: { variantId: string; qty: number }[],
    amount: number,
    method: PaymentMethod,
    restock: boolean,
  ) =>
    toPosSale(
      await api.post<ApiPosSale>(
        `/pos/sales/${number}/refunds`,
        { lines, amount, method, restock },
        opts(b),
      ),
      b,
    ),
};

// ---- Shop settings (docs/api/phase1-auth-account-business.md § Business) ----------------

/** The `PATCH /api/businesses/{id}` body for a change to the settings page's fields. */
export function shopPatch(p: Partial<SellerShop>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (p.name !== undefined) out.name = p.name;
  if (p.about !== undefined) out.about = p.about;
  if (p.phone !== undefined) out.phone = p.phone;
  // The page shows "street, district, Phnom Penh"; the street is what can change.
  if (p.addr !== undefined) out.street = p.addr.replace(/,\s*[^,]+,\s*Phnom Penh\s*$/i, '').trim();
  if (p.online !== undefined) out.online = p.online;
  if (p.bakongId !== undefined) out.bakongId = p.bakongId;
  // '' removes the photo.
  if (p.logoUrl !== undefined) out.logoUrl = p.logoUrl;
  if (p.coverUrl !== undefined) out.coverUrl = p.coverUrl;
  const ps: Record<string, unknown> = {};
  for (const k of [
    'autoAccept',
    'prepMinutes',
    'lowStockDefault',
    'pickup',
    'cod',
    'zones',
  ] as const)
    if (p[k] !== undefined) ps[k] = p[k];
  if (p.freeDeliveryOver !== undefined) ps.freeDeliveryOver = p.freeDeliveryOver || null;
  if (Object.keys(ps).length) out.productSettings = ps;
  return out;
}

export const patchBusinessApi = (businessId: string, body: Record<string, unknown>) =>
  api.patch<unknown>(`/businesses/${businessId}`, body, opts(businessId));
