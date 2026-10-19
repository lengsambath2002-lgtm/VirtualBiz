'use client';

import { useTranslations } from 'next-intl';

import { ErrorView, isNotFound } from '@/components/feedback';
import { useState } from 'react';

import { fallbackErrorKey, isApiError } from '@/lib/api';
import { useSession } from '@/lib/auth';
import { Link } from '@/lib/i18n/navigation';
import { cn } from '@/lib/utils/cn';

import { Ic } from '@/features/shop-shared/components/Ic';
import { itemHref } from '@/features/shop-shared/components/cards';
import { writeReview } from '@/features/shop-shared/components/sheets';
import {
  Crumbs,
  Gate,
  ItemPh,
  Modal,
  NotFound,
  Pill,
  Spin,
} from '@/features/shop-shared/components/ui';
import { useAuthGate, useFmt, useNeedAuth, useShopData } from '@/features/shop-shared/hooks';
import { selTxt } from '@/features/shop-shared/rules';
import s from '@/features/shop-shared/shop.module.css';
import { toast } from '@/features/shop-shared/store';
import type { ShopOrder } from '@/features/shop-shared/types';
import { useCopy } from '@/features/shop-shared/useCopy';

import { useCancelReasonText } from '../hooks/useCancelReasonText';
import { useReorder } from '../hooks/useReorder';
import { useCancelOrder, useMyOrder } from '../queries';

export const orderTotal = (o: ShopOrder) => o.total;

const STEP_KEYS = ['placed', 'confirmed', 'preparing', 'onTheWay', 'delivered'] as const;
const PICKUP_KEYS = ['placed', 'confirmed', 'preparing', 'readyPickup', 'pickedUp'] as const;
const REASONS = ['mistake', 'change', 'slow', 'other'] as const;

