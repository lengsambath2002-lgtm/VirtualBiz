import { describe, expect, it } from 'vitest';

import type { Block, BusinessMember, Client } from '@/lib/domain';

import type { ProviderAppointment, ProviderData } from '../types';
import {
  canTransition,
  cashChips,
  checkoutTotals,
  clientStats,
  conflicts,
  dealStatus,
  declineAlternatives,
  pickStaff,
  revenueSeries,
  segmenter,
  shiftOf,
} from './logic';
import { addDays, agoParts, dow, fmtD, fmtDL, hm, toMin, weekStart } from './time';

// A Wednesday.
const DAY = '2026-10-14';
const wk = (r: [number, number] | null) => [r, r, r, r, r, r, null] as BusinessMember['shifts'];

function data(over: Partial<ProviderData> = {}): ProviderData {
  const staff: BusinessMember[] = [
    {
      id: 'dana',
      businessId: 'b',
      name: 'Try Dana',
      role: 'OWNER',
      color: '#7C5CFA',
      shifts: wk([480, 1020]),
      active: true,
    },
    {
      id: 'vich',
      businessId: 'b',
      name: 'Vicheka Sok',
      role: 'STAFF',
      color: '#1F9C8B',
      shifts: wk([600, 1080]),
      active: true,
    },
  ];
  const clients: Client[] = [
    {
      id: 'c0',
      businessId: 'b',
      name: 'Chav Rada',
      phone: '096382813',
      since: '2026-01-01T00:00:00Z',
      tags: [],
    },
  ];
  return {
    business: {
      id: 'b',
      ownerId: 'u',
      type: 'SERVICE',
      name: 'Glow',
      slug: 'glow',
      categoryId: 'beauty',
      phone: '093828130',
      address: '',
      hours: wk([480, 1080]),
      closures: [],
      online: true,
      bakongId: 'x@aba',
      verification: 'VERIFIED',
      rating: 5,
      reviewCount: 0,
      since: '2021-01-01T00:00:00Z',
      ownerName: 'Try Dana',
      autoConfirm: false,
      minNoticeHours: 2,
      freeCancelHours: 2,
      bufferMinutes: 0,
      reminder: true,
    },
    staff,
    services: [
      {
        id: 'cut',
        businessId: 'b',
        name: 'Haircut & Style',
        category: 'Hair',
        durationMin: 45,
        price: 8,
        staffIds: ['dana', 'vich'],
        bookableOnline: true,
      },
    ],
    products: [],
    clients,
    appointments: [],
    sales: [],
    blocks: [],
    deals: [],
    reviews: [],
    notifications: [],
    ...over,
  };
}

const appt = (o: Partial<ProviderAppointment>): ProviderAppointment => ({
  id: 'a1',
  number: 'BK-00001',
  businessId: 'b',
  clientId: 'c0',
  serviceId: 'cut',
  staffId: 'dana',
  date: DAY,
  start: 600,
  durationMin: 45,
  price: 8,
  status: 'BOOKED',
  source: 'PHONE',
  log: [],
  createdAt: '2026-10-14T00:00:00Z',
  ...o,
});

describe('time helpers', () => {
  it('formats like the prototype (en-GB)', () => {
    expect(hm(570)).toBe('09:30');
    expect(toMin('14:45')).toBe(885);
    expect(fmtD(DAY, 'en')).toBe('Wed, 14 Oct');
    expect(fmtDL(DAY, 'en')).toBe('Wednesday 14 October');
    expect(fmtD(DAY, 'kh')).toBe('ព 14 តុលា');
  });
  it('does Monday-first week maths', () => {
    expect(dow(DAY)).toBe(2);
    expect(weekStart(DAY)).toBe('2026-10-12');
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
  });
  it('says "ago" like the prototype', () => {
    const now = Date.parse('2026-10-14T10:00:00Z');
    expect(agoParts(now - 25 * 60_000, now)).toEqual({ unit: 'min', n: 25 });
    expect(agoParts(now - 5 * 3_600_000, now)).toEqual({ unit: 'h', n: 5 });
    expect(agoParts(now - 30 * 3_600_000, now)).toEqual({ unit: 'yesterday' });
    expect(agoParts(now - 3 * 86_400_000, now)).toEqual({ unit: 'days', n: 3 });
  });
});

