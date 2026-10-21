// The Service Provider workspace's endpoints (docs/api/phase2-catalog-inventory.md § Provider
// services, docs/api/phase4-bookings-provider.md) and the mappers to the workspace's shapes.
// Every call sends the open business as X-Business-Id.
import {
  api,
  type ApiAppointment,
  type ApiBlock,
  type ApiClient,
  type ApiDeal,
  type ApiMember,
  type ApiNotification,
  type ApiProviderService,
  type ApiSale,
  type ApiSellerProduct,
  type ApiShopReview,
  type AppointmentCreateInput,
  type AppointmentPatchInput,
  type DealInput,
  type MemberInput,
  type SaleInput,
  type ServiceInput,
} from '@/lib/api';
import type {
  AppointmentStatus,
  BlockReason,
  BookingSettings,
  Business,
  BusinessMember,
  Client,
  Product,
  Service,
  ServiceBusiness,
  WeekRanges,
} from '@/lib/domain';

import type {
  LogCode,
  ProviderAppointment,
  ProviderBusinessState,
  ProviderData,
  ProviderDeal,
  ProviderNotification,
  ProviderReview,
  ProviderSale,
} from './types';
import { policyOf } from '@/lib/shop';
import { STAFF_COLORS } from './types';

// ---- Mappers ------------------------------------------------------------------------------

export const toService = (s: ApiProviderService): Service => ({
  id: s.id,
  businessId: s.businessId,
  name: s.name,
  category: s.category,
  durationMin: s.durationMin,
  price: s.price,
  staffIds: s.staffIds,
  bookableOnline: s.bookableOnline,
  ...(s.discountPct ? { discountPct: s.discountPct } : {}),
  ...(s.description ? { description: s.description } : {}),
});

/** A colour for a member who never picked one (the owner added when the shop opened): the same one every time. */
const fallbackColor = (id: string) =>
  STAFF_COLORS[[...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 0) % STAFF_COLORS.length];

/** A member without shifts works the shop's opening hours; one without a colour gets one. */
export const toMember = (m: ApiMember, hours: WeekRanges): BusinessMember => ({
  id: m.id,
  businessId: m.businessId,
  ...(m.userId ? { userId: m.userId } : {}),
  name: m.name,
  role: m.role,
  ...(m.title ? { title: m.title } : {}),
  color: m.color || fallbackColor(m.id),
  shifts: m.shifts ?? hours,
  active: m.active,
});

export const toAppointment = (a: ApiAppointment): ProviderAppointment => ({
  id: a.id,
  number: a.number,
  businessId: a.businessId,
  clientId: a.clientId,
  serviceId: a.serviceId,
  staffId: a.staffId,
  date: a.date,
  start: a.start,
  durationMin: a.durationMin,
  price: a.price,
  status: a.status,
  source: a.source,
  ...(a.note ? { note: a.note } : {}),
  ...(a.saleId ? { saleId: a.saleId } : {}),
  ...(a.cancelReason ? { cancelReason: a.cancelReason } : {}),
  log: a.log.map((l) => ({
    code: l.code as LogCode,
    ...(l.params ? { params: l.params } : {}),
    at: l.at,
  })),
  createdAt: a.createdAt,
});

export const toClient = (c: ApiClient): Client => ({
  id: c.id,
  businessId: c.businessId,
  name: c.name,
  phone: c.phone,
  ...(c.email ? { email: c.email } : {}),
  ...(c.note ? { note: c.note } : {}),
  since: c.since,
  tags: [],
});

export const toSale = (s: ApiSale): ProviderSale => ({
  id: s.id,
  number: s.number,
  businessId: s.businessId,
  shiftId: '',
  lines: s.lines.map((l) => ({
    title: l.title,
    qty: l.qty,
    unitPrice: l.unitPrice,
    ...(l.serviceId ? { serviceId: l.serviceId } : {}),
    ...(l.variantId ? { variantId: l.variantId } : {}),
    ...(l.staffId ? { staffId: l.staffId } : {}),
  })),
  subtotal: s.subtotal,
  discount: s.discount,
  tip: s.tip,
  total: s.total,
  payments: s.payments,
  ...(s.cash
    ? { cash: { usd: s.cash.usd, khr: s.cash.khr ?? 0, change: s.cash.change ?? 0 } }
    : {}),
  ...(s.clientId ? { customerId: s.clientId } : {}),
  refunds: [],
  at: s.at,
  ...(s.appointmentId ? { appointmentId: s.appointmentId } : {}),
});

