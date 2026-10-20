// Calendar maths for the provider workspace. Dates are 'YYYY-MM-DD' in Asia/Phnom_Penh and
// times of day are minutes from midnight (domain-model.md § Conventions). Phnom Penh is
// UTC+7 all year, so date arithmetic is done on UTC dates.
import type { IsoDate, Minutes } from '@/lib/domain';
import { DISPLAY_TIME_ZONE } from '@/lib/i18n/config';

export const DAY_MS = 86_400_000;
/**
 * The calendar's first and last hour: the shop's opening hours and staff shifts, rounded out to
 * whole hours (07–21 until a shop sets hours). Live bindings: {@link setCalendarRange} updates them.
 */
// eslint-disable-next-line import/no-mutable-exports
export let H0 = 7;
// eslint-disable-next-line import/no-mutable-exports
export let H1 = 21;

/** Fit the calendar to the earliest opening / start and latest closing / end of the week. */
export function setCalendarRange(
  hours: readonly (readonly [number, number] | null | undefined)[],
  shifts: readonly (
    | readonly (readonly [number, number] | null | undefined)[]
    | null
    | undefined
  )[] = [],
) {
  const ranges = [...hours, ...shifts.flatMap((s) => s ?? [])].filter(
    (r): r is readonly [number, number] => !!r,
  );
  if (!ranges.length) return;
  H0 = Math.max(0, Math.floor(Math.min(...ranges.map((r) => r[0])) / 60));
  H1 = Math.min(24, Math.max(H0 + 1, Math.ceil(Math.max(...ranges.map((r) => r[1])) / 60)));
}

/** Every quarter-hour start the calendar shows. */
export const calendarStarts = () =>
  Array.from({ length: (H1 - H0) * 4 }, (_, i) => H0 * 60 + i * 15);
/** 48 px per hour. */
export const PXM = 48 / 60;
/** Pixel offset of a time inside a calendar column. */
export const topOf = (m: Minutes) => (m - H0 * 60) * PXM;

const PP_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: DISPLAY_TIME_ZONE });
const PP_TIME = new Intl.DateTimeFormat('en-GB', {
  timeZone: DISPLAY_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** Phnom Penh calendar date of an instant (ms). */
export const isoOf = (ms: number): IsoDate => PP_DATE.format(new Date(ms));
/** Phnom Penh minutes past midnight of an instant (ms). */
export const minOf = (ms: number): Minutes => {
  const [h = 0, m = 0] = PP_TIME.format(new Date(ms)).split(':').map(Number);
  return h * 60 + m;
};
export const todayIso = (): IsoDate => isoOf(Date.now());
export const nowMin = (): Minutes => minOf(Date.now());

/** Midnight (Phnom Penh) of a date, as ms. */
export const msOf = (iso: IsoDate): number => Date.parse(iso + 'T00:00:00+07:00');
/** ISO instant of `minutes` past midnight on `iso`. */
export const instantAt = (iso: IsoDate, minutes: Minutes): string =>
  new Date(msOf(iso) + minutes * 60_000).toISOString();

export const addDays = (iso: IsoDate, n: number): IsoDate => {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
/** Whole days from `a` to `b`. */
export const daysBetween = (a: IsoDate, b: IsoDate) =>
  Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / DAY_MS);
/** Monday = 0 … Sunday = 6. */
export const dow = (iso: IsoDate) => (new Date(iso + 'T00:00:00Z').getUTCDay() + 6) % 7;
/** Monday of the week containing `iso`. */
export const weekStart = (iso: IsoDate) => addDays(iso, -dow(iso));
export const isIsoDate = (v: unknown): v is IsoDate =>
  typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));

/** "09:30" */
export const hm = (m: Minutes) =>
  String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
/** "09:30" → 570 */
export const toMin = (s: string): Minutes => {
  const [h = 0, m = 0] = s.split(':').map(Number);
  return h * 60 + m;
};

/** Intl locale for dates: the prototype formats with en-GB ("Wed, 14 Oct"). */
export const dateLocale = (locale: string) => (locale === 'kh' ? 'km-KH' : 'en-GB');

