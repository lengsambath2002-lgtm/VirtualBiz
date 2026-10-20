'use client';

import { useTranslations } from 'next-intl';

import {
  CloseButton,
  custStats,
  cx,
  Drawer,
  findVariant,
  Ic,
  initials,
  itemCount,
  ms,
  orderAddr,
  orderCustomer,
  PayPill,
  payLabel,
  s,
  StatusPill,
  Thumb,
  useDb,
  useFmt,
  useUi,
  type SellerOrder,
  useMethodName,
} from '@/features/seller-shared';
import type { OrderStatus } from '@/lib/domain';
import { formatPhone } from '@/lib/utils/phone';

import { SourcePill } from './SourcePill';
import { useOrderActions } from '../hooks/useOrderActions';
import { useReasonText } from '../hooks/useReasonText';

export async function copyText(v: string, toast: (m: string) => void, copied: string) {
  try {
    await navigator.clipboard.writeText(v);
    toast(copied);
  } catch {
    toast(v);
  }
}

export function OrderDrawer({ id }: { id: string }) {
  const t = useTranslations('seller.orders');
  const tm = useTranslations('seller.method');
  const tp = useMethodName();
  const tc = useTranslations('seller.common');
  const db = useDb();
  const f = useFmt();
  const act = useOrderActions();
  const reason = useReasonText();
  const o = db.orders.find((x) => x.id === id);
  if (!o) return null;
  const c = orderCustomer(db, o);
  const n = itemCount(o);
  const cs = custStats(db.orders, o.customerId);
  const flow: OrderStatus[] = [
    'NEW',
    'ACCEPTED',
    'PACKED',
    'SHIPPED',
    o.method === 'PICKUP' ? 'PICKED_UP' : 'DELIVERED',
  ];
  const idx = flow.indexOf(o.status);
  const stepLabel = (st: OrderStatus) =>
    st === 'SHIPPED'
      ? t(o.method === 'PICKUP' ? 'tl.SHIPPED_PICKUP' : 'tl.SHIPPED')
      : t(`tl.${st}` as 'tl.NEW');
  const pay = payLabel(o);
  const addr = orderAddr(o, c);
  const toast = useUi.getState().showToast;

  const footer = () => {
    switch (o.status) {
      case 'NEW':
        return (
          <div className={s.drFRow}>
            <button
              type="button"
              className={cx(s.btn, s.btnGhost)}
              onClick={() => void act.reject(o.id)}
            >
              {t('reject.btn')}
            </button>
            <button
              type="button"
              className={cx(s.btn, s.btnPrimary)}
              onClick={() => void act.accept([o.id])}
            >
              {t('acceptOrder')}
            </button>
          </div>
        );
      case 'ACCEPTED':
        return (
          <div className={s.drFRow}>
            <button
              type="button"
              className={cx(s.btn, s.btnPrimary, s.btnLg)}
              onClick={() => act.pack(o.id)}
            >
              <Ic name="box" size={18} />
              {t('packN', { n })}
            </button>
          </div>
        );
      case 'PACKED':
        return (
          <div className={s.drFRow}>
            <button
              type="button"
              className={cx(s.btn, s.btnPrimary, s.btnLg)}
              onClick={() => void act.ship(o.id)}
            >
              {o.method === 'PICKUP' ? (
                t('customerPickedUp')
              ) : (
                <>
                  <Ic name="truck" size={18} />
                  {t('next.handToRider')}
                </>
              )}
            </button>
          </div>
        );
      case 'SHIPPED':
        return (
          <div className={s.drFRow}>
            <button
              type="button"
              className={cx(s.btn, s.btnGhost)}
              onClick={() => void act.failed(o.id)}
            >
              {t('deliveryFailed')}
            </button>
            <button
              type="button"
              className={cx(s.btn, s.btnOk)}
              onClick={() => void act.delivered(o.id)}
            >
              {t('markDelivered')}
            </button>
          </div>
        );
      case 'DELIVERED':
      case 'PICKED_UP':
        return (
          <div className={s.drFRow}>
            <button
              type="button"
              className={cx(s.btn, s.btnGhost)}
              onClick={() => act.invoice(o.id)}
            >
              <Ic name="receipt" size={18} />
              {t('invoice')}
            </button>
            <button
              type="button"
              className={cx(s.btn, s.btnGhost)}
              onClick={() => void act.giveBack(o.id)}
            >
              <Ic name="undo" size={18} />
              {t('returnRefund')}
            </button>
          </div>
        );
      default:
        return (
          <div className={s.drFRow}>
            <button
              type="button"
              className={cx(s.btn, s.btnGhost)}
              onClick={() => act.invoice(o.id)}
            >
              <Ic name="receipt" size={18} />
              {t('invoice')}
            </button>
          </div>
        );
    }
  };

  return (
    <Drawer label={t('orderNo', { no: o.number })}>
      <div className={s.drH}>
        <div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <StatusPill status={o.status} />
            <SourcePill o={o} />
            <PayPill o={o} />
          </div>
          <h2 style={{ marginTop: 6 }} className={s.num}>
            {t('orderNo', { no: o.number })}
          </h2>
          <span className={cx(s.tiny, s.muted)}>
            {f.fmtDT(o.createdAt)} · {tm(o.method)}
          </span>
        </div>
        <CloseButton />
      </div>
      <div className={s.drB}>
        {o.status === 'NEW' && Date.now() - ms(o.createdAt) > 30 * 60_000 && (
          <div className={s.warnbox}>
            <Ic name="alert" size={14} /> {t('waitingWarn', { age: f.age(o.createdAt) })}
          </div>
        )}
        {o.note && (
          <div className={s.infobox}>
            <Ic name="chat" size={14} /> “{o.note}”
          </div>
        )}
        <div style={{ display: 'grid', gap: 4 }}>
          <div className={s.secT}>{t('items', { n })}</div>
          {o.lines.map((l, i) => {
            const [p, v] = findVariant(db.products, l.variantId);
            return (
              <div
                key={i}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '44px 1fr auto',
                  gap: 12,
                  alignItems: 'center',
                  padding: '8px 0',
                  borderBottom: '1px solid var(--line)',
                }}
              >
                <Thumb p={p} />
                <span style={{ minWidth: 0 }}>
                  <span className={s.block} style={{ fontWeight: 500 }}>
                    {l.title}
                  </span>
                  <span className={cx(s.tiny, s.muted)}>
                    {l.variantName || tc('default')} · {t('sku', { sku: v ? v.sku : '–' })}
                  </span>
                </span>
                <span className={s.num} style={{ textAlign: 'right' }}>
                  {l.qty} × {f.money(l.unitPrice)}
                  <span className={cx(s.tiny, s.muted, s.block)}>
                    {f.money(l.qty * l.unitPrice)}
                  </span>
                </span>
              </div>
            );
          })}
          <div className={s.sum} style={{ marginTop: 8 }}>
            <div>
              <span className={s.muted}>{t('subtotal')}</span>
              <span>{f.money(o.subtotal)}</span>
            </div>
            {o.discount > 0 && (
              <div>
                <span className={s.muted}>{t('discount')}</span>
                <span className={s.up}>−{f.money(o.discount)}</span>
              </div>
            )}
            <div>
              <span className={s.muted}>{t('delivery')}</span>
              <span>{o.deliveryFee ? f.money(o.deliveryFee) : t('free')}</span>
            </div>
            <div className={s.tot} style={{ fontSize: 16 }}>
              <span>{t('total')}</span>
              <span>{f.money(o.total)}</span>
            </div>
            <div>
              <span className={cx(s.tiny, s.muted)}>
                {pay === 'COD' && !o.payment.paid
                  ? t('riderCollects')
                  : t('paidBy', { pay: tp(pay) })}
              </span>
              <span className={cx(s.tiny, s.muted)}>{f.khr(o.total)}</span>
            </div>
          </div>
        </div>
        <div className={s.card}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span className={s.av} style={{ width: 40, height: 40 }}>
              {initials(c.name)}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              {c.crm ? (
                <button
                  type="button"
                  className={cx(s.link, s.quiet, s.noUnderline)}
                  style={{ fontWeight: 600 }}
                  onClick={() => {
                    useUi.getState().close(true);
                    useUi.getState().open({ kind: 'customer', id: o.customerId });
                  }}
                >
                  {c.name}
                </button>
              ) : (
                <b style={{ fontWeight: 600 }}>{c.name}</b>
              )}
              <div className={cx(s.meta, s.num)}>
                {formatPhone(c.phone)}{' '}
                <button
                  type="button"
                  className={cx(s.link, s.quiet, s.tiny)}
                  onClick={() =>
                    void copyText(
                      formatPhone(c.phone),
                      toast,
                      tc('copied', { v: formatPhone(c.phone) }),
                    )
                  }
                >
                  {tc('copy')}
                </button>
              </div>
            </div>
            <span className={cx(s.pill, s.neutral)}>{t('ordersCount', { n: cs.n })}</span>
          </div>
          {o.method === 'DELIVERY' ? (
            <div className={s.small}>
              <b style={{ fontWeight: 500 }}>{t('deliverTo')}</b>
              <br />
              {addr}, {t('phnomPenh')}{' '}
              <a
                className={cx(s.link, s.quiet, s.tiny)}
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr + ' Phnom Penh')}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t('map')}
              </a>
            </div>
          ) : (
            <div className={s.small}>
              {t.rich('pickupNote', { no: o.number, b: (x) => <b>{x}</b> })}
            </div>
          )}
          {o.status === 'SHIPPED' || o.rider || o.deliveryBy ? (
            o.rider || o.deliveryBy ? (
              <div className={s.small}>
                <Ic name="truck" size={14} /> {t('rider', { rider: riderText(o, t) })}
              </div>
            ) : null
          ) : null}
        </div>
        <div style={{ display: 'grid', gap: 8 }}>
          <div className={s.secT}>{t('timeline')}</div>
          <div className={s.tl2}>
            {flow.map((st, i) => {
              if (o.status === 'CANCELLED' && i > 0) return null;
              const done = o.timeline.find((e) => e.status === st && !e.note);
              return (
                <div key={st}>
                  <i className={cx(i <= idx && s.done, i === idx + 1 && s.now)}>
                    {i <= idx && <Ic name="check" size={12} />}
                  </i>
                  <span>{stepLabel(st)}</span>
                  <span className={cx(s.tiny, s.muted, s.num)}>{done ? f.hm(done.at) : ''}</span>
                </div>
              );
            })}
            {o.cancelReason && (
              <div>
                <i className={s.x}>
                  <Ic name="x" size={12} />
                </i>
                <span>
                  {o.status === 'RETURNED' ? t('returnedPrefix') : t('cancelledPrefix')}
                  {reason(o.cancelReason)}
                </span>
                <span />
              </div>
            )}
          </div>
        </div>
      </div>
      <div className={s.drF}>{footer()}</div>
    </Drawer>
  );
}

export function riderText(o: SellerOrder, t: (k: 'ownDelivery' | 'vbRider') => string): string {
  if (o.deliveryBy === 'OWN') return t('ownDelivery');
  if (o.rider) return `${o.rider.name} · ${o.rider.plate}`;
  return t('vbRider');
}
