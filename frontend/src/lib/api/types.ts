// Wire types of API Phase 1 (docs/api/phase1-auth-account-business.md).
import type {
  AddressLabel,
  AppointmentSource,
  AppointmentStatus,
  BlockReason,
  BookingSettings,
  Business,
  BusinessType,
  Closure,
  DeliveryProvider,
  FulfilmentMethod,
  MemberRole,
  OrderStatus,
  PaymentChannel,
  PaymentMethod,
  ProductOption,
  ProductSettings,
  ProductStatus,
  PromotionType,
  StockReason,
  Tint,
  User,
  VerificationStatus,
  WeekRanges,
} from '@/lib/domain';

/** `AuthSession`: returned by every endpoint that signs in (plus the refresh cookie). */
export interface AuthSession {
  accessToken: string;
  /** Seconds the access token lasts (900). */
  expiresIn: number;
  user: User;
}

/** A code was sent. `devCode` is only present in local / dev profiles. */
export interface OtpSent {
  expiresAt: string;
  resendAt: string;
  devCode?: string | null;
}

export type OtpPurposeWire = 'VERIFY' | 'LOGIN' | 'RESET' | 'PHONE';

export interface LookupResult {
  exists: boolean;
  methods: User['signInMethods'];
}

export type PhoneVerifyResult =
  | { status: 'SIGNED_IN'; session: AuthSession }
  | { status: 'NEW'; phoneToken: string };

export interface Prefs {
  deals: boolean;
  promos: boolean;
}

/** `GET /api/me`. */
export type Me = User & { prefs: Prefs };

export interface ApiAddress {
  id: string;
  label: AddressLabel;
  name: string;
  phone: string;
  line: string;
  district: string;
  note?: string | null;
  lat?: number | null;
  lng?: number | null;
  isDefault: boolean;
}

export type AddressInput = Omit<ApiAddress, 'id' | 'isDefault'> & { isDefault?: boolean };

/** `GET /api/me/businesses`: a business the user is a member of. */
export interface MyBusiness {
  id: string;
  name: string;
  type: BusinessType;
  role: MemberRole;
  verification: VerificationStatus;
  logoUrl?: string | null;
}

/** `POST /api/businesses`. */
export interface CreateBusinessInput {
  type: BusinessType;
  name: string;
  categoryId: string;
  district: string;
  street: string;
  lat?: number;
  lng?: number;
  phone: string;
  hours: { open: string; close: string; sunday: boolean };
  bakongId?: string;
  idPhoto?: string;
}

export type ApiBusiness = Business;

// ---- Phase 2 (docs/api/phase2-catalog-inventory.md) ----------------------------------

/** `GET /api/meta/districts`. */
export interface ApiDistrict {
  id: string;
  name: string;
  km: number;
  lat?: number | null;
  lng?: number | null;
}

/** `GET /api/meta/categories`. */
export interface ApiCategory {
  id: string;
  name: string;
  /** Khmer name. */
  nameKh: string;
  icon: string;
  tint: Tint;
  businessType: BusinessType;
  inMarketplace: boolean;
}

export interface StaffRef {
  id: string;
  name: string;
  title?: string | null;
  color?: string | null;
}

/** `MarketShop`: a shop as customers see it. */
export interface MarketShop {
  id: string;
  slug: string;
  type: BusinessType;
  name: string;
  categoryId: string;
  icon: string;
  tint: Tint;
  about: string;
  /** Uploaded logo and cover (`/api/files/{id}`), when the shop has them. */
  logoUrl?: string | null;
  coverUrl?: string | null;
  phone: string;
  district: string;
  street: string;
  lat?: number | null;
  lng?: number | null;
  hours: WeekRanges;
  closures: Closure[];
  rating: number;
  reviewCount: number;
  since: string;
  replyMinutes?: number | null;
  etaMinutes?: [number, number] | null;
  openNow: boolean;
  distanceKm?: number | null;
  staff: StaffRef[];
  productSettings?: ProductSettings | null;
  bookingSettings?: BookingSettings | null;
}

export interface MarketVariant {
  id: string;
  productId: string;
  options: Record<string, string>;
  price: number;
  compareAt?: number | null;
  sku: string;
  stock: number;
  swatch?: string | null;
}

export interface MarketProduct {
  type: 'PRODUCT';
  id: string;
  slug: string;
  businessId: string;
  shopSlug: string;
  title: string;
  description: string;
  categoryId: string;
  options: ProductOption[];
  variants: MarketVariant[];
  photos: string[];
  specs: Record<string, string>;
  sold: number;
  rating: number;
}

