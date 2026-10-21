/**
 * Date-range presets in Phnom Penh days (YYYY-MM-DD), as list filters and exports send them.
 * `to` is inclusive.
 */
export const RANGE_PRESETS = [
  'today',
  'last7',
  'last30',
  'last90',
  'thisMonth',
  'lastMonth',
  'last365',
] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number];
export type DayRange = { from: string; to: string };

/** A Phnom Penh calendar day as YYYY-MM-DD. */
export const ppDay = (d: Date) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Phnom_Penh' }).format(d);

export function rangeOf(r: RangePreset, now = new Date()): DayRange {
  const [y, m, dd] = ppDay(now).split('-').map(Number) as [number, number, number];
  const at = (yy: number, mm: number, d2: number) => ppDay(new Date(Date.UTC(yy, mm - 1, d2, 12)));
  switch (r) {
    case 'today':
      return { from: at(y, m, dd), to: at(y, m, dd) };
    case 'thisMonth':
      return { from: at(y, m, 1), to: at(y, m, dd) };
    case 'lastMonth':
      return { from: at(y, m - 1, 1), to: at(y, m, 0) };
    default: {
      const n = { last7: 7, last30: 30, last90: 90, last365: 365 }[r];
      return { from: at(y, m, dd - n + 1), to: at(y, m, dd) };
    }
  }
}

/** The preset a range matches, if any (so a URL `from`/`to` shows as "Last 30 days"). */
export function presetOf(range: DayRange, now = new Date()): RangePreset | null {
  return (
    RANGE_PRESETS.find((p) => {
      const r = rangeOf(p, now);
      return r.from === range.from && r.to === range.to;
    }) ?? null
  );
}

export const isDay = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
