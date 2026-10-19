'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useMemo } from 'react';

import type { AppointmentStatus, PaymentMethod } from '@/lib/domain';
import { formatUsd, formatUsdAsKhr, formatUsdWhole } from '@/lib/money';

import type { LogEntry } from '../types';
import type { Conflict } from '../util/logic';
import { agoParts, fmtD, hm, relKey } from '../util/time';

const PAY_BRAND: Partial<Record<PaymentMethod, string>> = { KHQR: 'KHQR' };

/** Translated formatting helpers shared by every provider screen. */
export function useFmt() {
  const t = useTranslations('provider');
  const locale = useLocale();
  return useMemo(() => {
    const ago = (at: string | number) => {
      const p = agoParts(typeof at === 'number' ? at : Date.parse(at));
      return p.unit === 'min'
        ? t('time.minAgo', { n: p.n })
        : p.unit === 'h'
          ? t('time.hAgo', { n: p.n })
          : p.unit === 'yesterday'
            ? t('time.yesterday')
            : t('time.daysAgo', { n: p.n });
    };
    /** Today / Tomorrow / Yesterday, else "Wed, 14 Oct". */
    const rel = (iso: string, today: string) => {
      const k = relKey(iso, today);
      return k ? t(`time.${k}`) : fmtD(iso, locale);
    };
    const status = (s: AppointmentStatus) => t(`status.${s}`);
    const pay = (m: PaymentMethod) => PAY_BRAND[m] ?? t(`pay.${m as 'CASH' | 'CARD'}`);
    const conflict = (c: Conflict) =>
      c.kind === 'appt'
        ? `${c.name}, ${hm(c.from)}–${hm(c.to)}`
        : c.kind === 'block'
          ? t('conflict.block', {
              reason: t(`blockReason.${c.reason as 'LUNCH'}`),
              from: hm(c.from),
              to: hm(c.to),
            })
          : c.kind === 'notWorking'
            ? t('conflict.notWorking', { name: c.name })
            : t('conflict.outside', { name: c.name, from: c.from / 60, to: c.to / 60 });
    const conflicts = (list: Conflict[]) => list.map(conflict).join('; ');
    /** "45 min", "1 h", "2 h 30 min" */
    const dur = (m: number) =>
      m >= 60
        ? m % 60
          ? t('time.hoursMin', { h: Math.floor(m / 60), m: m % 60 })
          : t('time.hours', { n: Math.floor(m / 60) })
        : t('time.min', { n: m });
    const category = (c: string) =>
      c === 'Hair' || c === 'Nails' || c === 'Make-up' ? t(`category.${c}`) : c;
    const log = (l: LogEntry) => {
      const p = { ...(l.params ?? {}) } as Record<string, string | number>;
      if (l.code === 'declined' && typeof p.reason === 'string')
        p.reason = t(`appt.declineReasons.${p.reason as 'fullyBooked'}`);
      if (l.code === 'cancelled' && typeof p.reason === 'string')
        p.reason = t(`appt.cancelReasons.${p.reason as 'clientAsked'}`);
      if (l.code === 'moved' && typeof p.date === 'string') p.date = fmtD(p.date, locale);
      if (l.code === 'paid') {
        if (typeof p.method === 'string')
          p.method = p.method === 'SPLIT' ? t('pay.SPLIT') : pay(p.method as PaymentMethod);
        // The API sends the amount as a plain number ("19.50").
        if (typeof p.amount === 'string' && /^\d+(\.\d+)?$/.test(p.amount))
          p.amount = formatUsd(Number(p.amount));
      }
      return t(`log.${l.code}`, p);
    };
    return {
      t,
      locale,
      money: formatUsd,
      money0: formatUsdWhole,
      khr: formatUsdAsKhr,
      ago,
      rel,
      status,
      pay,
      conflict,
      conflicts,
      dur,
      category,
      log,
    };
  }, [t, locale]);
}
