// Wire types of the super-admin console (docs/api/phase7-admin.md).
import type { BusinessType } from '@/lib/domain';

export type PlatformRole = 'ADMIN' | 'SUPER_ADMIN';
export type Verification = 'PENDING' | 'VERIFIED' | 'REJECTED';

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
}

export interface Period {
  gmv: number;
  orders: number;
  commission: number;
  bookings: number;
  newUsers: number;
  newShops: number;
}

export type OverviewRange = 7 | 30 | 90;

export interface Overview {
  /** Length of `current` (and `previous`, the same span before it). */
  rangeDays: OverviewRange;
  today: Period;
  current: Period;
  previous: Period;
  counts: {
    users: number;
    shops: number;
    productShops: number;
    serviceShops: number;
    listings: number;
  };
  queues: {
    pendingVerifications: number;
    stuckOrders: number;
    payoutsDue: number;
    payoutShops: number;
    suspendedShops: number;
    suspendedUsers: number;
    lowReviews7d: number;
  };
  days: { date: string; gmv: number; orders: number }[];
  topShops: {
    id: string;
    name: string;
    type: BusinessType;
    logoUrl?: string;
    gmv: number;
    orders: number;
  }[];
  categories: { id: string; name: string; nameKh: string; gmv: number; orders: number }[];
}

/** `GET /api/admin/settings` (and the public `/api/meta/settings`). */
export interface PlatformSettings {
  commissionPct: number;
  payoutDelayDays: number;
  khrPerUsd: number;
  updatedAt: string;
  updatedBy?: string;
}

export interface AdminCategory {
  id: string;
  name: string;
  nameKh: string;
  icon: string;
  tint: 1 | 2 | 3 | 4 | 5 | 6;
  businessType: BusinessType;
  inMarketplace: boolean;
  shops: number;
}

export type CategoryInput = Partial<
  Pick<AdminCategory, 'businessType' | 'name' | 'nameKh' | 'icon' | 'tint' | 'inMarketplace'>
>;

export interface AuditEntry {
  id: string;
  actorId?: string;
  actorName: string;
  action: string;
  targetType:
    | 'USER'
    | 'BUSINESS'
    | 'ORDER'
    | 'REVIEW'
    | 'PROMOTION'
    | 'PAYOUT'
    | 'SETTINGS'
    | 'CATEGORY';
  targetId: string;
  targetLabel?: string;
  reason?: string;
  details?: Record<string, unknown>;
  at: string;
}

export interface ShopRow {
  id: string;
  name: string;
  slug: string;
  type: BusinessType;
  categoryId: string;
  district: string;
  logoUrl?: string;
  ownerId: string;
  ownerName: string;
  ownerContact?: string;
  verification: Verification;
  hasIdPhoto: boolean;
  online: boolean;
  suspendedAt?: string;
  rating: number;
  reviewCount: number;
  orders30: number;
  gmv30: number;
  createdAt: string;
}

export interface ShopDetail {
  shop: ShopRow;
  about?: string;
  phone: string;
  email?: string;
  street: string;
  bakongId?: string;
  verificationNote?: string;
  verifiedAt?: string;
  verifiedByName?: string;
  suspendedReason?: string;
  stats: {
    orders: number;
    gmv: number;
    bookings: number;
    products: number;
    services: number;
    paidOut: number;
    payable: number;
  };
  members: {
    userId?: string;
    name: string;
    role: string;
    title?: string;
    email?: string;
    phone?: string;
    active: boolean;
  }[];
  recentOrders: OrderRow[];
  history: AuditEntry[];
}

export interface UserRow {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  avatarUrl?: string;
  platformRole?: PlatformRole;
  suspendedAt?: string;
  orders: number;
  spent: number;
  businesses: number;
  createdAt: string;
}

export interface UserDetail {
  user: UserRow;
  signInMethods: string[];
  suspendedReason?: string;
  lastSeenAt?: string;
  activeSessions: number;
  bookings: number;
  reviews: number;
  businesses: {
    businessId: string;
    name: string;
    type: BusinessType;
    role: string;
    verification: Verification;
    suspendedAt?: string;
  }[];
  recentOrders: OrderRow[];
  history: AuditEntry[];
}

export interface OrderRow {
  id: string;
  number: string;
  status: string;
  method: 'DELIVERY' | 'PICKUP';
  total: number;
  paymentMethod?: string;
  paymentStatus?: string;
  businessId: string;
  shopName: string;
  /** Absent for a manual order the shop entered without an account. */
  customerId?: string;
  customerName: string;
  cancelReason?: string;
  at: string;
}

export interface OrderDetail {
  order: OrderRow;
  customerEmail?: string;
  customerPhone?: string;
  shopPhone?: string;
  address?: {
    label?: string;
    name?: string;
    phone?: string;
    line?: string;
    district?: string;
    note?: string;
  };
  note?: string;
  subtotal: number;
  discount: number;
  promoDiscount: number;
  promoCode?: string;
  deliveryFee: number;
  lines: { title: string; variantName?: string; qty: number; unitPrice: number }[];
  events: { status: string; note?: string; byName?: string; at: string }[];
  payment?: {
    method: string;
    channel: string;
    status: string;
    amount: number;
    commission: number;
    paidAt?: string;
    refundedAt?: string;
    payoutId?: string;
  };
  history: AuditEntry[];
}

export interface ReviewRow {
  id: string;
  businessId: string;
  shopName: string;
  targetType: 'PRODUCT' | 'SERVICE';
  itemName?: string;
  authorId?: string;
  authorName: string;
  stars: number;
  text?: string;
  tags: string[];
  reply?: string;
  verified: boolean;
  at: string;
  hiddenAt?: string;
  hiddenReason?: string;
}

export interface PayoutBalance {
  businessId: string;
  name: string;
  type: BusinessType;
  bakongId?: string;
  verification: Verification;
  suspended: boolean;
  payments: number;
  released: number;
  commission: number;
  takenBack: number;
  payable: number;
  onHold: number;
  lastPayoutAt?: string;
}

export interface Payout {
  id: string;
  businessId: string;
  shopName: string;
  gross: number;
  commission: number;
  amount: number;
  payments: number;
  bakongId: string;
  reference: string;
  note?: string;
  paidAt: string;
  paidByName?: string;
}

export type PromoType = 'PERCENT' | 'FIXED' | 'FREE_SHIPPING';
export type PromoState = 'SCHEDULED' | 'ACTIVE' | 'ENDED' | 'USED_UP';

export interface PlatformPromo {
  id: string;
  name: string;
  type: PromoType;
  value: number;
  code: string;
  scope: 'ALL' | 'CATEGORY' | 'PRODUCTS';
  targetIds: string[];
  minSpend?: number;
  maxDiscount?: number;
  startsAt: string;
  endsAt: string;
  uses: number;
  usageLimit?: number;
  state: PromoState;
}

export interface PromoInput {
  name?: string;
  type?: PromoType;
  value?: number;
  code?: string;
  scope?: 'ALL' | 'CATEGORY';
  targetIds?: string[];
  minSpend?: number;
  maxDiscount?: number;
  startsAt?: string;
  endsAt?: string;
  usageLimit?: number;
}
