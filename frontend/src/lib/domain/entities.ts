// Mirrors docs/db/domain-model.md § Entities. Field names and optionality match the doc.
// Conventions: IDs are strings; money is USD (number, 2 dp); instants are ISO-8601 UTC strings;
// times of day are minutes from midnight; calendar dates are 'YYYY-MM-DD'.
import type {
  AddressLabel,
  AppointmentSource,
  AppointmentStatus,
  BlockReason,
  BusinessType,
  CashMoveType,
  FulfilmentMethod,
  MemberRole,
  OrderStatus,
  PaymentChannel,
  PaymentMethod,
  ProductStatus,
  PromotionScope,
  PromotionType,
  SignInMethod,
  StockReason,
  VerificationStatus,
} from './enums';

export type Id = string;
/** ISO-8601 UTC instant, e.g. '2026-10-09T03:30:00.000Z'. */
export type Instant = string;
/** Calendar date in Asia/Phnom_Penh, 'YYYY-MM-DD'. */
export type IsoDate = string;
/** Minutes from midnight (630 = 10:30). */
export type Minutes = number;
/** USD amount with 2 decimal places. */
export type Usd = number;
/** [open, close] or [start, end] in minutes; null = closed / off. Index 0 = Monday. */
export type DayRange = [Minutes, Minutes] | null;
export type WeekRanges = [DayRange, DayRange, DayRange, DayRange, DayRange, DayRange, DayRange];

export interface User {
  id: Id;
  name: string;
  email?: string;
  phone?: string;
  avatarUrl?: string;
  /** Profile cover photo (`/api/files/{id}`). */
  coverUrl?: string;
  /** VirtualBiz staff only: opens the super-admin console (`/admin`). */
  platformRole?: 'ADMIN' | 'SUPER_ADMIN';
  signInMethods: SignInMethod[];
  createdAt: Instant;
}

export interface Address {
  id: Id;
  userId: Id;
  label: AddressLabel;
  name: string;
  phone: string;
  line: string;
  district: string;
  note?: string;
  /** Map pin (WGS84), when the user picked one. */
  lat?: number;
  lng?: number;
  isDefault: boolean;
}

export interface District {
  id: Id;
  name: string;
  /** Distance from the centre in km, used for distance sorting. */
  km: number;
}

/** Category tint index into the --t1..--t6 palette. */
export type Tint = 1 | 2 | 3 | 4 | 5 | 6;

export interface Category {
  id: Id;
  name: string;
  icon: string;
  tint: Tint;
  businessType: BusinessType;
}

export interface Closure {
  date: IsoDate;
  reason: string;
}

export interface DeliveryZone {
  label: string;
  districts: string[];
  fee: Usd;
}

export interface ProductSettings {
  autoAccept: boolean;
  prepMinutes: number;
  lowStockDefault: number;
  pickup: boolean;
  cod: boolean;
  freeDeliveryOver?: Usd;
  zones: DeliveryZone[];
  /** Days after delivery or pickup a return is accepted (default 7). */
  returnDays?: number;
}

/**
 * A shop's receipt text, VAT, counter payment methods and links (docs/api/phase11). Prices are
 * VAT-inclusive; `taxPct` shows the VAT inside a total on receipts.
 */
export interface ShopPolicy {
  receiptHeader?: string | null;
  receiptFooter?: string | null;
  taxPct: number;
  taxId?: string | null;
  payCash: boolean;
  payKhqr: boolean;
  payCard: boolean;
  facebook?: string | null;
  telegram?: string | null;
  instagram?: string | null;
  tiktok?: string | null;
  website?: string | null;
}

export interface BookingSettings {
  onlineBooking: boolean;
  autoConfirm: boolean;
  reminderHours: number;
  minNoticeHours: number;
  freeCancelHours: number;
  bufferMinutes: number;
  /** Start times every N minutes (default 30). */
  slotMinutes?: number;
  /** How many days ahead clients can book online (default 90). */
  maxDaysAhead?: number;
  /** Tip choices at checkout, percent (default 0, 5, 10, 15). */
  tipPresets?: number[];
}

interface BusinessBase {
  id: Id;
  ownerId: Id;
  type: BusinessType;
  name: string;
  slug: string;
  categoryId: Id;
  about?: string;
  phone: string;
  email?: string;
  district: string;
  street: string;
  /** Map pin (WGS84), when the owner picked one. */
  lat?: number;
  lng?: number;
  hours: WeekRanges;
  closures: Closure[];
  online: boolean;
  logoUrl?: string;
  coverUrl?: string;
  bakongId: string | null;
  verification: VerificationStatus;
  /** Why the ID check failed (REJECTED only). */
  verificationNote?: string;
  /** Set while VirtualBiz has suspended the shop (hidden, no new orders or bookings). */
  suspendedAt?: Instant;
  suspendedReason?: string;
  rating: number;
  reviewCount: number;
  since: Instant;
  /** Always complete from the API (defaults filled in). */
  policy?: ShopPolicy;
}

export interface ProductBusiness extends BusinessBase {
  type: 'PRODUCT';
  productSettings: ProductSettings;
}

export interface ServiceBusiness extends BusinessBase {
  type: 'SERVICE';
  bookingSettings: BookingSettings;
}

export type Business = ProductBusiness | ServiceBusiness;

export interface BusinessMember {
  id: Id;
  businessId: Id;
  userId?: Id;
  name: string;
  role: MemberRole;
  title?: string;
  color?: string;
  shifts: WeekRanges;
  active: boolean;
}

