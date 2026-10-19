// Business rules ported from the Service Provider prototype (provider.html § Derived / Actions).
// Pure functions over ProviderData so they can be unit-tested and reused by every page.
import type { AppointmentStatus, BusinessMember, Client, IsoDate, Minutes } from '@/lib/domain';
import { round2 } from '@/lib/money';

import type {
  ProviderAppointment,
  ProviderBusinessState,
  ProviderData,
  ProviderSale,
} from '../types';
import { addDays, DAY_MS, dow, msOf, nowMin as clockNowMin, todayIso } from './time';

export const apptEnd = (a: Pick<ProviderAppointment, 'start' | 'durationMin'>) =>
  a.start + a.durationMin;

/** Not cancelled, no-show or declined (prototype `active`). */
export const isActive = (a: Pick<ProviderAppointment, 'status'>) =>
  a.status !== 'CANCELLED' && a.status !== 'NO_SHOW' && a.status !== 'DECLINED';

export const pending = (d: Pick<ProviderData, 'appointments'>) =>
  d.appointments.filter((a) => a.status === 'REQUESTED');

/** The happy path shown as the drawer's progress bar. */
export const FLOW: AppointmentStatus[] = ['BOOKED', 'CONFIRMED', 'ARRIVED', 'STARTED', 'COMPLETED'];

/**
 * Allowed status changes (AppointmentStatus, domain-model.md). Mirrors the prototype's drawer
 * actions; Undo restores the previous status directly and is not a transition.
 */
export const TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  REQUESTED: ['BOOKED', 'DECLINED'],
  BOOKED: ['CONFIRMED', 'ARRIVED', 'NO_SHOW', 'CANCELLED'],
  CONFIRMED: ['ARRIVED', 'NO_SHOW', 'CANCELLED'],
  ARRIVED: ['STARTED', 'COMPLETED', 'NO_SHOW', 'CANCELLED'],
  STARTED: ['COMPLETED'],
  COMPLETED: [],
  NO_SHOW: ['BOOKED'],
  CANCELLED: [],
  DECLINED: [],
};
export const canTransition = (from: AppointmentStatus, to: AppointmentStatus) =>
  TRANSITIONS[from].includes(to);

/** Drag is disabled for these (prototype `locked`). */
export const isLocked = (s: AppointmentStatus) =>
  s === 'COMPLETED' || s === 'NO_SHOW' || s === 'STARTED';

/** Staff working window on a date, clipped to opening hours; null when off or closed. */
export function shiftOf(
  business: Pick<ProviderBusinessState, 'closures' | 'hours'>,
  member: Pick<BusinessMember, 'shifts'> | undefined,
  date: IsoDate,
): [Minutes, Minutes] | null {
  if (!member) return null;
  if (business.closures.some((c) => c.date === date)) return null;
  const s = member.shifts[dow(date)];
  const h = business.hours[dow(date)];
  if (!s || !h) return null;
  return [Math.max(s[0], h[0]), Math.min(s[1], h[1])];
}

/** Opening hours on a date (null when closed or a closure day). */
export const openHoursOn = (
  business: Pick<ProviderBusinessState, 'closures' | 'hours'>,
  date: IsoDate,
) => (business.closures.some((c) => c.date === date) ? null : business.hours[dow(date)]);

export type Conflict =
  | { kind: 'appt'; name: string; from: Minutes; to: Minutes }
  | { kind: 'block'; reason: string; from: Minutes; to: Minutes }
  | { kind: 'notWorking'; name: string }
  | { kind: 'outside'; name: string; from: Minutes; to: Minutes };

export interface Slot {
  id?: string;
  staffId: string;
  date: IsoDate;
  start: Minutes;
  durationMin: number;
}

const firstName = (n: string) => n.split(' ')[0] ?? n;

/**
 * Prototype `conflicts(a, ignore)`: overlapping active bookings (requests don't block), blocks,
 * and the staff member's working hours. `ignore` defaults to the slot's own id.
 */
export function conflicts(d: ProviderData, a: Slot, ignore?: string): Conflict[] {
  const out: Conflict[] = [];
  const skip = ignore ?? a.id;
  const buffer = d.business.bufferMinutes;
  const end = a.start + a.durationMin;
  for (const b of d.appointments) {
    if (
      b.id !== skip &&
      isActive(b) &&
      b.status !== 'REQUESTED' &&
      b.staffId === a.staffId &&
      b.date === a.date &&
      a.start < apptEnd(b) + buffer &&
      b.start < end + buffer
    ) {
      const c = d.clients.find((x) => x.id === b.clientId);
      out.push({ kind: 'appt', name: c?.name ?? '', from: b.start, to: apptEnd(b) });
    }
  }
  for (const b of d.blocks) {
    if (
      b.staffId === a.staffId &&
      b.date === a.date &&
      a.start < b.start + b.durationMin &&
      b.start < end
    )
      out.push({ kind: 'block', reason: b.reason, from: b.start, to: b.start + b.durationMin });
  }
  const member = d.staff.find((m) => m.id === a.staffId);
  const sh = shiftOf(d.business, member, a.date);
  const name = firstName(member?.name ?? '');
  if (!sh) out.push({ kind: 'notWorking', name });
  else if (a.start < sh[0] || end > sh[1])
    out.push({ kind: 'outside', name, from: sh[0], to: sh[1] });
  return out;
}

export interface ClientStats {
  visits: number;
  spend: number;
  last?: IsoDate;
  next?: ProviderAppointment;
  noshow: number;
  cancels: number;
}