export const toBlock = (b: ApiBlock) => ({ ...b });

export const toDeal = (d: ApiDeal): ProviderDeal => ({
  id: d.id,
  businessId: d.businessId,
  title: d.title,
  body: d.body,
  discountPct: d.discountPct ?? 0,
  serviceIds: d.serviceIds,
  start: d.start,
  end: d.end,
  views: d.views,
});

export const toReview = (r: ApiShopReview, businessId: string): ProviderReview => ({
  id: r.id,
  businessId,
  targetId: r.targetId,
  authorName: r.authorName,
  stars: r.stars,
  text: r.text,
  tags: r.tags,
  ...(r.variantName ? { variantName: r.variantName } : {}),
  verified: r.verified,
  ...(r.reply ? { reply: r.reply } : {}),
  at: r.at,
});

export const toNotification = (n: ApiNotification): ProviderNotification => ({ ...n });

/** Retail items (the salon's catalogue products) as the checkout sells them. */
const toProduct = (p: ApiSellerProduct): Product => ({
  id: p.id,
  businessId: p.businessId,
  title: p.title,
  description: p.description,
  categoryId: p.categoryId,
  status: p.status,
  options: p.options,
  variants: p.variants.map((v) => ({
    id: v.id,
    productId: v.productId,
    options: v.options,
    price: v.price,
    sku: v.sku,
    barcode: v.barcode,
    stock: v.stock,
  })),
  photos: p.photos,
  lowStockAt: p.lowStockAt,
  sold: p.sold,
  rating: p.rating,
});

/** Booking settings the API documents as defaults, for a business that came without them. */
const DEFAULT_BOOKING: BookingSettings = {
  onlineBooking: true,
  autoConfirm: false,
  reminderHours: 24,
  minNoticeHours: 2,
  freeCancelHours: 2,
  bufferMinutes: 0,
  slotMinutes: 30,
  maxDaysAhead: 90,
  tipPresets: [0, 5, 10, 15],
};

/** The settings form's view of the API business. */
export function toBusinessState(b: Business, ownerName: string): ProviderBusinessState {
  const bs = { ...DEFAULT_BOOKING, ...((b.type === 'SERVICE' && b.bookingSettings) || {}) };
  return {
    id: b.id,
    ownerId: b.ownerId,
    type: 'SERVICE',
    name: b.name,
    slug: b.slug,
    categoryId: b.categoryId,
    about: b.about,
    phone: b.phone,
    email: b.email,
    address: b.street,
    district: b.district,
    ...(b.lat != null && b.lng != null ? { lat: b.lat, lng: b.lng } : {}),
    policy: policyOf(b.policy),
    hours: b.hours,
    closures: b.closures ?? [],
    online: bs.onlineBooking,
    logoUrl: b.logoUrl,
    coverUrl: b.coverUrl,
    bakongId: b.bakongId,
    verification: b.verification,
    rating: b.rating,
    reviewCount: b.reviewCount,
    since: b.since,
    ownerName,
    autoConfirm: bs.autoConfirm,
    minNoticeHours: bs.minNoticeHours,
    freeCancelHours: bs.freeCancelHours,
    bufferMinutes: bs.bufferMinutes,
    reminder: bs.reminderHours > 0,
    reminderHours: bs.reminderHours,
    slotMinutes: bs.slotMinutes ?? 30,
    maxDaysAhead: bs.maxDaysAhead ?? 90,
    tipPresets: bs.tipPresets ?? [0, 5, 10, 15],
    serviceCategories: bs.serviceCategories ?? [],
  } as ProviderBusinessState;
}

// ---- Reads --------------------------------------------------------------------------------

const opts = (businessId: string) => ({ businessId });