export interface MarketService {
  type: 'SERVICE';
  id: string;
  slug: string;
  businessId: string;
  shopSlug: string;
  name: string;
  category: string;
  description: string;
  durationMin: number;
  price: number;
  discountPct?: number | null;
  staffIds: string[];
  sold: number;
  rating: number;
}

export type MarketItem = MarketProduct | MarketService;

export interface ListingReview {
  id: string;
  businessId: string;
  targetId: string;
  /** Slug of the product / service the review is about. */
  itemSlug: string;
  authorName: string;
  stars: number;
  text: string;
  tags: string[];
  variantName?: string | null;
  verified: boolean;
  reply?: string | null;
  at: string;
}

export interface MarketDeal {
  id: string;
  businessId: string;
  shopSlug: string;
  title: string;
  body: string;
  discountPct?: number | null;
  serviceIds: string[];
  startsAt: string;
  endsAt: string;
}

export interface SearchResult {
  items: MarketItem[];
  shops: MarketShop[];
}

/** `GET /api/me/saved`. */
export interface SavedEntry {
  key: string;
  type: 'PRODUCT' | 'SERVICE' | 'SHOP';
  id: string;
  savedAt: string;
}

export interface SellerVariant {
  id: string;
  productId: string;
  options: Record<string, string>;
  price: number;
  compareAt?: number | null;
  cost?: number | null;
  sku: string;
  barcode: string;
  stock: number;
  swatch?: string | null;
}

