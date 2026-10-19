'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useMemo } from 'react';

import { formatKhr, formatUsd, formatUsdAsKhr, formatUsdWhole } from '@/lib/money';

import { DAY, HOUR, MIN } from '../util/derive';

/** Locale-aware formatting for the workspace (dates follow the prototype's en-GB style). */
export function useFmt() {
  const locale = useLocale();
  const t = useTranslations('seller.time');
  return useMemo(() => {
    const tag = locale === 'kh' ? 'km-KH' : 'en-GB';
    const toMs = (x: number | string) => (typeof x === 'string' ? Date.parse(x) : x);
    return {
      tag,
      money: formatUsd,
      money0: formatUsdWhole,
      khr: formatUsdAsKhr,
      riel: formatKhr,
      /** "12 min ago", "3 h ago", "Yesterday", "4 days ago". */
      ago: (x: number | string) => {
        const d = Date.now() - toMs(x);
        if (d < HOUR) return t('minAgo', { n: Math.max(1, Math.round(d / MIN)) });
        if (d < DAY) return t('hAgo', { n: Math.round(d / HOUR) });
        const n = Math.round(d / DAY);
        return n === 1 ? t('yesterday') : t('daysAgo', { n });
      },
      /** Waiting time: "12 min" / "2 h". */
      age: (x: number | string) => {
        const m = Math.round((Date.now() - toMs(x)) / MIN);
        return m < 60 ? t('min', { n: m }) : t('h', { n: Math.round(m / 60) });
      },
      fmtD: (x: number | string) =>
        new Date(toMs(x)).toLocaleDateString(tag, { day: 'numeric', month: 'short' }),
      fmtDT: (x: number | string) =>
        new Date(toMs(x)).toLocaleString(tag, {
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        }),
      hm: (x: number | string) =>
        new Date(toMs(x)).toLocaleTimeString(tag, { hour: '2-digit', minute: '2-digit' }),
      weekday: (x: number | string) =>
        new Date(toMs(x)).toLocaleDateString(tag, { weekday: 'long' }),
      dateTimeMedium: (x: number | string) =>
        new Date(toMs(x)).toLocaleString(tag, { dateStyle: 'medium', timeStyle: 'short' }),
      int: (n: number) => n.toLocaleString('en-US'),
    };
  }, [locale, t]);
}

/** A collection's display name: the translated default collections, else the shop's own name. */
export function useCollectionName() {
  const t = useTranslations('seller.collections');
  return (name: string) => (name && t.has(name as never) ? t(name as never) : name);
}