/** Everything the workspace shows, for the open business. */
export async function fetchWorkspace(b: Business): Promise<ProviderData> {
  const o = opts(b.id);
  const [members, services, products, clients, appointments, sales, blocks, deals, reviews, inbox] =
    await Promise.all([
      api.get<ApiMember[]>(`/businesses/${b.id}/members`, o),
      api.get<ApiProviderService[]>('/catalog/services', o),
      api.get<ApiSellerProduct[]>('/catalog/products', o),
      api.get<ApiClient[]>('/clients', o),
      api.get<ApiAppointment[]>('/appointments', o),
      api.get<ApiSale[]>('/sales', o),
      api.get<ApiBlock[]>('/blocks', o),
      api.get<ApiDeal[]>('/deals', o),
      api.get<ApiShopReview[]>('/reviews', o),
      api.get<ApiNotification[]>('/notifications', o),
    ]);
  const staff = members.filter((m) => m.active).map((m) => toMember(m, b.hours));
  const owner = staff.find((m) => m.role === 'OWNER');
  return {
    business: toBusinessState(b, owner?.name ?? b.name),
    staff,
    services: services.map(toService),
    products: products.map(toProduct),
    clients: clients.map(toClient),
    appointments: appointments.map(toAppointment),
    // Oldest first, as the prototype appends them.
    sales: sales.map(toSale).reverse(),
    blocks: blocks.map(toBlock),
    deals: deals.map(toDeal),
    reviews: reviews.filter((r) => r.targetType === 'SERVICE').map((r) => toReview(r, b.id)),
    notifications: inbox.map(toNotification),
  };
}

export const fetchServices = async (businessId: string) =>
  (await api.get<ApiProviderService[]>('/catalog/services', opts(businessId))).map(toService);

// ---- Services (Phase 2) -------------------------------------------------------------------

export const createService = async (businessId: string, input: ServiceInput) =>
  toService(await api.post<ApiProviderService>('/catalog/services', input, opts(businessId)));

export const patchService = async (businessId: string, id: string, input: ServiceInput) =>
  toService(
    await api.patch<ApiProviderService>(`/catalog/services/${id}`, input, opts(businessId)),
  );

export const deleteService = (businessId: string, id: string) =>
  api.delete<void>(`/catalog/services/${id}`, opts(businessId));

/** The input for a full create from an existing service (Undo of a delete). */
/** Renames a service category; its services move with it. Returns the shop's category list. */
export const renameServiceCategory = (businessId: string, from: string, to: string) =>
  api.post<string[]>('/catalog/services/categories/rename', { from, to }, opts(businessId));

export const serviceInput = (s: Service): ServiceInput => ({
  name: s.name,
  category: s.category,
  durationMin: s.durationMin,
  price: s.price,
  discountPct: s.discountPct ?? 0,
  staffIds: s.staffIds,
  bookableOnline: s.bookableOnline,
  description: s.description ?? '',
});

// ---- Appointments, blocks, clients, sales -------------------------------------------------

export const createAppointment = async (businessId: string, input: AppointmentCreateInput) =>
  toAppointment(await api.post<ApiAppointment>('/appointments', input, opts(businessId)));

export const patchAppointment = async (
  businessId: string,
  id: string,
  input: AppointmentPatchInput,
) => toAppointment(await api.patch<ApiAppointment>(`/appointments/${id}`, input, opts(businessId)));

export const setAppointmentStatus = async (
  businessId: string,
  id: string,
  status: AppointmentStatus,
  reason?: string,
) =>
  toAppointment(
    await api.post<ApiAppointment>(
      `/appointments/${id}/status`,
      { status, ...(reason ? { reason } : {}) },
      opts(businessId),
    ),
  );

export const undoAppointment = async (businessId: string, id: string) =>
  toAppointment(
    await api.post<ApiAppointment>(`/appointments/${id}/undo`, undefined, opts(businessId)),
  );

export const fetchAppointment = async (businessId: string, id: string) =>
  toAppointment(await api.get<ApiAppointment>(`/appointments/${id}`, opts(businessId)));

export const createBlock = async (
  businessId: string,
  input: { staffId: string; date: string; start: number; durationMin: number; reason: BlockReason },
) => toBlock(await api.post<ApiBlock>('/blocks', input, opts(businessId)));

export const deleteBlock = (businessId: string, id: string) =>
  api.delete<void>(`/blocks/${id}`, opts(businessId));

export const createClient = async (
  businessId: string,
  input: { name: string; phone: string; email?: string; note?: string },
) => toClient(await api.post<ApiClient>('/clients', input, opts(businessId)));

export const patchClient = async (
  businessId: string,
  id: string,
  input: { name?: string; phone?: string; email?: string; note?: string },
) => toClient(await api.patch<ApiClient>(`/clients/${id}`, input, opts(businessId)));