/** `SellerProduct`: the merchant view of a product. */
export interface ApiSellerProduct {
  id: string;
  slug: string;
  businessId: string;
  title: string;
  description: string;
  categoryId: string;
  collection?: string | null;
  status: ProductStatus;
  options: ProductOption[];
  variants: SellerVariant[];
  photos: string[];
  specs: Record<string, string>;
  lowStockAt: number;
  sold: number;
  rating: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProductInput {
  title: string;
  description?: string;
  collection?: string;
  status: ProductStatus;
  lowStockAt: number;
  options: ProductOption[];
  variants: {
    id?: string;
    options: Record<string, string>;
    price: number;
    compareAt?: number;
    cost?: number;
    sku?: string;
    barcode?: string;
    swatch?: string;
    stock?: number;
  }[];
  photos?: string[];
  specs?: Record<string, string>;
}

export interface ApiCollection {
  id?: string | null;
  name: string;
  productCount: number;
}

export interface ApiStockMovement {
  id: string;
  variantId: string;
  productId?: string | null;
  delta: number;
  reason: StockReason;
  byUserId?: string | null;
  byName?: string | null;
  note?: string | null;
  at: string;
}

export interface VariantStock {
  id: string;
  productId: string;
  stock: number;
}

export interface StockWriteResult {
  movement: ApiStockMovement;
  variant: VariantStock;
  merged: boolean;
}

/** `ProviderService`. */
export interface ApiProviderService {
  id: string;
  slug: string;
  businessId: string;
  name: string;
  category: string;
  description: string;
  durationMin: number;
  price: number;
  discountPct?: number | null;
  staffIds: string[];
  bookableOnline: boolean;
  sold: number;
  rating: number;
}

export interface ServiceInput {
  name?: string;
  category?: string;
  description?: string;
  durationMin?: number;
  price?: number;
  discountPct?: number;
  staffIds?: string[];
  bookableOnline?: boolean;
}

/** `GET /api/businesses/{id}/members`. */
export interface ApiMember {
  id: string;
  businessId: string;
  userId?: string | null;
  name: string;
  role: MemberRole;
  title?: string | null;
  color?: string | null;
  shifts?: WeekRanges | null;
  active: boolean;
}

// ---- Phase 3 (docs/api/phase3-orders-checkout.md) -------------------------------------

/** `CartLine` of the server cart. */
export interface ApiCartLine {
  variantId: string;
  productId: string;
  productSlug: string;
  shopSlug: string;
  options: Record<string, string>;
  qty: number;
  selected: boolean;
}

export interface ApiCart {
  lines: ApiCartLine[];
  later: ApiCartLine[];
}

export interface CartInput {
  lines: { variantId: string; qty: number; selected?: boolean }[];
  later?: { variantId: string; qty: number }[];
}

export type PromoReason =
  | 'UNKNOWN'
  | 'SCHEDULED'
  | 'ENDED'
  | 'USED_UP'
  | 'MIN_SPEND'
  | 'NOT_APPLICABLE';

export interface CheckoutInput {
  lines: { variantId: string; qty: number }[];
  method?: FulfilmentMethod;
  addressId?: string;
  district?: string;
  window?: string | null;
  note?: string;
  promoCode?: string;
  paymentMethod?: PaymentMethod;
}

export interface QuoteLine {
  variantId: string;
  productId: string;
  productSlug: string;
  title: string;
  variantName: string;
  options: Record<string, string>;
  qty: number;
  listPrice: number;
  unitPrice: number;
  lineTotal: number;
  stock: number;
}

export interface QuoteShop {
  businessId: string;
  shopSlug: string;
  shopName: string;
  lines: QuoteLine[];
  subtotal: number;
  discount: number;
  promoDiscount: number;
  deliveryFee: number;
  deliveryWaived: boolean;
  freeDeliveryOver?: number | null;
  toFreeDelivery: number;
  total: number;
  pickup: boolean;
  cod: boolean;
  /** The shop's automatic promotion (Phase 5); its amount is part of `promoDiscount`. */
  autoPromo?: { id: string; name: string; amount: number; freeShipping: boolean } | null;
}

export interface QuotePromo {
  code: string;
  name?: string | null;
  type?: PromotionType | null;
  value?: number | null;
  minSpend?: number | null;
  maxDiscount?: number | null;
  businessId?: string | null;
  applied: boolean;
  reason?: PromoReason | null;
  shortBy?: number | null;
}

export interface Quote {
  method: FulfilmentMethod;
  district?: string | null;
  count: number;
  subtotal: number;
  discount: number;
  promoDiscount: number;
  deliveryFee: number;
  total: number;
  shops: QuoteShop[];
  promo?: QuotePromo | null;
  problems: {
    field: string;
    code: 'INSUFFICIENT_STOCK' | 'VARIANT_NOT_FOUND';
    variantId: string;
    stock?: number | null;
  }[];
}

export type PaymentStatus = 'PENDING' | 'PAID' | 'REFUNDED' | 'CANCELLED' | 'EXPIRED';
export type IntentStatus = 'PENDING' | 'PAID' | 'EXPIRED' | 'CANCELLED' | 'FAILED';

export interface ApiOrderPayment {
  method: PaymentMethod;
  channel: PaymentChannel;
  status: PaymentStatus;
  paid: boolean;
  amount: number;
  paidAt?: string | null;
}

export interface PaymentIntent {
  id: string;
  method: 'KHQR' | 'CARD';
  status: IntentStatus;
  amount: number;
  currency: 'USD';
  khqr?: string | null;
  md5?: string | null;
  expiresAt?: string | null;
  paidAt?: string | null;
  orderNumbers: string[];
}

export interface ApiOrderLine {
  variantId: string;
  productId: string;
  productSlug: string;
  title: string;
  variantName: string;
  options: Record<string, string>;
  sku: string;
  qty: number;
  listPrice: number;
  unitPrice: number;
}

/** `Order`: one shop's order (customer and seller views). */
export interface ApiOrder {
  id: string;
  number: string;
  checkoutId?: string | null;
  businessId: string;
  shop: { id: string; slug: string; name: string; phone: string; street: string; district: string };
  /** `id` is absent for a manual order without a VirtualBiz account. */
  customer?: {
    id?: string | null;
    name: string;
    phone?: string | null;
    email?: string | null;
  } | null;
  status: OrderStatus;
  method: FulfilmentMethod;
  lines: ApiOrderLine[];
  subtotal: number;
  discount: number;
  promoDiscount: number;
  promoCode?: string | null;
  deliveryFee: number;
  total: number;
  payment: ApiOrderPayment;
  paymentIntentId?: string | null;
  address?: {
    label: AddressLabel;
    name: string;
    phone: string;
    line: string;
    district: string;
    note?: string | null;
    lat?: number | null;
    lng?: number | null;
  } | null;
  window?: string | null;
  scheduledFor?: string | null;
  note?: string | null;
  deliveryBy?: DeliveryProvider | null;
  rider?: { name: string; vehicle: string; plate: string } | null;
  timeline: { status: OrderStatus; at: string; note?: string | null }[];
  createdAt: string;
  placedAt?: string | null;
  acceptedAt?: string | null;
  packedAt?: string | null;
  shippedAt?: string | null;
  fulfilledAt?: string | null;
  cancelledAt?: string | null;
  returnedAt?: string | null;
  cancelReason?: string | null;
  cancelDeadline?: string | null;
  canCancel: boolean;
  autoCancelAt?: string | null;
  reviewed: boolean;
  /** ONLINE, or the channel a manual order came from (PHONE, FACEBOOK, TELEGRAM, WALK_IN, OTHER). */
  source?: OrderSource;
}

export type OrderSource = 'ONLINE' | 'PHONE' | 'FACEBOOK' | 'TELEGRAM' | 'WALK_IN' | 'OTHER';

export interface CheckoutResult {
  checkoutId: string;
  orders: ApiOrder[];
  payment?: PaymentIntent | null;
}

export interface BulkResult {
  orders: ApiOrder[];
  skipped: string[];
}

/** `Notification` (customer or shop inbox). */
export interface ApiNotification {
  id: string;
  kind: string;
  params: Record<string, string>;
  route: string;
  unread: boolean;
  at: string;
}

// ---- Phase 4 (docs/api/phase4-bookings-provider.md) -----------------------------------

/** One line of an appointment's activity log; the client renders `code` with `params`. */
export interface ApiAppointmentLog {
  code: string;
  params?: Record<string, string> | null;
  at: string;
}

/** `Appointment` (the provider's calendar). */
export interface ApiAppointment {
  id: string;
  number: string;
  businessId: string;
  clientId: string;
  client?: { id: string; name: string; phone: string; email?: string | null } | null;
  serviceId: string;
  serviceName: string;
  staffId: string;
  date: string;
  start: number;
  durationMin: number;
  price: number;
  status: AppointmentStatus;
  source: AppointmentSource;
  note?: string | null;
  saleId?: string | null;
  rescheduled: boolean;
  cancelReason?: string | null;
  log: ApiAppointmentLog[];
  createdAt: string;
}

export interface AppointmentCreateInput {
  clientId?: string;
  client?: { name: string; phone: string; email?: string };
  serviceId: string;
  staffId: string;
  date: string;
  start: number;
  source: 'PHONE' | 'WALK_IN';
  note?: string;
}

export interface AppointmentPatchInput {
  serviceId?: string;
  staffId?: string;
  date?: string;
  start?: number;
  note?: string;
}

/** `Block`. */
export interface ApiBlock {
  id: string;
  businessId: string;
  staffId: string;
  date: string;
  start: number;
  durationMin: number;
  reason: BlockReason;
}

/** `Client` (a service business's client). */
export interface ApiClient {
  id: string;
  businessId: string;
  name: string;
  phone: string;
  email?: string | null;
  note?: string | null;
  district?: string | null;
  since: string;
  userId?: string | null;
}

export interface ApiSaleLine {
  serviceId?: string | null;
  variantId?: string | null;
  title: string;
  qty: number;
  unitPrice: number;
  staffId?: string | null;
}

/** `Sale` (the provider's checkout). */
export interface ApiSale {
  id: string;
  number: string;
  businessId: string;
  appointmentId?: string | null;
  clientId?: string | null;
  lines: ApiSaleLine[];
  subtotal: number;
  discount: number;
  tip: number;
  total: number;
  payments: { method: PaymentMethod; amount: number }[];
  cash?: { usd: number; khr?: number | null; change?: number | null } | null;
  byName?: string | null;
  at: string;
}

export interface SaleInput {
  appointmentId?: string;
  clientId?: string;
  lines: {
    serviceId?: string;
    variantId?: string;
    title: string;
    qty: number;
    unitPrice: number;
    staffId?: string;
  }[];
  discount: number;
  tip: number;
  payments: { method: PaymentMethod; amount: number }[];
  cash?: { usd: number; khr: number; change: number };
}

/** `Deal` as the shop edits it (whole Phnom Penh days). */
export interface ApiDeal {
  id: string;
  businessId: string;
  title: string;
  body: string;
  discountPct?: number | null;
  serviceIds: string[];
  start: string;
  end: string;
  startsAt: string;
  endsAt: string;
  views: number;
}

export interface DealInput {
  title?: string;
  body?: string;
  discountPct?: number;
  serviceIds?: string[];
  start?: string;
  end?: string;
}

/** A review as its shop sees it (`GET /api/reviews`). */
export interface ApiShopReview {
  id: string;
  targetType: 'PRODUCT' | 'SERVICE';
  targetId: string;
  authorName: string;
  stars: number;
  text: string;
  tags: string[];
  variantName?: string | null;
  verified: boolean;
  reply?: string | null;
  at: string;
}

export interface MemberInput {
  name?: string;
  title?: string;
  color?: string;
  shifts?: WeekRanges | null;
  active?: boolean;
}

/** Free times of a service (public). */
export interface ApiAvailability {
  serviceId: string;
  durationMin: number;
  step: number;
  days: { date: string; open: boolean; slots: { start: number; staffIds: string[] }[] }[];
}

/** The customer's `Booking`. */
export interface ApiBooking {
  id: string;
  number: string;
  status: AppointmentStatus;
  rescheduled: boolean;
  cancelReason?: string | null;
  service: { id: string; slug: string; name: string };
  shop: { id: string; slug: string; name: string; phone: string; street: string; district: string };
  staff?: { id: string; name: string } | null;
  date: string;
  start: number;
  durationMin: number;
  price: number;
  note?: string | null;
  createdAt: string;
  freeCancelUntil: string;
  canChange: boolean;
}

export interface BookingInput {
  service: string;
  staffId?: string;
  date: string;
  start: number;
  name: string;
  phone: string;
  note?: string;
  replaces?: string;
}

// ---- Phase 5 (docs/api/phase5-pos-promotions-reviews.md) ------------------------------

/** A register shift. */
export interface ApiShift {
  id: string;
  openedAt: string;
  openedBy?: string | null;
  openedByName: string;
  floatUsd: number;
  floatKhr: number;
  moves: { amount: number; note: string; at: string; byName?: string | null }[];
  cashSales: number;
  cashRefunds: number;
  expectedUsd: number;
  closedAt?: string | null;
  closedByName?: string | null;
  countedUsd?: number | null;
  difference?: number | null;
}

/** A counter receipt (`R-…`). */
export interface ApiPosSale {
  id: string;
  clientRef?: string | null;
  number: string;
  shiftId?: string | null;
  lines: {
    productId?: string | null;
    variantId: string;
    title: string;
    variantName: string;
    qty: number;
    unitPrice: number;
  }[];
  subtotal: number;
  discount: number;
  discountReason?: string | null;
  total: number;
  payments: { method: PaymentMethod; amount: number }[];
  cash?: { usd: number; khr?: number | null; change?: number | null } | null;
  customerName?: string | null;
  byName?: string | null;
  refunds: {
    at: string;
    amount: number;
    method: PaymentMethod;
    restock: boolean;
    lines: { variantId: string; qty: number }[];
    byName?: string | null;
  }[];
  at: string;
}

export interface PosSaleInput {
  clientRef: string;
  lines: { variantId: string; qty: number; unitPrice: number }[];
  discount: number;
  discountReason?: string;
  customerName?: string;
  payments: { method: PaymentMethod; amount: number }[];
  cash?: { usd: number; khr: number; change: number };
  at?: string;
}

/** A shop's promotion. */
export interface ApiPromotion {
  id: string;
  businessId?: string | null;
  name: string;
  type: PromotionType;
  value: number;
  code?: string | null;
  scope: 'ALL' | 'CATEGORY' | 'PRODUCTS';
  targetIds: string[];
  minSpend?: number | null;
  maxDiscount?: number | null;
  startsAt: string;
  endsAt: string;
  uses: number;
  usageLimit?: number | null;
  state: 'ACTIVE' | 'SCHEDULED' | 'USED_UP' | 'ENDED';
}

export interface PromotionInput {
  name?: string;
  type?: PromotionType;
  value?: number;
  code?: string;
  scope?: 'ALL' | 'CATEGORY' | 'PRODUCTS';
  targetIds?: string[];
  minSpend?: number;
  maxDiscount?: number;
  startsAt?: string;
  endsAt?: string;
  usageLimit?: number;
}

/** A review the customer wrote. */
export interface ApiMyReview {
  id: string;
  orderNumber?: string | null;
  bookingNumber?: string | null;
  itemSlug: string;
  itemType: 'PRODUCT' | 'SERVICE';
  stars: number;
  tags: string[];
  text: string;
  reply?: string | null;
  at: string;
}

export interface ReviewInput {
  order?: string;
  booking?: string;
  item: string;
  stars: number;
  tags?: string[];
  text?: string;
}