// Khmer names, written out because many runtimes ship without km-KH date data.
const KM_MONTHS = [
  'មករា',
  'កុម្ភៈ',
  'មីនា',
  'មេសា',
  'ឧសភា',
  'មិថុនា',
  'កក្កដា',
  'សីហា',
  'កញ្ញា',
  'តុលា',
  'វិច្ឆិកា',
  'ធ្នូ',
];
/** Sunday first, as Date#getUTCDay. */
const KM_DAYS = ['អាទិត្យ', 'ច័ន្ទ', 'អង្គារ', 'ពុធ', 'ព្រហស្បតិ៍', 'សុក្រ', 'សៅរ៍'];
const KM_DAYS_SHORT = ['អា', 'ច', 'អ', 'ព', 'ព្រ', 'សុ', 'ស'];
interface KmParts {
  wd: string;
  wdl: string;
  d: number;
  m: string;
  y: number;
}
const km = (dt: Date): KmParts => ({
  wd: KM_DAYS_SHORT[dt.getUTCDay()]!,
  wdl: 'ថ្ងៃ' + KM_DAYS[dt.getUTCDay()]!,
  d: dt.getUTCDate(),
  m: KM_MONTHS[dt.getUTCMonth()]!,
  y: dt.getUTCFullYear(),
});
const isKh = (locale: string) => locale === 'kh';
const dateFmt = (locale: string, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(dateLocale(locale), { timeZone: 'UTC', ...opts });
const utc = (iso: IsoDate) => new Date(iso + 'T00:00:00Z');
/** Phnom Penh wall-clock of an instant, as a UTC Date (for the Khmer formatter). */
const ppWall = (at: string) => new Date(Date.parse(at) + 7 * 3_600_000);

/** "Wed, 14 Oct" */
export const fmtD = (iso: IsoDate, locale: string) => {
  if (isKh(locale)) {
    const p = km(utc(iso));
    return `${p.wd} ${p.d} ${p.m}`;
  }
  const part = (o: Intl.DateTimeFormatOptions) => dateFmt(locale, o).format(utc(iso));
  // Assembled from parts: runtimes disagree on the comma in en-GB ("Wed, 14 Oct").
  return `${part({ weekday: 'short' })}, ${part({ day: 'numeric' })} ${part({ month: 'short' })}`;
};
/** "Wednesday 14 October" */
export const fmtDL = (iso: IsoDate, locale: string) => {
  if (isKh(locale)) {
    const p = km(utc(iso));
    return `${p.wdl} ${p.d} ${p.m}`;
  }
  const part = (o: Intl.DateTimeFormatOptions) => dateFmt(locale, o).format(utc(iso));
  return `${part({ weekday: 'long' })} ${part({ day: 'numeric' })} ${part({ month: 'long' })}`;
};
/** "14 Oct" */
export const fmtDayMonth = (iso: IsoDate, locale: string) => {
  if (isKh(locale)) {
    const p = km(utc(iso));
    return `${p.d} ${p.m}`;
  }
  return dateFmt(locale, { day: 'numeric', month: 'short' }).format(utc(iso));
};
/** "14 Oct 2026" */
export const fmtDayMonthYear = (iso: IsoDate, locale: string) => {
  if (isKh(locale)) {
    const p = km(utc(iso));
    return `${p.d} ${p.m} ${p.y}`;
  }
  return dateFmt(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(utc(iso));
};
/** "08 Oct" (client history) */
export const fmtDay2Month = (iso: IsoDate, locale: string) => {
  if (isKh(locale)) {
    const p = km(utc(iso));
    return `${String(p.d).padStart(2, '0')} ${p.m}`;
  }
  return dateFmt(locale, { day: '2-digit', month: 'short' }).format(utc(iso));
};
/** "Wed" */
export const fmtWeekday = (iso: IsoDate, locale: string) =>
  isKh(locale) ? km(utc(iso)).wd : dateFmt(locale, { weekday: 'short' }).format(utc(iso));
/** "Wednesday" */
export const fmtWeekdayLong = (iso: IsoDate, locale: string) =>
  isKh(locale) ? km(utc(iso)).wdl : dateFmt(locale, { weekday: 'long' }).format(utc(iso));
/** "October 2026" */
export const fmtMonthYear = (iso: IsoDate, locale: string) => {
  if (isKh(locale)) {
    const p = km(utc(iso));
    return `${p.m} ${p.y}`;
  }
  return dateFmt(locale, { month: 'long', year: 'numeric' }).format(utc(iso));
};

const instFmt = (locale: string, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(dateLocale(locale), { timeZone: DISPLAY_TIME_ZONE, ...opts });
/** "14 Oct 2026, 09:15" (receipt) */
export const fmtStamp = (at: string, locale: string) => {
  if (isKh(locale)) {
    const p = km(ppWall(at));
    return `${p.d} ${p.m} ${p.y}, ${hm(minOf(Date.parse(at)))}`;
  }
  return instFmt(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(at));
};
/** "14 Oct, 09:15" (sales table) */
export const fmtShortStamp = (at: string, locale: string) => {
  if (isKh(locale)) {
    const p = km(ppWall(at));
    return `${p.d} ${p.m}, ${hm(minOf(Date.parse(at)))}`;
  }
  return instFmt(locale, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(at));
};

export type RelKey = 'today' | 'tomorrow' | 'yesterday' | null;
/** Today / Tomorrow / Yesterday, or null for any other day. */
export const relKey = (iso: IsoDate, today: IsoDate): RelKey => {
  const n = daysBetween(today, iso);
  return n === 0 ? 'today' : n === 1 ? 'tomorrow' : n === -1 ? 'yesterday' : null;
};

export type AgoParts =
  | { unit: 'min'; n: number }
  | { unit: 'h'; n: number }
  | { unit: 'yesterday' }
  | { unit: 'days'; n: number };
/** Prototype `ago()`: "25 min ago", "5 h ago", "Yesterday", "3 days ago". */
export const agoParts = (atMs: number, nowMs: number = Date.now()): AgoParts => {
  const d = nowMs - atMs;
  if (d < 36e5) return { unit: 'min', n: Math.max(1, Math.round(d / 6e4)) };
  if (d < DAY_MS) return { unit: 'h', n: Math.round(d / 36e5) };
  const n = Math.round(d / DAY_MS);
  return n === 1 ? { unit: 'yesterday' } : { unit: 'days', n };
};