export const createSale = async (businessId: string, input: SaleInput) =>
  toSale(await api.post<ApiSale>('/sales', input, opts(businessId)));

// ---- Team, business settings, deals, reviews, inbox -----------------------------------------

export const addMember = async (businessId: string, input: MemberInput, hours: WeekRanges) =>
  toMember(
    await api.post<ApiMember>(`/businesses/${businessId}/members`, input, opts(businessId)),
    hours,
  );

export const patchMember = async (
  businessId: string,
  id: string,
  input: MemberInput,
  hours: WeekRanges,
) =>
  toMember(
    await api.patch<ApiMember>(`/businesses/${businessId}/members/${id}`, input, opts(businessId)),
    hours,
  );

/** `PATCH /api/businesses/{id}` (Phase 1): shop details, hours, closures, booking rules. */
export const patchBusiness = (businessId: string, input: Record<string, unknown>) =>
  api.patch<ServiceBusiness>(`/businesses/${businessId}`, input, opts(businessId));

export const createDeal = async (businessId: string, input: DealInput) =>
  toDeal(await api.post<ApiDeal>('/deals', input, opts(businessId)));

export const patchDeal = async (businessId: string, id: string, input: DealInput) =>
  toDeal(await api.patch<ApiDeal>(`/deals/${id}`, input, opts(businessId)));

export const deleteDeal = (businessId: string, id: string) =>
  api.delete<void>(`/deals/${id}`, opts(businessId));

export const replyReview = async (businessId: string, id: string, text: string) =>
  toReview(
    await api.post<ApiShopReview>(`/reviews/${id}/reply`, { text }, opts(businessId)),
    businessId,
  );

export const readNotification = (businessId: string, id: string) =>
  api.post<ApiNotification>(`/notifications/${id}/read`, undefined, opts(businessId));

export const readAllNotifications = (businessId: string) =>
  api.post<void>('/notifications/read-all', undefined, opts(businessId));

// ---- Business settings ----------------------------------------------------------------------

/** The `PATCH /api/businesses/{id}` body for a change to the settings form's fields. */
export function businessPatch(p: Partial<ProviderBusinessState>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (p.name !== undefined) out.name = p.name;
  if (p.about !== undefined) out.about = p.about;
  if (p.phone !== undefined) out.phone = p.phone;
  if (p.email !== undefined) out.email = p.email;
  if (p.address !== undefined) out.street = p.address;
  if (p.district !== undefined) out.district = p.district;
  if (p.lat !== undefined) out.lat = p.lat;
  if (p.lng !== undefined) out.lng = p.lng;
  if (p.policy !== undefined) out.policy = p.policy;
  if (p.hours !== undefined) out.hours = p.hours;
  if (p.closures !== undefined) out.closures = p.closures;
  // '' removes the photo; '' clears the Bakong ID too.
  if (p.bakongId !== undefined) out.bakongId = p.bakongId ?? '';
  if (p.logoUrl !== undefined) out.logoUrl = p.logoUrl;
  if (p.coverUrl !== undefined) out.coverUrl = p.coverUrl;
  const bs: Record<string, unknown> = {};
  if (p.online !== undefined) bs.onlineBooking = p.online;
  if (p.autoConfirm !== undefined) bs.autoConfirm = p.autoConfirm;
  if (p.minNoticeHours !== undefined) bs.minNoticeHours = p.minNoticeHours;
  if (p.freeCancelHours !== undefined) bs.freeCancelHours = p.freeCancelHours;
  if (p.bufferMinutes !== undefined) bs.bufferMinutes = p.bufferMinutes;
  if (p.reminderHours !== undefined) bs.reminderHours = p.reminderHours;
  else if (p.reminder !== undefined) bs.reminderHours = p.reminder ? 24 : 0;
  if (p.slotMinutes !== undefined) bs.slotMinutes = p.slotMinutes;
  if (p.maxDaysAhead !== undefined) bs.maxDaysAhead = p.maxDaysAhead;
  if (p.tipPresets !== undefined) bs.tipPresets = p.tipPresets;
  if (p.serviceCategories !== undefined) bs.serviceCategories = p.serviceCategories;
  if (Object.keys(bs).length) out.bookingSettings = bs;
  return out;
}