export function OrderPage({ number }: { number: string }) {
  const tm = useTranslations('shop.common');
  const t = useTranslations('shop.order');
  const tg = useTranslations('shop.gate');
  const tt = useTranslations('shop.toast');
  const tc = useTranslations('common');
  const tcm = useTranslations('common.payments');
  const tp = useTranslations('shop.payments');
  const f = useFmt();
  const why = useCancelReasonText();
  const copy = useCopy();
  const reorder = useReorder();
  const needAuth = useNeedAuth();
  const { user } = useSession();
  const ask = useAuthGate((g) => g.ask);
  const { item, shop } = useShopData();
  // Live: the shop shell's event stream refetches this order when its status changes.
  const { data: o, isPending, error, refetch } = useMyOrder(number);
  const cancelOrder = useCancelOrder();
  const [cancel, setCancel] = useState(false);
  const [reason, setReason] = useState<(typeof REASONS)[number]>('mistake');

  if (!user) return <Gate title={tg('account')} onLogin={() => ask('continue', () => {})} />;
  if (isPending)
    return (
      <div className={cn(s.empty, s.glassMat)}>
        <Spin />
      </div>
    );
  // Offline or a server error is not "no such order": say so and offer a retry.
  if (error && !isNotFound(error))
    return <ErrorView error={error} retry={() => void refetch()} home="/home" />;
  const sh = o && shop(o.businessId);
  if (!o || !sh) return <NotFound title={tm('missing.order')} />;
  const pickup = o.method === 'PICKUP';
  const keys = pickup ? PICKUP_KEYS : STEP_KEYS;
  const total = orderTotal(o);
  const canCancel = o.canCancel;
  const returned = o.status === 'RETURNED';
  const reviewed = o.reviewed;
  const title = o.cancelledAt
    ? t('cancelledTitle')
    : returned
      ? t('returnedTitle')
      : o.step >= 5
        ? t(`steps.${pickup ? 'pickedUp' : 'delivered'}`)
        : t(`steps.${keys[o.step - 1]!}`);
  const method = o.payment.method === 'KHQR' ? tcm('khqr') : tp(o.payment.method);
  const payLabel =
    o.payment.status === 'REFUNDED'
      ? t('refundedLabel', { method })
      : o.payment.method === 'KHQR'
        ? t('paidKhqr')
        : o.payment.method === 'CARD'
          ? t('paidCard')
          : o.payment.paid
            ? t('cashPaid')
            : t('cashDue');

  const doCancel = () => {
    cancelOrder.mutate(
      { number: o.number, reason },
      {
        onSuccess: () => {
          setCancel(false);
          toast(tt('orderCancelled'));
        },
        onError: (e) => {
          setCancel(false);
          toast(
            isApiError(e, 'CANCEL_WINDOW_PASSED') ? t('tooLateToCancel') : tc(fallbackErrorKey(e)),
          );
        },
      },
    );
  };

  return (
    <>
      <Crumbs items={[{ label: t('crumb'), href: '/account/orders' }, { label: o.number }]} />
      <div className={s.secH}>
        <div>
          <h1 className={s.pageT}>{title}</h1>
          <span className={cn(s.muted, s.small, 'num')}>
            {t('meta', { number: o.number, when: f.fmtDT(o.at), shop: sh.name })}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {canCancel && (
            <button className={cn(s.btn, s.btnGhost)} onClick={() => setCancel(true)}>
              {t('cancel')}
            </button>
          )}
          <button className={cn(s.btn, s.btnGhost)} onClick={() => copy(f.phone(sh.phone))}>
            <Ic name="phone" size={18} />
            {t('callShop')}
          </button>
        </div>
      </div>
      <div className={s.twoCol}>
        <div className={s.stack16}>
          {!o.cancelledAt && !returned && o.step < 5 && (
            <div className={cn(s.alert, s.aInfo, s.alertLg)}>
              <Ic name="clock" size={18} />
              <span>
                {o.window && !pickup
                  ? t('scheduled', { window: o.window })
                  : t.rich(pickup ? 'readyIn' : 'arrivingIn', {
                      min: Math.max(5, (sh.eta?.[1] ?? 35) - o.step * 8),
                      b: (c) => <b className="num">{c}</b>,
                    })}
              </span>
            </div>
          )}
          <section className={cn(s.panel, s.glassMat)}>
            <h2>{t('status')}</h2>
            {o.cancelledAt ? (
              <div className={cn(s.alert, s.aBad)}>
                {t('cancelledAt', { when: f.fmtDT(o.cancelledAt) })}{' '}
                {o.cancelReason ? t('cancelledWhy', { why: why(o.cancelReason) }) + ' ' : ''}
                {o.payment.status === 'REFUNDED' ? t('refund') : t('nothingCharged')}
              </div>
            ) : (
              <div className={s.track}>
                {keys.map((k, i) => {
                  const cls =
                    i < o.step - 1 || o.step >= 5 ? s.done : i === o.step - 1 ? s.now : s.todo;
                  return (
                    <div key={k} className={cn(s.ts, cls)}>
                      <span className={s.dot}>
                        <Ic name="check" size={14} />
                      </span>
                      <span>
                        <strong>{t(`steps.${k}`)}</strong>
                        {i === 3 && !pickup && o.step >= 4 && o.rider && (
                          <span className={cn(s.small, s.muted)}>
                            {t('rider', {
                              name: o.rider.name,
                              vehicle: o.rider.vehicle,
                              plate: o.rider.plate,
                            })}
                          </span>
                        )}
                      </span>
                      <span className={cn(s.tiny, s.muted, 'num')}>
                        {o.times[i] && i < o.step ? f.time(o.times[i]!) : ''}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
          <section className={cn(s.panel, s.glassMat)}>
            <h2>{t('items')}</h2>
            {o.lines.map((l, i) => {
              const it = item(l.pid);
              const st = selTxt(l.sel);
              return (
                <div
                  key={i}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '56px 1fr auto',
                    gap: 12,
                    alignItems: 'center',
                  }}
                >
                  {it && <ItemPh it={it} shop={sh} sel={l.sel} />}
                  <span>
                    {it ? (
                      <Link href={itemHref(it)} style={{ textDecoration: 'none' }}>
                        {l.title}
                      </Link>
                    ) : (
                      l.title
                    )}
                    <span className={cn(s.small, s.muted)} style={{ display: 'block' }}>
                      {st}
                      {st ? ' · ' : ''}× {l.qty}
                    </span>
                  </span>
                  <span className="num">{f.money(l.unitPrice * l.qty)}</span>
                </div>
              );
            })}
            {o.step >= 5 && !o.cancelledAt && !returned && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className={cn(s.btn, s.btnGhost, s.btnSm)} onClick={() => reorder(o)}>
                  {t('buyAgain')}
                </button>
                {!reviewed ? (
                  <button
                    className={cn(s.btn, s.btnPrimary, s.btnSm)}
                    onClick={() =>
                      needAuth('writeReview', () => writeReview(o.lines[0]!.pid, o.number))
                    }
                  >
                    {t('rate')}
                  </button>
                ) : (
                  <Pill tone="ok">{t('reviewed')}</Pill>
                )}
              </div>
            )}
          </section>
        </div>
        <aside className={cn(s.panel, s.glassMat, s.sticky)}>
          <h2>{t('details')}</h2>
          <div className={s.sum}>
            <div>
              <span className={s.muted}>{pickup ? t('pickup') : t('delivery')}</span>
              <span style={{ textAlign: 'right' }}>
                {pickup
                  ? sh.addr
                  : o.address
                    ? `${t(`labels.${o.address.label}`)} · ${o.address.line}, ${f.district(o.address.district)}`
                    : ''}
              </span>
            </div>
            <div>
              <span className={s.muted}>{t('payment')}</span>
              <span>{payLabel}</span>
            </div>
            <div>
              <span className={s.muted}>{t('subtotal')}</span>
              <span>{f.money(o.subtotal)}</span>
            </div>
            {o.discount > 0 && (
              <div>
                <span className={s.muted}>{t('discounts')}</span>
                <span style={{ color: 'var(--ok)' }}>−{f.money(o.discount)}</span>
              </div>
            )}
            {o.promo > 0 && (
              <div>
                <span className={s.muted}>{t('promo')}</span>
                <span style={{ color: 'var(--ok)' }}>−{f.money(o.promo)}</span>
              </div>
            )}
            <div>
              <span className={s.muted}>{t('delivery')}</span>
              <span>{o.deliveryFee ? f.money(o.deliveryFee) : t('free')}</span>
            </div>
            <div className={s.tot}>
              <span>{t('total')}</span>
              <span>{f.money(total)}</span>
            </div>
          </div>
          {!pickup && (
            <a
              className={cn(s.btn, s.btnGhost, s.btnSm)}
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(sh.addr + ' Phnom Penh')}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Ic name="map" size={16} />
              {t('maps')}
            </a>
          )}
        </aside>
      </div>
      <Modal
        open={cancel}
        onClose={() => setCancel(false)}
        title={t('cancelTitle', { number: o.number })}
      >
        <div className={s.field}>
          <label htmlFor="cr">{t('reason')}</label>
          <select
            id="cr"
            value={reason}
            onChange={(e) => setReason(e.target.value as (typeof REASONS)[number])}
          >
            {REASONS.map((r) => (
              <option key={r} value={r}>
                {t(`reasons.${r}`)}
              </option>
            ))}
          </select>
        </div>
        <div className={s.btnPair}>
          <button className={cn(s.btn, s.btnGhost)} onClick={() => setCancel(false)}>
            {t('keep')}
          </button>
          <button
            className={cn(s.btn, s.btnDanger)}
            disabled={cancelOrder.isPending}
            onClick={doCancel}
          >
            {cancelOrder.isPending ? <Spin /> : null}
            {t('cancel')}
          </button>
        </div>
      </Modal>
    </>
  );
}
