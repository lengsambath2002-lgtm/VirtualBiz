'use client';

import { useLocale } from 'next-intl';
import { useMemo } from 'react';

import { formatUsd, formatUsdAsKhr, formatUsdWhole } from '@/lib/money';

const tag = (locale: string) => (locale === 'kh' ? 'km-KH' : 'en-GB');

/** Money and dates for the console, in the UI language (Phnom Penh time). */
export function useAdminFmt() {
  const locale = useLocale();
  return useMemo(() => {
    const dt = (iso: string | undefined | null, o: Intl.DateTimeFormatOptions) =>
      iso ? new Date(iso).toLocaleString(tag(locale), { timeZone: 'Asia/Phnom_Penh', ...o }) : '—';
    return {
      money: (n: number) => formatUsd(Number(n ?? 0)),
      money0: (n: number) => formatUsdWhole(Number(n ?? 0)),
      khr: (n: number) => formatUsdAsKhr(Number(n ?? 0)),
      int: (n: number) => Number(n ?? 0).toLocaleString(tag(locale)),
      date: (iso?: string | null) => dt(iso, { day: 'numeric', month: 'short', year: 'numeric' }),
      dateTime: (iso?: string | null) =>
        dt(iso, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
      day: (iso: string) =>
        new Date(iso + 'T00:00:00').toLocaleDateString(tag(locale), {
          day: 'numeric',
          month: 'short',
        }),
      /** Change from `prev` to `cur` in %, or null when there is nothing to compare with. */
      delta: (cur: number, prev: number) =>
        prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null,
    };
  }, [locale]);
}
