// Mirrors docs/db/domain-model.md § Enums exactly. Wire values are UPPER_SNAKE strings.
// Each enum is a readonly tuple (iterable for selects/tests) plus a string-literal union.

export const BUSINESS_TYPES = ['PRODUCT', 'SERVICE'] as const;
export type BusinessType = (typeof BUSINESS_TYPES)[number];

export const MEMBER_ROLES = ['OWNER', 'MANAGER', 'STAFF'] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

export const VERIFICATION_STATUSES = ['PENDING', 'VERIFIED', 'REJECTED'] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const SIGN_IN_METHODS = ['PASSWORD', 'GOOGLE', 'EMAIL_CODE', 'PHONE_SMS'] as const;
export type SignInMethod = (typeof SIGN_IN_METHODS)[number];

export const OTP_PURPOSES = ['VERIFY', 'LOGIN', 'RESET', 'PHONE'] as const;
export type OtpPurpose = (typeof OTP_PURPOSES)[number];

export const PRODUCT_STATUSES = ['ACTIVE', 'DRAFT'] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export const ORDER_STATUSES = [
  'NEW',
  'ACCEPTED',
  'PACKED',
  'SHIPPED',
  'DELIVERED',
  'PICKED_UP',
  'CANCELLED',
  'RETURNED',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const FULFILMENT_METHODS = ['DELIVERY', 'PICKUP'] as const;
export type FulfilmentMethod = (typeof FULFILMENT_METHODS)[number];

export const DELIVERY_PROVIDERS = ['VIRTUALBIZ_RIDER', 'OWN_DELIVERY'] as const;
export type DeliveryProvider = (typeof DELIVERY_PROVIDERS)[number];

export const PAYMENT_METHODS = ['KHQR', 'CARD', 'CASH'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** DIRECT: paid to the shop itself (a manual order paid up front). */
export const PAYMENT_CHANNELS = ['ONLINE', 'COD', 'POS', 'DIRECT'] as const;
export type PaymentChannel = (typeof PAYMENT_CHANNELS)[number];

export const APPOINTMENT_STATUSES = [
  'REQUESTED',
  'BOOKED',
  'CONFIRMED',
  'ARRIVED',
  'STARTED',
  'COMPLETED',
  'NO_SHOW',
  'CANCELLED',
  'DECLINED',
] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export const APPOINTMENT_SOURCES = ['ONLINE', 'PHONE', 'WALK_IN'] as const;
export type AppointmentSource = (typeof APPOINTMENT_SOURCES)[number];

export const BLOCK_REASONS = ['LUNCH', 'BREAK', 'TRAINING', 'PERSONAL', 'CLEANING'] as const;
export type BlockReason = (typeof BLOCK_REASONS)[number];

export const STOCK_REASONS = [
  'RECEIVED',
  'COUNT_CORRECTION',
  'DAMAGED_LOST',
  'CUSTOMER_RETURN',
  'ORDER_CANCELLED',
  'ORDER_SALE',
  'POS_SALE',
  'POS_REFUND',
  'QUICK_ADJUST',
  'OPENING_STOCK',
  'MARKED_SOLD_OUT',
] as const;
export type StockReason = (typeof STOCK_REASONS)[number];

export const PROMOTION_TYPES = ['PERCENT', 'FIXED', 'FREE_SHIPPING'] as const;
export type PromotionType = (typeof PROMOTION_TYPES)[number];

export const PROMOTION_SCOPES = ['ALL', 'CATEGORY', 'PRODUCTS'] as const;
export type PromotionScope = (typeof PROMOTION_SCOPES)[number];

/** Derived from dates, uses and limit — never stored. See `promotionState` in lib/pricing. */
export const PROMOTION_STATES = ['ACTIVE', 'SCHEDULED', 'USED_UP', 'ENDED'] as const;
export type PromotionState = (typeof PROMOTION_STATES)[number];

export const ADDRESS_LABELS = ['HOME', 'WORK', 'OTHER'] as const;
export type AddressLabel = (typeof ADDRESS_LABELS)[number];

/** Shift cash-drawer move type (Shift.moves[].type). */
export const CASH_MOVE_TYPES = ['IN', 'OUT'] as const;
export type CashMoveType = (typeof CASH_MOVE_TYPES)[number];
