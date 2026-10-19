'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

import { ErrorView } from '@/components/feedback';
import { useState } from 'react';

import { fallbackErrorKey, isApiError } from '@/lib/api';
import { useSession } from '@/lib/auth';
import { useRouter } from '@/lib/i18n/navigation';
import { cn } from '@/lib/utils/cn';

import { Ic } from '@/features/shop-shared/components/Ic';
import {
  Crumbs,
  Gate,
  ItemPh,
  Modal,
  NotFound,
  Pill,
  Spin,
  type PillTone,
} from '@/features/shop-shared/components/ui';
import { useAuthGate, useFmt, useShopData } from '@/features/shop-shared/hooks';
import { DAY_MS, hm, today0 } from '@/features/shop-shared/rules';
import s from '@/features/shop-shared/shop.module.css';
import { toast, useShopStore } from '@/features/shop-shared/store';
import type { ShopBooking } from '@/features/shop-shared/types';
import { useCopy } from '@/features/shop-shared/useCopy';

import { cancelBooking, putBooking, useMyBookings } from '../queries';
import { isUpcoming } from './ServicePage';

export type BookingLabel =
  | 'requested'
  | 'confirmed'
  | 'cancelled'
  | 'rescheduled'
  | 'completed'
  | 'noShow'
  | 'declined';

export function bookingLabel(b: ShopBooking): [BookingLabel, PillTone] {
  switch (b.status) {
    case 'REQUESTED':
      return ['requested', 'info'];
    case 'BOOKED':
    case 'CONFIRMED':
    case 'ARRIVED':
    case 'STARTED':
      return ['confirmed', 'ok'];
    case 'COMPLETED':
      return ['completed', 'neutral'];
    case 'NO_SHOW':
      return ['noShow', 'neutral'];
    case 'DECLINED':
      return ['declined', 'neutral'];
    default:
      return [b.rescheduled ? 'rescheduled' : 'cancelled', 'neutral'];
  }
}

const mapsDir = (q: string) =>
  `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q + ' Phnom Penh')}`;

