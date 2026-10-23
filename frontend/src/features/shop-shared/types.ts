import type { PaymentStatus } from '@/lib/api';
import type {
  AddressLabel,
  AppointmentStatus,
  BookingSettings,
  FulfilmentMethod,
  OrderAddress,
  OrderPayment,
  OrderStatus,
  PaymentMethod,
  ProductSettings,
  Promotion,
  Rider,
  Tint,
  Variant,
  WeekRanges,
} from '@/lib/domain';

/** Option value as the customer UI uses it: [label, price delta, swatch?]. */
export type OptValue = [label: string, delta: number, swatch?: string];
export interface ItemOption {
  n: string;
  v: OptValue[];
}
/** Chosen option values, by option name. */
export type Selection = Record<string, string>;

/** A product or service listing, flattened for the customer UI. */
export interface Item {
  /** Listing slug (`latte`): the URL id and saved-item key. */
  id: string;
  /** API id of the product / service. */
  uuid?: string;
  shop: string;
  type: 'product' | 'service';
  name: string;
  /** Base price (first option values), before the discount. */
  price: number;
  /** Discount %, 0 when none. */
  off: number;
  /** Units available (products), from the shop's stock. */
  stock: number;
  sold: number;
  rating: number;
  desc: string;
  opts?: ItemOption[];
  /** Duration in minutes (services). */
  dur?: number;
  spec?: Record<string, string>;
  variants?: Variant[];
  /** Uploaded photos, first is the cover (products); none: a tinted placeholder. */
  photos?: string[];
  /** Staff who perform the service. */
  staffIds?: string[];
}

export interface ShopStaff {
  id: string;
  name: string;
}

/** A marketplace shop, flattened for the customer UI. */
export interface ShopView {
  /** Shop slug (`happy-coffee`). */
  id: string;
  /** API id of the business. */
  uuid?: string;
  name: string;
  catId: string;
  kind: 'product' | 'service';
  /** District name. */
  area: string;
  hue: Tint;
  icon: string;
  hours: WeekRanges;
  phone: string;
  addr: string;
  /** Map pin, when the shop has one. */
  lat?: number;
  lng?: number;
  about: string;
  /** Uploaded logo and cover; without them the tinted icon placeholder shows. */
  logo?: string;
  cover?: string;
  since: number;
  /** "~10 min" — how fast the shop replies. */
  resp: string;
  eta?: [number, number];
  staff: ShopStaff[];
  rating: number;
  product?: ProductSettings;
  booking?: BookingSettings;
}

export interface Catalog {
  items: Item[];
  shops: ShopView[];
  districts: string[];
  /** District name → reference id (for translated names). */
  districtIds: Record<string, string>;
  categories: {
    id: string;
    icon: string;
    tint: Tint;
    type: 'product' | 'service';
    name: string;
    nameKh: string;
  }[];
  deals: { id: string; shop: string; title: string; body: string; ends: number }[];
  promos: Promotion[];
}

export interface CartLine {
  pid: string;
  sel: Selection;
  qty: number;
  on: boolean;
}

export interface AppliedPromo {
  code: string;
  rule: Pick<Promotion, 'type' | 'value' | 'minSpend' | 'maxDiscount'>;
}

export interface ShopAddress {
  id: string;
  label: AddressLabel;
  name: string;
  phone: string;
  line: string;
  /** District name. */
  district: string;
  note?: string;
  /** Map pin, when picked on the map or by GPS. */
  lat?: number;
  lng?: number;
  isDefault: boolean;
}

export interface ShopOrderLine {
  pid: string;
  variantId?: string;
  title: string;
  sel: Selection;
  qty: number;
  unitPrice: number;
}

/**
 * A customer order (`GET /api/me/orders`) in the shape the customer screens use: the API order
 * plus the 5-step tracking timeline derived from its status and timestamps.
 */
export interface ShopOrder {
  id: string;
  /** Display number, 'VB-24038' (also the URL id). */
  number: string;
  /** Shop slug (`sk-fashion`). */
  businessId: string;
  shopName: string;
  /** When the shop got the order (ms). */
  at: number;
  lines: ShopOrderLine[];
  /** Before shop discounts. */
  subtotal: number;
  /** Shop (item) discounts. */
  discount: number;
  /** This order's share of the promo code discount. */
  promo: number;
  promoCode?: string;
  deliveryFee: number;
  total: number;
  payment: OrderPayment & { status: PaymentStatus };
  method: FulfilmentMethod;
  address?: OrderAddress & { label: AddressLabel };
  /** null = ASAP, otherwise the chosen 1-hour window "14:00–15:00". */
  window: string | null;
  note?: string;
  /** 1–5: placed, confirmed, preparing, on the way / ready, delivered / picked up. */
  step: number;
  /** When each step was reached (ms). */
  times: number[];
  status: OrderStatus;
  cancelledAt?: number;
  /** Reason code: customer.*, rejected.*, auto, paymentExpired, paymentCancelled, returned.*. */
  cancelReason?: string;
  /** The customer may still cancel (NEW and within 5 minutes). */
  canCancel: boolean;
  rider?: Rider;
  reviewed: boolean;
}

export interface ShopBooking {
  id: string;
  /** Display number, 'BK-02201' (also the URL id). */
  number: string;
  serviceId: string;
  businessId: string;
  staffId: string | null;
  /** Local midnight of the booked day (ms). */
  date: number;
  start: number;
  durationMin: number;
  price: number;
  status: AppointmentStatus;
  /** Replaced by a new booking ("Rescheduled"). */
  rescheduled?: boolean;
  note?: string;
  /** `client`, `rescheduled`, or the shop's decline / cancel reason code. */
  cancelReason?: string;
  /** The shop's note when it declined the request. */
  declineMessage?: string;
  /** The customer may still cancel or reschedule (until `freeCancelUntil`, ms). */
  canChange: boolean;
  freeCancelUntil: number;
}

/** Local inbox kinds (the welcome deal and promo); everything else comes from the API. */
export type NotifKind = 'deal' | 'promo';
export interface ShopNotif {
  id: string;
  /** A local kind, or a server kind (`ORDER_ACCEPTED`, …) for entries from the API. */
  kind: NotifKind | string;
  params: Record<string, string>;
  href: string;
  unread: boolean;
  at: number;
}

export interface BookingDraft {
  id: string;
  staff: string;
  day: number;
  slot: number | null;
}

export interface CheckoutDraft {
  method: FulfilmentMethod;
  addr?: string;
  when: 'asap' | 'later';
  slot: string;
  pay: PaymentMethod;
  note: string;
}