export interface ProductOption {
  name: string;
  values: string[];
}

export interface Variant {
  id: Id;
  productId: Id;
  options: Record<string, string>;
  price: Usd;
  compareAt?: Usd;
  cost?: Usd;
  sku: string;
  barcode: string;
  stock: number;
  swatch?: string;
}

export interface Product {
  id: Id;
  businessId: Id;
  title: string;
  description: string;
  categoryId: Id;
  status: ProductStatus;
  options: ProductOption[];
  variants: Variant[];
  photos: string[];
  lowStockAt: number;
  sold: number;
  rating: number;
}

export interface Service {
  id: Id;
  businessId: Id;
  name: string;
  category: string;
  durationMin: number;
  price: Usd;
  staffIds: Id[];
  bookableOnline: boolean;
  discountPct?: number;
}

export interface StockMovement {
  id: Id;
  variantId: Id;
  delta: number;
  reason: StockReason;
  byUserId: Id;
  note?: string;
  at: Instant;
}

export interface CartLine {
  id: Id;
  variantId: Id;
  qty: number;
  selected: boolean;
  savedForLater: boolean;
}

export interface OrderLine {
  variantId: Id;
  title: string;
  variantName: string;
  qty: number;
  unitPrice: Usd;
}

export interface OrderPayment {
  method: PaymentMethod;
  channel: PaymentChannel;
  paid: boolean;
}

/** Delivery address snapshot on an order. */
export type OrderAddress = Pick<Address, 'name' | 'phone' | 'line' | 'district' | 'note'>;

export interface Rider {
  name: string;
  vehicle: string;
  plate: string;
}

export interface Order {
  id: Id;
  /** Display number, 'VB-00001'. */
  number: string;
  businessId: Id;
  customerId: Id;
  lines: OrderLine[];
  subtotal: Usd;
  discount: Usd;
  promoCode?: string;
  deliveryFee: Usd;
  total: Usd;
  payment: OrderPayment;
  method: FulfilmentMethod;
  address?: OrderAddress;
  /** null/undefined = ASAP. */
  scheduledFor?: Instant | null;
  note?: string;
  status: OrderStatus;
  timeline: { status: OrderStatus; at: Instant }[];
  rider?: Rider;
  cancelReason?: string;
  reviewed: boolean;
  createdAt: Instant;
}

export interface Appointment {
  id: Id;
  /** Display number, 'BK-00001'. */
  number: string;
  businessId: Id;
  clientId: Id;
  serviceId: Id;
  staffId: Id;
  date: IsoDate;
  start: Minutes;
  durationMin: number;
  price: Usd;
  status: AppointmentStatus;
  source: AppointmentSource;
  note?: string;
  /** Activity log: a message code + parameters the client renders (`bookedOnline`, `moved`, …). */
  log: { code: string; params?: Record<string, string | number>; at: Instant }[];
  saleId?: Id;
}

export interface Block {
  id: Id;
  businessId: Id;
  staffId: Id;
  date: IsoDate;
  start: Minutes;
  durationMin: number;
  reason: BlockReason;
}

/** Per-business CRM record. Order count, spend and last visit are derived. */
export interface Client {
  id: Id;
  businessId: Id;
  name: string;
  phone: string;
  email?: string;
  note?: string;
  district?: string;
  since: Instant;
  tags: string[];
}
export type Customer = Client;

export interface PosSaleLine {
  variantId?: Id;
  serviceId?: Id;
  title: string;
  qty: number;
  unitPrice: Usd;
  staffId?: Id;
}

export interface PosSale {
  id: Id;
  /** Display number: 'R-00001' (seller receipt) or 'S-00001' (provider sale). */
  number: string;
  businessId: Id;
  shiftId: Id;
  lines: PosSaleLine[];
  subtotal: Usd;
  discount: Usd;
  tip: Usd;
  total: Usd;
  payments: { method: PaymentMethod; amount: Usd }[];
  cash?: { usd: Usd; khr: number; change: Usd };
  customerId?: Id;
  refunds: { at: Instant; amount: Usd; method: PaymentMethod; lines: PosSaleLine[] }[];
  at: Instant;
}

export interface Shift {
  id: Id;
  businessId: Id;
  openedBy: Id;
  openedAt: Instant;
  floatUsd: Usd;
  floatKhr: number;
  moves: { type: CashMoveType; amount: Usd; note: string }[];
  closedAt?: Instant;
  countedUsd?: Usd;
  difference?: Usd;
}

export interface Promotion {
  id: Id;
  /** null = platform-wide. */
  businessId: Id | null;
  name: string;
  type: PromotionType;
  value: number;
  /** null = automatic. */
  code: string | null;
  scope: PromotionScope;
  targetIds: Id[];
  minSpend?: Usd;
  maxDiscount?: Usd;
  startsAt: Instant;
  endsAt: Instant;
  uses: number;
  usageLimit?: number;
}

export interface Deal {
  id: Id;
  businessId: Id;
  title: string;
  body: string;
  discountPct?: number;
  serviceIds: Id[];
  startsAt: Instant;
  endsAt: Instant;
  views: number;
}

export interface Review {
  id: Id;
  businessId: Id;
  /** Product or service id. */
  targetId: Id;
  authorId: Id;
  stars: number;
  text: string;
  tags: string[];
  variantName?: string;
  verified: boolean;
  reply?: string;
  at: Instant;
}

export interface Notification {
  id: Id;
  userId: Id;
  text: string;
  route: string;
  unread: boolean;
  at: Instant;
}
