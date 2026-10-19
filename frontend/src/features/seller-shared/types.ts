// Seller workspace client-state shapes. They extend the domain types (src/lib/domain) with the
// fields the prototype keeps that the domain model does not carry yet.
import type { PaymentStatus } from '@/lib/api';
import type {
  Client,
  DeliveryZone,
  Instant,
  Order,
  OrderStatus,
  PaymentMethod,
  PosSale,
  PosSaleLine,
  Product,
  Promotion,
  Review,
  Shift,
  StockMovement,
  StockReason,
  Usd,
} from '@/lib/domain';

/**
 * Product (from `GET /api/catalog/products`) plus its slug and shop collection name (prototype
 * "category"; '' = not chosen yet).
 */
export type SellerProduct = Product & { slug: string; collection: string };

/** Timeline entry; `note` marks events that are not a step (e.g. a failed delivery). */
export interface SellerTimelineEntry {
  status: OrderStatus;
  at: Instant;
  note?: string;
}

/** Who carries a shipped delivery order: a VirtualBiz rider or the shop's own delivery. */
export type DeliveryBy = 'VB' | 'OWN';

/** An order from `GET /api/orders` in the workspace's shape (`createdAt` = when it was placed). */
export interface SellerOrder extends Omit<Order, 'timeline'> {
  timeline: SellerTimelineEntry[];
  deliveryBy?: DeliveryBy;
  /** The customer's account (name / phone / email at the time of the request). */
  customer?: { id: string; name: string; phone?: string; email?: string };
  paymentStatus: PaymentStatus;
}

/** How the prototype labels a payment: KHQR, Card, or cash on delivery. */
export type PayLabel = 'KHQR' | 'CARD' | 'COD';

export interface SellerShop {
  id: string;
  name: string;
  ownerId: string;
  ownerName: string;
  about: string;
  phone: string;
  /** Pickup address as one line ("#45, St. 278, BKK1, Phnom Penh"). */
  addr: string;
  online: boolean;
  bakongId: string;
  /** Uploaded logo and cover (`/api/files/{id}`); '' when there is none. */
  logoUrl: string;
  coverUrl: string;
  autoAccept: boolean;
  prepMinutes: number;
  lowStockDefault: number;
  pickup: boolean;
  cod: boolean;
  freeDeliveryOver: number;
  zones: DeliveryZone[];
}

/**
 * One stock-movement log row (`GET /api/inventory/movements`). `byUserId` is 'system' for
 * automatic rows; `byName` is who made it. Rows not yet confirmed by the API have a `tmp-` id.
 */
export type SellerStockMovement = StockMovement & { byName?: string };
export type { StockReason };

export interface SellerPosLine extends PosSaleLine {
  productId: string;
  variantId: string;
  variantName: string;
}

export interface SellerRefund {
  at: Instant;
  amount: Usd;
  method: PaymentMethod;
  lines: { variantId: string; qty: number }[];
}

export interface SellerPosSale extends Omit<PosSale, 'lines' | 'refunds'> {
  lines: SellerPosLine[];
  refunds: SellerRefund[];
  /** Free-text customer typed at the counter (phone or name). */
  customerName?: string;
  /** Why the counter discount was given (`loyal`, `bundle`, …). */
  discountReason?: string;
}

export interface CartLine {
  productId: string;
  variantId: string;
  title: string;
  variantName: string;
  unitPrice: Usd;
  qty: number;
}

export interface PosDiscount {
  type: '%' | '$';
  v: number;
  reason: string;
}

export interface HeldSale {
  at: number;
  cart: CartLine[];
  disc: PosDiscount | null;
  cust: string;
}

export interface CashMove {
  at: Instant;
  /** Signed: negative = taken out. */
  amount: Usd;
  note: string;
}

export interface SellerShift extends Omit<Shift, 'moves'> {
  openedByName: string;
  moves: CashMove[];
}

export interface PosState {
  cart: CartLine[];
  disc: PosDiscount | null;
  cust: string;
  held: HeldSale[];
  shift: SellerShift | null;
  shifts: SellerShift[];
  sales: SellerPosSale[];
  /** Sales rung up but not yet confirmed by the API (offline, or still being sent). */
  pending: string[];
}

/** A shop inbox entry (`GET /api/notifications`): `kind` + `params`, translated by the top bar. */
export interface SellerNotification {
  id: string;
  kind: string;
  params: Record<string, string>;
  route: string;
  unread: boolean;
  at: Instant;
}

export interface SellerDb {
  shop: SellerShop;
  products: SellerProduct[];
  orders: SellerOrder[];
  log: SellerStockMovement[];
  promos: Promotion[];
  reviews: Review[];
  customers: Client[];
  notifs: SellerNotification[];
  pos: PosState;
  /** The shop's collection names (`GET /api/catalog/collections`). */
  collections: string[];
}