export function clientStats(
  d: Pick<ProviderData, 'appointments' | 'sales'>,
  clientId: string,
  today: IsoDate = todayIso(),
  now: Minutes = clockNowMin(),
): ClientStats {
  const as = d.appointments.filter((a) => a.clientId === clientId);
  const done = as.filter((a) => a.status === 'COMPLETED');
  const spend = d.sales.filter((s) => s.customerId === clientId).reduce((x, s) => x + s.total, 0);
  const last = done.reduce<IsoDate | undefined>(
    (m, a) => (!m || a.date > m ? a.date : m),
    undefined,
  );
  const next = as
    .filter(
      (a) =>
        isActive(a) &&
        a.status !== 'COMPLETED' &&
        (a.date > today || (a.date === today && apptEnd(a) > now)),
    )
    .sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start)[0];
  return {
    visits: done.length,
    spend,
    last,
    next,
    noshow: as.filter((a) => a.status === 'NO_SHOW').length,
    cancels: as.filter((a) => a.status === 'CANCELLED').length,
  };
}

export type Segment = 'vip' | 'new' | 'risk' | '';
export type ClientFilter = 'all' | 'vip' | 'new' | 'risk' | 'noshow';
export interface ClientRow {
  c: Client;
  st: ClientStats;
}

/** VIP = top 20% by spend; New = joined in the last 30 days; Risk = no visit for 3 weeks and nothing booked. */
export function segmenter(rows: ClientRow[], today: IsoDate, nowMs: number = Date.now()) {
  const spends = rows.map((r) => r.st.spend).sort((a, b) => b - a);
  const vipMin = spends[Math.max(0, Math.floor(rows.length * 0.2) - 1)] || 1;
  const todayMs = msOf(today);
  const tag = (r: ClientRow): Segment =>
    r.st.spend >= vipMin && r.st.spend > 0
      ? 'vip'
      : nowMs - Date.parse(r.c.since) < 30 * DAY_MS
        ? 'new'
        : r.st.last && todayMs - msOf(r.st.last) > 21 * DAY_MS && !r.st.next
          ? 'risk'
          : '';
  const filters: Record<ClientFilter, (r: ClientRow) => boolean> = {
    all: () => true,
    vip: (r) => tag(r) === 'vip',
    new: (r) => tag(r) === 'new',
    risk: (r) => tag(r) === 'risk',
    noshow: (r) => r.st.noshow > 0,
  };
  return { tag, filters };
}

/** Sales per day for the last `days` days, oldest first (prototype `revenueSeries`). */
export function revenueSeries(sales: ProviderSale[], days: number, today: IsoDate = todayIso()) {
  return Array.from({ length: days }, (_, i) => {
    const d = addDays(today, i - days + 1);
    const from = msOf(d);
    const v = sales
      .filter((s) => {
        const t = Date.parse(s.at);
        return t >= from && t < from + DAY_MS;
      })
      .reduce((x, s) => x + s.total, 0);
    return { d, v };
  });
}

/** Up to three free start times after the requested one (decline message suggestions). */
export function declineAlternatives(d: ProviderData, a: ProviderAppointment): Minutes[] {
  const alt: Minutes[] = [];
  for (let m = a.start + 15; m < a.start + 240 && alt.length < 3; m += 15) {
    if (!conflicts(d, { ...a, start: m }).length) alt.push(m);
  }
  return alt;
}

/** Staff for a booking when "First available" is chosen: first without a clash, else the first. */
export function pickStaff(
  d: ProviderData,
  serviceId: string,
  slot: Omit<Slot, 'staffId' | 'durationMin'>,
  ignore?: string,
) {
  const s = d.services.find((x) => x.id === serviceId);
  if (!s) return '';
  const free = s.staffIds.find(
    (x) => !conflicts(d, { ...slot, staffId: x, durationMin: s.durationMin }, ignore).length,
  );
  return free ?? s.staffIds[0] ?? '';
}

export interface CheckoutLine {
  title: string;
  price: number;
  staffId?: string;
  serviceId?: string;
  variantId?: string;
}

export interface CheckoutTotals {
  sub: number;
  discount: number;
  after: number;
  tip: number;
  total: number;
  /** Cash change (negative = short); null when not paying cash or nothing typed. */
  change: number | null;
}

/** Checkout maths (prototype `checkout().draw`). */
export function checkoutTotals(
  lines: CheckoutLine[],
  o: {
    disc: number;
    discType: '%' | '$';
    tipPct: number;
    tipCustom: number | null;
    pay: string;
    given: string;
  },
): CheckoutTotals {
  const sub = lines.reduce((x, i) => x + i.price, 0);
  const discount = +(o.discType === '%' ? (sub * o.disc) / 100 : Math.min(o.disc, sub)).toFixed(2);
  const after = +(sub - discount).toFixed(2);
  const tip = o.tipCustom !== null ? o.tipCustom : +((after * o.tipPct) / 100).toFixed(2);
  const total = +(after + tip).toFixed(2);
  const change = o.pay === 'CASH' && o.given !== '' ? +(+o.given - total).toFixed(2) : null;
  return { sub: round2(sub), discount, after, tip, total, change };
}

/** Quick cash amounts under "Cash received". */
export const cashChips = (total: number) =>
  [
    ...new Set([
      Math.ceil(total),
      Math.ceil(total / 5) * 5,
      Math.ceil(total / 10) * 10,
      Math.ceil(total / 20) * 20,
    ]),
  ].slice(0, 4);

/** Deal state by whole days. */
export const dealStatus = (deal: { start: IsoDate; end: IsoDate }, today: IsoDate) =>
  deal.end < today ? 'ended' : deal.start > today ? 'scheduled' : 'live';

/** Initials for avatars: "Try Dana" → "TD". */
export const initials = (n: string) =>
  n
    .split(/\s+/)
    .map((w) => w[0] ?? '')
    .slice(0, 2)
    .join('')
    .toUpperCase();

export { firstName };
