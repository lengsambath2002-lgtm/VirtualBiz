'use client';

import { useSearchParams } from 'next/navigation';
import { useMemo } from 'react';
import { createElement as h } from 'react';

import { isApiError } from '@/lib/api';
import type { AppointmentStatus } from '@/lib/domain';
import { usePathname, useRouter } from '@/lib/i18n/navigation';

import { fetchAppointment, setAppointmentStatus, undoAppointment } from '../api';
import { k } from '../cx';
import { putAppointment, useProviderStore, useUi } from '../store';
import type { ProviderAppointment, ProviderData } from '../types';
import { CANCEL_REASONS, DECLINE_REASONS } from '../types';
import { apptEnd, conflicts, declineAlternatives, firstName } from '../util/logic';
import { addDays, hm, todayIso } from '../util/time';
import { useFmt } from './useFmt';

export const PROVIDER_PAGES = [
  'home',
  'calendar',
  'sales',
  'clients',
  'services',
  'team',
  'marketing',
  'settings',
] as const;
export type ProviderPage = (typeof PROVIDER_PAGES)[number];

export const pageHref = (p: ProviderPage) => (p === 'home' ? '/provider' : `/provider/${p}`);

export interface CalParams {
  date?: string;
  view?: 'day' | 'week';
  staff?: string;
}
export function calendarHref({ date, view, staff }: CalParams) {
  const q = new URLSearchParams();
  if (date && date !== todayIso()) q.set('date', date);
  if (view === 'week') q.set('view', 'week');
  if (staff && staff !== 'all') q.set('staff', staff);
  const s = q.toString();
  return '/provider/calendar' + (s ? `?${s}` : '');
}

/** Toast text for a failed workspace call. */
export function failMessage(
  t: (k: 'common.changed' | 'common.undoTooLate' | 'common.failed') => string,
  e: unknown,
) {
  return isApiError(e, 'INVALID_STATUS_TRANSITION', 'APPOINTMENT_NOT_FOUND')
    ? t('common.changed')
    : isApiError(e, 'UNDO_WINDOW_PASSED')
      ? t('common.undoTooLate')
      : t('common.failed');
}