describe('shifts and conflicts', () => {
  it('clips the shift to opening hours and honours closures', () => {
    const d = data();
    expect(shiftOf(d.business, d.staff[1], DAY)).toEqual([600, 1080]);
    expect(
      shiftOf({ ...d.business, closures: [{ date: DAY, reason: 'x' }] }, d.staff[1], DAY),
    ).toBeNull();
    expect(shiftOf(d.business, d.staff[0], '2026-10-18')).toBeNull(); // Sunday
  });

  it('finds clashing bookings, blocks and hours; requests never block', () => {
    const block: Block = {
      id: 'b1',
      businessId: 'b',
      staffId: 'dana',
      date: DAY,
      start: 720,
      durationMin: 60,
      reason: 'LUNCH',
    };
    const d = data({
      appointments: [
        appt({ id: 'x', start: 600 }),
        appt({ id: 'r', start: 900, status: 'REQUESTED' }),
      ],
      blocks: [block],
    });
    expect(conflicts(d, { staffId: 'dana', date: DAY, start: 615, durationMin: 45 })).toEqual([
      { kind: 'appt', name: 'Chav Rada', from: 600, to: 645 },
    ]);
    expect(conflicts(d, { staffId: 'dana', date: DAY, start: 900, durationMin: 45 })).toEqual([]);
    expect(
      conflicts(d, { staffId: 'dana', date: DAY, start: 750, durationMin: 30 })[0],
    ).toMatchObject({ kind: 'block' });
    expect(conflicts(d, { staffId: 'dana', date: DAY, start: 1020, durationMin: 45 })).toEqual([
      { kind: 'outside', name: 'Try', from: 480, to: 1020 },
    ]);
    expect(
      conflicts(d, { staffId: 'dana', date: '2026-10-18', start: 600, durationMin: 45 }),
    ).toEqual([{ kind: 'notWorking', name: 'Try' }]);
  });

  it('applies the gap between bookings', () => {
    const d = data({ appointments: [appt({ id: 'x', start: 600 })] });
    d.business.bufferMinutes = 15;
    expect(conflicts(d, { staffId: 'dana', date: DAY, start: 645, durationMin: 30 })).toHaveLength(
      1,
    );
  });

  it('picks the first free stylist for "First available"', () => {
    const d = data({ appointments: [appt({ id: 'x', start: 660 })] });
    expect(pickStaff(d, 'cut', { date: DAY, start: 660 })).toBe('vich');
    expect(pickStaff(d, 'cut', { date: DAY, start: 480 })).toBe('dana');
  });

  it('suggests up to three free times when declining', () => {
    const d = data({ appointments: [appt({ id: 'x', start: 600 })] });
    const req = appt({ id: 'r', start: 600, status: 'REQUESTED' });
    d.appointments.push(req);
    expect(declineAlternatives(d, req).map(hm)).toEqual(['10:45', '11:00', '11:15']);
  });
});

describe('status transitions', () => {
  it('follows the domain flow', () => {
    expect(canTransition('REQUESTED', 'BOOKED')).toBe(true);
    expect(canTransition('BOOKED', 'STARTED')).toBe(false);
    expect(canTransition('ARRIVED', 'COMPLETED')).toBe(true);
    expect(canTransition('NO_SHOW', 'BOOKED')).toBe(true);
    expect(canTransition('COMPLETED', 'CANCELLED')).toBe(false);
  });
});

