// Provider workspace model. Entities are the domain types (docs/db/domain-model.md) with a few
// local extensions the prototype needs and the domain doesn't carry yet (see each comment).
import type {
  Appointment,
  AppointmentStatus,
  BlockReason,
  BusinessMember,
  Client,
  Deal,
  Id,
  Instant,
  IsoDate,
  Minutes,
  PaymentMethod,
  PosSale,
  Product,
  Review,
  Service,
  ShopPolicy,
  ServiceBusiness,
  Block,
} from '@/lib/domain';

/**
 * Activity-log entry. The domain stores `{ text, at }`; the workspace stores a message code
 * plus parameters so the log renders in the viewer's language.
 */
export type LogCode =
  | 'bookedOnline'
  | 'bookedPhone'
  | 'bookedWalkin'
  | 'accepted'
  | 'declined'
  | 'confirmed'
  | 'arrived'
  | 'started'
  | 'reset'
  | 'noShow'
  | 'cancelled'
  | 'edited'
  | 'moved'
  | 'paid'
  | 'rescheduled';

export interface LogEntry {
  code: LogCode;
  params?: Record<string, string | number>;
  at: Instant;
}

export interface ProviderAppointment extends Omit<Appointment, 'log'> {
  log: LogEntry[];
  /** When the booking was made (the prototype's `created`; "requested 25 min ago"). */
  createdAt: Instant;
  /** Decline / cancel reason code (`fullyBooked`, `clientAsked`, `client`, `rescheduled`, …). */
  cancelReason?: string;
}

/** Sale with the appointment it closed (prototype `sale.appt`). */
export interface ProviderSale extends PosSale {
  appointmentId?: Id;
}

/** Deal with day-level dates (the prototype compares whole days). */
export interface ProviderDeal extends Omit<Deal, 'startsAt' | 'endsAt'> {
  start: IsoDate;
  end: IsoDate;
  discountPct: number;
}

export interface ProviderBusinessState extends Omit<
  ServiceBusiness,
  'bookingSettings' | 'street' | 'policy'
> {
  /** One-line address as the settings form edits it. */
  address: string;
  ownerName: string;
  autoConfirm: boolean;
  /** Minimum notice, hours. */
  minNoticeHours: number;
  /** Free cancellation until N hours before. */
  freeCancelHours: number;
  bufferMinutes: number;
  /** SMS reminder before the visit. */
  reminder: boolean;
  /** Hours before the visit the reminder goes (0 = off). */
  reminderHours: number;
  /** Start times every N minutes. */
  slotMinutes: number;
  /** How many days ahead clients can book online. */
  maxDaysAhead: number;
  /** Tip choices at checkout, percent. */
  tipPresets: number[];
  /** Service categories, in display order (the owner manages them). */
  serviceCategories: string[];
  /** Receipt, VAT, counter payment methods, links (defaults filled in). */
  policy: ShopPolicy;
}

/** The shop's inbox entry from the API (`BOOKING_REQUESTED`, `BOOKING_CANCELLED`, `NEW_REVIEW`, …). */
export interface ProviderNotification {
  id: Id;
  kind: string;
  params: Record<string, string>;
  /** Where the API says a tap goes (`/provider/calendar?date=…&appt=…`). */
  route: string;
  unread: boolean;
  at: Instant;
}

/** A review of one of the shop's services, with the reviewer's name. */
export interface ProviderReview extends Omit<Review, 'authorId'> {
  authorName: string;
}

export interface ProviderData {
  business: ProviderBusinessState;
  staff: BusinessMember[];
  services: Service[];
  products: Product[];
  clients: Client[];
  appointments: ProviderAppointment[];
  sales: ProviderSale[];
  blocks: Block[];
  deals: ProviderDeal[];
  reviews: ProviderReview[];
  notifications: ProviderNotification[];
}

export type { AppointmentStatus, BlockReason, Minutes, PaymentMethod };

export type CalendarView = 'day' | 'week';

/** Decline reasons (prototype select) — stored as codes, rendered translated. */
export const DECLINE_REASONS = ['fullyBooked', 'stylistNA', 'notOffered'] as const;
export const CANCEL_REASONS = ['clientAsked', 'stylistUnavailable', 'shopClosed'] as const;
export const SERVICE_CATEGORIES = ['Hair', 'Nails', 'Make-up'] as const;
export const STAFF_COLORS = [
  '#7C5CFA',
  '#D9558F',
  '#1F9C8B',
  '#E07B39',
  '#2F6FD6',
  '#8A9A1F',
] as const;