/** Every workspace action the prototype's click handler performs, with its toasts and undo. */
export function useActions() {
  const f = useFmt();
  const { t } = f;
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  return useMemo(() => {
    const ui = () => useUi.getState();
    const store = () => useProviderStore.getState();
    const data = () => store().data as ProviderData;
    const bid = () => data().business.id;
    const appt = (d: ProviderData, id: string) => d.appointments.find((a) => a.id === id)!;
    const clientName = (d: ProviderData, id: string) =>
      d.clients.find((c) => c.id === id)?.name ?? '';
    const staffName = (d: ProviderData, id: string) => d.staff.find((m) => m.id === id)?.name ?? '';
    const toast = (msg: string, action?: { label: string; fn: () => void }) =>
      ui().showToast(msg, action);
    const undo = (fn: () => void) => ({ label: t('common.undo'), fn });

    /** Runs an appointment call and puts the API's answer in the workspace; toasts a failure. */
    const run = async (
      id: string,
      fn: () => Promise<ProviderAppointment>,
    ): Promise<ProviderAppointment | null> => {
      try {
        const a = await fn();
        putAppointment(a);
        return a;
      } catch (e) {
        toast(failMessage(t, e));
        if (isApiError(e, 'INVALID_STATUS_TRANSITION'))
          void fetchAppointment(bid(), id).then(putAppointment, () => {});
        return null;
      }
    };
    /** Undo puts back what the last change replaced (the API keeps it for 30 s). */
    const undoOf = (id: string) => undo(() => void run(id, () => undoAppointment(bid(), id)));

    const onCalendar = pathname === '/provider/calendar';
    const goCalendar = (date?: string) => {
      if (onCalendar) {
        const view = (search.get('view') as 'week' | null) ?? 'day';
        router.push(calendarHref({ date, view, staff: search.get('staff') ?? 'all' }));
      } else router.push(calendarHref({ date }));
    };

    const openAppt = (id: string) => ui().open({ t: 'appt', id });

    const setStatus = async (id: string, to: AppointmentStatus) => {
      const a = await run(id, () => setAppointmentStatus(bid(), id, to));
      if (!a) return;
      openAppt(id);
      const name = clientName(data(), a.clientId);
      const msg =
        to === 'CONFIRMED'
          ? t('appt.toastConfirmed')
          : to === 'ARRIVED'
            ? t('appt.toastArrived', { name })
            : to === 'STARTED'
              ? t('appt.toastStarted')
              : t('appt.toastNoShowUndone');
      toast(msg, undoOf(id));
    };

    const accept = async (id: string) => {
      const d = data();
      const a = appt(d, id);
      const c = conflicts(d, a);
      if (c.length) {
        const ok = await ui().confirm({
          title: t('appt.acceptTitle', { name: firstName(staffName(d, a.staffId)) }),
          body: t('appt.acceptBody', {
            client: clientName(d, a.clientId),
            from: hm(a.start),
            to: hm(apptEnd(a)),
            list: f.conflicts(c),
          }),
          ok: t('appt.acceptOk'),
          extra: h('p', { className: k('small muted') }, t('appt.acceptTip')),
        });
        if (!ok) return;
      }
      const done = await run(id, () => setAppointmentStatus(bid(), id, 'BOOKED'));
      if (!done) return;
      ui().close(true);
      toast(t('appt.toastAccepted', { name: firstName(clientName(d, a.clientId)) }), undoOf(id));
    };

    const decline = async (id: string) => {
      ui().close(true);
      const d = data();
      const a = appt(d, id);
      const svc = d.services.find((s) => s.id === a.serviceId);
      const alt = declineAlternatives(d, a);
      const today = todayIso();
      const msg = alt.length
        ? t('appt.declineMsgAlt', { time: hm(a.start), alts: alt.map(hm).join(', ') })
        : t('appt.declineMsgNone');
      const r = await ui().confirm({
        title: t('appt.declineTitle', { name: clientName(d, a.clientId) }),
        body: t('appt.declineBody', {
          service: svc?.name ?? '',
          when: f.rel(a.date, today),
          time: hm(a.start),
        }),
        ok: t('appt.declineOk'),
        danger: true,
        extra: h(
          'div',
          { style: { display: 'contents' } },
          h(
            'div',
            { className: k('field') },
            h('label', { htmlFor: 'dr' }, t('appt.declineReason')),
            h(
              'select',
              { id: 'dr', 'data-k': 'reason', defaultValue: DECLINE_REASONS[0] },
              DECLINE_REASONS.map((r) =>
                h('option', { key: r, value: r }, t(`appt.declineReasons.${r}`)),
              ),
            ),
          ),
          h(
            'div',
            { className: k('field') },
            h('label', { htmlFor: 'dm' }, t('appt.declineMessage')),
            h('textarea', { id: 'dm', 'data-k': 'msg', rows: 2, defaultValue: msg }),
          ),
        ),
      });
      if (!r) return;
      const done = await run(id, () =>
        setAppointmentStatus(bid(), id, 'DECLINED', r.reason ?? DECLINE_REASONS[0]),
      );
      if (done) toast(t('appt.toastDeclined'), undoOf(id));
    };

    const noShow = async (id: string) => {
      const done = await run(id, () => setAppointmentStatus(bid(), id, 'NO_SHOW'));
      if (!done) return;
      ui().close(true);
      toast(t('appt.toastNoShow', { name: clientName(data(), done.clientId) }), undoOf(id));
    };

    const cancel = async (id: string) => {
      ui().close(true);
      const d = data();
      const a = appt(d, id);
      const svc = d.services.find((s) => s.id === a.serviceId);
      const r = await ui().confirm({
        title: t('appt.cancelTitle'),
        body: t('appt.cancelBody', {
          name: clientName(d, a.clientId),
          service: svc?.name ?? '',
          when: f.rel(a.date, todayIso()),
          time: hm(a.start),
        }),
        ok: t('appt.cancelOk'),
        danger: true,
        extra: h(
          'div',
          { className: k('field') },
          h('label', { htmlFor: 'crr' }, t('appt.cancelReason')),
          h(
            'select',
            { id: 'crr', 'data-k': 'reason', defaultValue: CANCEL_REASONS[0] },
            CANCEL_REASONS.map((r) =>
              h('option', { key: r, value: r }, t(`appt.cancelReasons.${r}`)),
            ),
          ),
        ),
      });
      if (!r) return;
      const done = await run(id, () =>
        setAppointmentStatus(bid(), id, 'CANCELLED', r.reason ?? CANCEL_REASONS[0]),
      );
      if (done) toast(t('appt.toastCancelled'), undoOf(id));
    };

    /** Rebook / Book again / Book next visit: same client, staff and service, 28 days later. */
    const rebook = (id: string) => {
      const a = appt(data(), id);
      ui().open({
        t: 'apptForm',
        opts: {
          clientId: a.clientId,
          staffId: a.staffId,
          date: addDays(a.date, 28),
          serviceId: a.serviceId,
        },
      });
    };

    const copy = async (v: string) => {
      try {
        await navigator.clipboard.writeText(v);
        toast(t('common.copied', { value: v }));
      } catch {
        toast(v);
      }
    };

    const go = (p: ProviderPage) => {
      ui().set({ menu: null });
      router.push(pageHref(p));
    };

    return {
      openAppt,
      setStatus,
      accept,
      decline,
      noShow,
      cancel,
      rebook,
      copy,
      go,
      goCalendar,
      toast,
      undo,
      undoOf,
      fail: (e: unknown) => toast(failMessage(t, e)),
    };
  }, [f, t, router, pathname, search]);
}