describe('checkout', () => {
  const lines = [
    { title: 'Haircut & Style', price: 8, staffId: 'dana' },
    { title: 'Cuticle oil pen', price: 5 },
  ];
  it('applies % / $ discounts, tip on the discounted amount, and cash change', () => {
    const o = {
      disc: 10,
      discType: '%' as const,
      tipPct: 10,
      tipCustom: null,
      pay: 'CASH',
      given: '20',
    };
    expect(checkoutTotals(lines, o)).toEqual({
      sub: 13,
      discount: 1.3,
      after: 11.7,
      tip: 1.17,
      total: 12.87,
      change: 7.13,
    });
    // $10 off, matches the prototype run: To pay $3.30, change $16.70.
    expect(checkoutTotals(lines, { ...o, discType: '$' })).toMatchObject({
      discount: 10,
      tip: 0.3,
      total: 3.3,
      change: 16.7,
    });
    expect(checkoutTotals(lines, { ...o, disc: 50, discType: '$' }).discount).toBe(13);
    expect(checkoutTotals(lines, { ...o, tipCustom: 2 }).tip).toBe(2);
    expect(checkoutTotals(lines, { ...o, pay: 'KHQR' }).change).toBeNull();
    expect(checkoutTotals(lines, { ...o, given: '5' }).change).toBeLessThan(0);
  });
  it('offers quick cash amounts', () => {
    expect(cashChips(12.87)).toEqual([13, 15, 20]);
    expect(cashChips(3.3)).toEqual([4, 5, 10, 20]);
  });
});

describe('clients and reports', () => {
  it('derives visits, spend, last visit and next booking', () => {
    const d = data({
      appointments: [
        appt({ id: 'p', date: '2026-10-01', status: 'COMPLETED' }),
        appt({ id: 'n', date: '2026-10-20', status: 'BOOKED' }),
        appt({ id: 'ns', date: '2026-10-02', status: 'NO_SHOW' }),
      ],
      sales: [
        {
          id: 's',
          number: 'S-1',
          businessId: 'b',
          shiftId: 'x',
          lines: [],
          subtotal: 8,
          discount: 0,
          tip: 1,
          total: 9,
          payments: [{ method: 'CASH', amount: 9 }],
          customerId: 'c0',
          refunds: [],
          at: '2026-10-01T03:00:00Z',
        },
      ],
    });
    const st = clientStats(d, 'c0', DAY, 600);
    expect(st).toMatchObject({ visits: 1, spend: 9, last: '2026-10-01', noshow: 1 });
    expect(st.next?.id).toBe('n');
    expect(revenueSeries(d.sales, 14, DAY).find((x) => x.d === '2026-10-01')?.v).toBe(9);
  });

  it('segments VIP (top 20%), new (30 days) and lapsed (3 weeks, nothing booked)', () => {
    const now = Date.parse('2026-10-14T03:00:00Z');
    const mk = (id: string, spend: number, since: string, last?: string, next = false) => ({
      c: { id, businessId: 'b', name: id, phone: '0', since, tags: [] } as Client,
      st: { visits: 1, spend, last, next: next ? appt({}) : undefined, noshow: 0, cancels: 0 },
    });
    const rows = [
      mk('a', 100, '2026-01-01T00:00:00Z', '2026-10-10'),
      mk('b', 10, '2026-10-01T00:00:00Z'),
      mk('c', 20, '2026-01-01T00:00:00Z', '2026-09-01'),
      mk('d', 20, '2026-01-01T00:00:00Z', '2026-09-01', true),
      mk('e', 5, '2026-01-01T00:00:00Z', '2026-10-12'),
    ];
    const { tag } = segmenter(rows, DAY, now);
    expect(rows.map(tag)).toEqual(['vip', 'new', 'risk', '', '']);
  });

  it('labels deals by day', () => {
    expect(dealStatus({ start: '2026-10-10', end: '2026-10-24' }, DAY)).toBe('live');
    expect(dealStatus({ start: '2026-11-03', end: '2026-11-10' }, DAY)).toBe('scheduled');
    expect(dealStatus({ start: '2026-09-04', end: '2026-10-04' }, DAY)).toBe('ended');
  });
});