export function BookingDetailPage({ number }: { number: string }) {
  const tm = useTranslations('shop.common');
  const t = useTranslations('shop.booking');
  const tl = useTranslations('shop.bookingStatus');
  const tg = useTranslations('shop.gate');
  const tt = useTranslations('shop.toast');
  const f = useFmt();
  const router = useRouter();
  const copy = useCopy();
  const { user } = useSession();
  const ask = useAuthGate((g) => g.ask);
  const { item, shop } = useShopData();
  const { bookings, loading, error, retry } = useMyBookings();
  const b = bookings.find((x) => x.number === number);
  const [cancel, setCancel] = useState(false);
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  const tc = useTranslations('common');

  if (!user) return <Gate title={tg('account')} onLogin={() => ask('continue', () => {})} />;
  const it = b && item(b.serviceId);
  const sh = it && shop(it.shop);
  if (loading)
    return (
      <div className={cn(s.empty, s.glassMat)}>
        <Spin />
      </div>
    );
  if (error) return <ErrorView error={error} retry={retry} home="/home" />;
  if (!b || !it || !sh) return <NotFound title={tm('missing.booking')} />;
  const up = isUpcoming(b);
  const cancelH = sh.booking?.freeCancelHours ?? 2;
  const canChange = up && b.canChange && Date.now() < b.freeCancelUntil;
  const [label, tone] = bookingLabel(b);
  const staffName = sh.staff.find((m) => m.id === b.staffId)?.name;

  const reschedule = () => {
    useShopStore.getState().set({
      reschedOf: b.number,
      bk: {
        id: b.serviceId,
        staff: b.staffId ?? '',
        day: Math.max(0, Math.round((b.date - today0()) / DAY_MS)),
        slot: null,
      },
    });
    toast(tt('pickNewTime'));
    router.push(`/s/${b.serviceId}`);
  };

  return (
    <>
      <Crumbs items={[{ label: t('crumb'), href: '/account/bookings' }, { label: b.number }]} />
      <div className={s.secH}>
        <div>
          <h1 className={s.pageT}>{up ? t('seeYou', { date: f.fmtD(b.date) }) : tl(label)}</h1>
          <span className={cn(s.muted, s.small, 'num')}>{t('number', { number: b.number })}</span>
        </div>
        <Pill tone={tone}>{tl(label)}</Pill>
      </div>
      <div className={s.twoCol}>
        <section className={cn(s.panel, s.glassMat)}>
          <div className={s.shopMini}>
            <ItemPh it={it} shop={sh} />
            <div>
              <strong style={{ fontWeight: 500 }}>{it.name}</strong>
              <div className={cn(s.small, s.muted)}>
                {sh.name} · {t('minutes', { n: b.durationMin })}
              </div>
            </div>
          </div>
          <dl className={s.spec}>
            <dt>{t('when')}</dt>
            <dd className="num">
              {f.fmtD(b.date)}, {hm(b.start)}–{hm(b.start + b.durationMin)}
            </dd>
            <dt>{t('with')}</dt>
            <dd>{staffName ?? t('anyone')}</dd>
            <dt>{t('where')}</dt>
            <dd>
              {sh.addr}, {f.district(sh.area)}
            </dd>
            <dt>{t('price')}</dt>
            <dd className="num">{t('payAtShop', { price: f.money(b.price) })}</dd>
            {b.note ? (
              <>
                <dt>{t('yourNote')}</dt>
                <dd>{b.note}</dd>
              </>
            ) : null}
          </dl>
          {up ? (
            <>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <a
                  className={cn(s.btn, s.btnPrimary)}
                  href={mapsDir(sh.addr)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Ic name="map" size={18} />
                  {t('directions')}
                </a>
                {canChange && (
                  <>
                    <button className={cn(s.btn, s.btnGhost)} onClick={reschedule}>
                      {t('reschedule')}
                    </button>
                    <button
                      className={cn(s.btn, s.btnGhost)}
                      style={{ color: 'var(--sale)' }}
                      onClick={() => setCancel(true)}
                    >
                      {t('cancel')}
                    </button>
                  </>
                )}
              </div>
              {!canChange && <p className={cn(s.small, s.muted)}>{t('tooLate', { h: cancelH })}</p>}
            </>
          ) : (
            <button
              className={cn(s.btn, s.btnGhost)}
              style={{ justifySelf: 'start' }}
              onClick={() => router.push(`/s/${it.id}`)}
            >
              {t('bookAgain')}
            </button>
          )}
        </section>
        <aside className={cn(s.panel, s.glassMat)}>
          <h2>{t('talk')}</h2>
          <p className={cn(s.muted, s.small)}>{t('replies', { time: sh.resp })}</p>
          <button className={cn(s.btn, s.btnGhost)} onClick={() => copy(f.phone(sh.phone))}>
            <Ic name="phone" size={18} />
            <span className="num">{f.phone(sh.phone)}</span>
          </button>
        </aside>
      </div>
      <Modal open={cancel} onClose={() => setCancel(false)} title={t('cancelTitle')}>
        <p className={s.muted}>
          {t('cancelBody', { name: it.name, when: `${f.fmtD(b.date)} ${hm(b.start)}` })}
        </p>
        <div className={s.btnPair}>
          <button className={cn(s.btn, s.btnGhost)} onClick={() => setCancel(false)}>
            {t('keep')}
          </button>
          <button
            className={cn(s.btn, s.btnDanger)}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                putBooking(qc, user.id, await cancelBooking(b.number));
                void qc.invalidateQueries({ queryKey: ['availability', b.serviceId] });
                toast(tt('bookingCancelled'));
              } catch (e) {
                toast(
                  isApiError(e, 'CANCEL_WINDOW_PASSED')
                    ? tt('tooLateToChange')
                    : tc(fallbackErrorKey(e)),
                );
              }
              setBusy(false);
              setCancel(false);
            }}
          >
            {t('confirmCancel')}
          </button>
        </div>
      </Modal>
    </>
  );
}
