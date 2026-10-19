'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  ApiError,
  fallbackErrorKey,
  isApiError,
  type ApiOrder,
  type CheckoutInput,
  type PaymentIntent,
} from '@/lib/api';
import { round2 } from '@/lib/money';
import { useSession } from '@/lib/auth';
import type { PaymentMethod } from '@/lib/domain';
import { Link, useRouter } from '@/lib/i18n/navigation';
import { cn } from '@/lib/utils/cn';

import { KhqrModal } from '@/features/khqr-payment/components/KhqrModal';
import { useAddresses } from '@/features/shop-account/queries';
import { PromoBox } from '@/features/shop-cart/components/PromoBox';
import { refreshOrders } from '@/features/shop-order-tracking/queries';
import { Ic, type IcName } from '@/features/shop-shared/components/Ic';
import { addAddress } from '@/features/shop-shared/components/sheets';
import { Crumbs, Gate, ItemPh, Spin } from '@/features/shop-shared/components/ui';
import { refreshCatalog, useAuthGate, useFmt, useShopData } from '@/features/shop-shared/hooks';
import { byShop, deliveryWindows, net, selTxt } from '@/features/shop-shared/rules';
import s from '@/features/shop-shared/shop.module.css';
import { toast, useShopStore } from '@/features/shop-shared/store';
import type { CartLine, CheckoutDraft } from '@/features/shop-shared/types';

import {
  cancelPayment,
  checkoutLines,
  newIdempotencyKey,
  placeCheckout,
  useQuote,
} from '../queries';

export function CheckoutPage() {
  const t = useTranslations('shop.checkout');
  const tc = useTranslations('shop.cart');
  const tg = useTranslations('shop.gate');
  const tt = useTranslations('shop.toast');
  const tcm = useTranslations('common.payments');
  const tco = useTranslations('common');
  const f = useFmt();
  const qc = useQueryClient();
  const router = useRouter();
  const { user } = useSession();
  const ask = useAuthGate((g) => g.ask);
  const { item, shop } = useShopData();
  const cart = useShopStore((st) => st.cart);
  const { data: addresses = [] } = useAddresses();
  const area = useShopStore((st) => st.area);
  const promo = useShopStore((st) => st.promo);
  const draft = useShopStore((st) => st.co);
  const [slotErr, setSlotErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [khqr, setKhqr] = useState<{ intent: PaymentIntent; orders: ApiOrder[] } | null>(null);
  const slotRef = useRef<HTMLSelectElement>(null);
  // One key per checkout attempt: a retried request after a network error places nothing twice.
  const attemptKey = useRef(newIdempotencyKey());

  const defAddr = (addresses.find((a) => a.isDefault) ?? addresses[0])?.id;
  useEffect(() => {
    if (!draft)
      useShopStore.getState().set({
        co: {
          method: 'DELIVERY',
          ...(defAddr ? { addr: defAddr } : {}),
          when: 'asap',
          slot: '',
          pay: 'KHQR',
          note: '',
        },
      });
    // Addresses arrive after the draft was made: pick the default once they do.
    else if (!draft.addr && defAddr)
      useShopStore.getState().set({ co: { ...draft, addr: defAddr } });
  }, [draft, defAddr]);

  const c: CheckoutDraft = draft ?? {
    method: 'DELIVERY',
    ...(defAddr ? { addr: defAddr } : {}),
    when: 'asap',
    slot: '',
    pay: 'KHQR',
    note: '',
  };
  const sel = cart.filter((l) => l.on);
  const addr = addresses.find((a) => a.id === c.addr);
  // Every total on this page is the server's quote (POST /api/checkout/quote).
  const lines = checkoutLines(sel, item);
  const base: CheckoutInput | null = lines.length
    ? {
        lines,
        ...(addr ? { addressId: addr.id } : { district: area }),
        ...(c.when === 'later' && c.slot ? { window: c.slot } : {}),
        ...(c.note.trim() ? { note: c.note.trim() } : {}),
        ...(promo ? { promoCode: promo.code } : {}),
      }
    : null;
  const pickupBase = (b: CheckoutInput): CheckoutInput => {
    const { addressId: _a, ...rest } = b;
    return { ...rest, district: addr?.district ?? area };
  };
  const input: CheckoutInput | null =
    base &&
    (c.method === 'PICKUP'
      ? { ...pickupBase(base), method: 'PICKUP' }
      : { ...base, method: 'DELIVERY' });
  const quoteQ = useQuote(input);
  const q = quoteQ.data;
  // The Delivery option shows its price even while Pickup is chosen.
  const qDelivery = useQuote(base && { ...base, method: 'DELIVERY' }).data;

  const closeKhqr = useCallback(() => {
    const open = khqr;
    setKhqr(null);
    setBusy(false);
    attemptKey.current = newIdempotencyKey();
    // The QR was not paid: its orders are cancelled and the stock goes back.
    if (open) void cancelPayment(open.intent.id).catch(() => {});
    void refreshCatalog(qc);
  }, [khqr, qc]);

  if (!user) return <Gate title={tg('checkOut')} onLogin={() => ask('continue', () => {})} />;
  if (!sel.length)
    return (
      <div className={cn(s.empty, s.glassMat)}>
        <strong>{t('nothing')}</strong>
        <Link className={cn(s.btn, s.btnGhost, s.btnSm)} href="/cart">
          {t('backToCart')}
        </Link>
      </div>
    );
  const setC = (patch: Partial<CheckoutDraft>) =>
    useShopStore.getState().set({ co: { ...c, ...patch } });

  const groups = byShop(sel, item);
  const quoted = !!q;
  /** The quote's total for a line (by its variant). */
  const lineTotal = (pid: string, lineSel: CartLine['sel']) => {
    const v = checkoutLines([{ pid, sel: lineSel, qty: 1, on: true }], item)[0]?.variantId;
    return q?.shops.flatMap((x) => x.lines).find((x) => x.variantId === v)?.lineTotal;
  };
  const fees = q?.deliveryFee ?? 0;
  const deliveryFees = qDelivery?.deliveryFee ?? 0;
  // The shops' automatic promotions are in promoDiscount too: shown on their own lines.
  const autos = q ? q.shops.flatMap((x) => (x.autoPromo?.amount ? [x.autoPromo] : [])) : [];
  const pd = q ? round2(q.promoDiscount - autos.reduce((x, a) => x + a.amount, 0)) : 0;
  const total = q?.total ?? 0;
  const money = (v: number) => (quoted ? f.money(v) : '—');
  const etas = groups.map(([sid]): [number, number] => shop(sid)?.eta ?? [20, 35]);
  const windows = deliveryWindows();

  const finish = (orders: ApiOrder[]) => {
    const store = useShopStore.getState();
    // The server took the placed lines out of the cart; the browser's copy follows.
    store.set({ cart: store.cart.filter((l) => !l.on), promo: null, co: null });
    attemptKey.current = newIdempotencyKey();
    setKhqr(null);
    setBusy(false);
    void refreshCatalog(qc);
    refreshOrders(qc, user?.id);
    router.push(`/orders/${orders[0]!.number}`);
    toast(
      orders.length > 1 ? tt('ordersPlaced', { n: orders.length }) : tt('orderPlaced'),
      orders.length > 1 ? { label: tt('allOrders'), href: '/account/orders' } : undefined,
    );
  };

  const failed = (e: unknown) => {
    setBusy(false);
    if (!(e instanceof ApiError) || e.code !== 'NETWORK_ERROR')
      attemptKey.current = newIdempotencyKey();
    if (isApiError(e, 'INSUFFICIENT_STOCK')) {
      const short = e.details
        .map((d) => {
          const it = item(sel[Number(/\[(\d+)\]/.exec(d.field ?? '')?.[1] ?? -1)]?.pid ?? '');
          return it ? tt('shortLine', { name: it.name, n: Number(d.meta?.stock ?? 0) }) : null;
        })
        .filter(Boolean);
      toast(short.join(' · ') || tt('shortStock'));
      void refreshCatalog(qc);
    } else if (isApiError(e, 'PROMO_INVALID')) toast(tt('promoNoLonger'));
    else if (isApiError(e, 'SHOP_UNAVAILABLE')) toast(tt('shopOffline'));
    else if (isApiError(e, 'FULFILMENT_UNAVAILABLE')) toast(tt('noPickup'));
    else if (isApiError(e, 'PAYMENT_METHOD_UNAVAILABLE')) toast(tt('noCod'));
    else if (isApiError(e, 'PAYMENT_FAILED')) toast(tt('cardDeclined'));
    else if (isApiError(e, 'VARIANT_NOT_FOUND')) toast(tt('itemGone'));
    else toast(tco(fallbackErrorKey(e)));
  };

  const place = async () => {
    if (c.method === 'DELIVERY' && !addr) return toast(tt('addAddressFirst'));
    if (c.when === 'later' && !c.slot) {
      setSlotErr(t('errSlot'));
      slotRef.current?.focus();
      return;
    }
    if (!input || busy) return;
    setBusy(true);
    try {
      const r = await placeCheckout({ ...input, paymentMethod: c.pay }, attemptKey.current);
      if (r.payment && r.payment.method === 'KHQR' && r.payment.status === 'PENDING')
        setKhqr({ intent: r.payment, orders: r.orders });
      else finish(r.orders);
    } catch (e) {
      failed(e);
    }
  };

  const PAY: [PaymentMethod, string, string, IcName][] = [
    ['KHQR', tcm('khqr'), t('payKhqrNote'), 'qr'],
    ['CARD', t('payCard'), t('payCardNote'), 'card'],
    ['CASH', c.method === 'PICKUP' ? t('payCashPickup') : t('payCod'), t('payCashNote'), 'cash'],
  ];

  return (
    <>
      <Crumbs items={[{ label: tc('title'), href: '/cart' }, { label: t('title') }]} />
      <h1 className={s.pageT}>{t('title')}</h1>
      <div className={s.twoCol}>
        <div className={s.stack16}>
          <section className={cn(s.ckSec, s.glassMat)}>
            <h2>
              <span className={s.n}>1</span>
              {t('step1')}
            </h2>
            <div className={cn(s.radios, s.row)}>
              <label className={s.rad}>
                <input
                  type="radio"
                  name="method"
                  checked={c.method === 'DELIVERY'}
                  onChange={() => setC({ method: 'DELIVERY' })}
                />
                <span>
                  {t('delivery')}
                  <small>{t('deliveryNote')}</small>
                </span>
                <span className={s.rR}>{deliveryFees ? f.money(deliveryFees) : tc('free')}</span>
              </label>
              <label className={s.rad}>
                <input
                  type="radio"
                  name="method"
                  checked={c.method === 'PICKUP'}
                  onChange={() => setC({ method: 'PICKUP' })}
                />
                <span>
                  {t('pickup')}
                  <small>{t('pickupNote')}</small>
                </span>
                <span className={s.rR}>{tc('free')}</span>
              </label>
            </div>
            {c.method === 'DELIVERY' ? (
              <>
                <div className={s.radios}>
                  {addresses.map((a) => (
                    <label key={a.id} className={s.rad}>
                      <input
                        type="radio"
                        name="addr"
                        checked={c.addr === a.id}
                        onChange={() => setC({ addr: a.id })}
                      />
                      <span>
                        <b style={{ fontWeight: 500 }}>{t(`labels.${a.label}`)}</b> · {a.line},{' '}
                        {f.district(a.district)}
                        <small>
                          {a.name} · {f.phone(a.phone)}
                          {a.note ? ' · ' + a.note : ''}
                        </small>
                      </span>
                    </label>
                  ))}
                </div>
                <button
                  className={cn(s.link, s.quiet, s.small)}
                  style={{ justifySelf: 'start' }}
                  onClick={() => addAddress((a) => setC({ addr: a.id }))}
                >
                  {t('addAddress')}
                </button>
                {addr && addr.district !== area && (
                  <div className={cn(s.alert, s.aInfo)}>
                    {t('feesFor', { area: f.district(addr.district) })}
                  </div>
                )}
              </>
            ) : (
              <div className={cn(s.alert, s.aInfo)}>
                <Ic name="store" size={16} />
                <span>
                  {t('pickupFrom')}{' '}
                  {groups.map(([sid], i) => {
                    const sh = shop(sid);
                    return (
                      <span key={sid}>
                        {i > 0 && ', '}
                        <b>{sh?.name}</b> ({sh?.addr})
                      </span>
                    );
                  })}
                  . {t('showNumber')}
                </span>
              </div>
            )}
          </section>
          <section className={cn(s.ckSec, s.glassMat)}>
            <h2>
              <span className={s.n}>2</span>
              {t('step2')}
            </h2>
            <div className={cn(s.radios, s.row)}>
              <label className={s.rad}>
                <input
                  type="radio"
                  name="when"
                  checked={c.when === 'asap'}
                  onChange={() => setC({ when: 'asap' })}
                />
                <span>
                  {t('asap')}
                  <small>
                    {t('etaMin', {
                      a: Math.max(...etas.map((e) => e[0])),
                      b: Math.max(...etas.map((e) => e[1])),
                    })}
                  </small>
                </span>
              </label>
              <label className={s.rad}>
                <input
                  type="radio"
                  name="when"
                  checked={c.when === 'later'}
                  onChange={() => setC({ when: 'later' })}
                />
                <span>
                  {t('schedule')}
                  <small>{t('scheduleNote')}</small>
                </span>
              </label>
            </div>
            {c.when === 'later' && (
              <div className={cn(s.field, slotErr && s.bad)}>
                <label htmlFor="slot">{t('window')}</label>
                <select
                  id="slot"
                  ref={slotRef}
                  value={c.slot}
                  onChange={(e) => {
                    setC({ slot: e.target.value });
                    setSlotErr('');
                  }}
                >
                  <option value="">{t('choose')}</option>
                  {windows.map((w) => (
                    <option key={w} value={w}>
                      {w}
                    </option>
                  ))}
                </select>
                <div className={s.err} role={slotErr ? 'alert' : undefined}>
                  {slotErr}
                </div>
              </div>
            )}
            <div className={s.field}>
              <label htmlFor="note">{t('note')}</label>
              <input
                id="note"
                value={c.note}
                maxLength={120}
                placeholder={t('notePh')}
                onChange={(e) => setC({ note: e.target.value })}
              />
            </div>
          </section>
          <section className={cn(s.ckSec, s.glassMat)}>
            <h2>
              <span className={s.n}>3</span>
              {t('step3')}
            </h2>
            <div className={s.radios}>
              {PAY.map(([v, l, d, ic]) => (
                <label key={v} className={s.rad}>
                  <input
                    type="radio"
                    name="pay"
                    checked={c.pay === v}
                    onChange={() => setC({ pay: v })}
                  />
                  <span style={{ display: 'flex', gap: 10 }}>
                    <Ic name={ic} size={20} />
                    <span>
                      {l}
                      <small>{d}</small>
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </section>
        </div>
        <aside className={cn(s.panel, s.glassMat, s.sticky)}>
          <h2>{tc('summary')}</h2>
          {groups.map(([sid, ls]) => (
            <div key={sid} style={{ display: 'grid', gap: 8 }}>
              <span className={s.small} style={{ fontWeight: 600 }}>
                {shop(sid)?.name}
              </span>
              {ls.map((l, i) => {
                const it = item(l.pid);
                if (!it) return null;
                const st = selTxt(l.sel);
                return (
                  <div
                    key={i}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '44px 1fr auto',
                      gap: 10,
                      alignItems: 'center',
                    }}
                  >
                    <ItemPh it={it} shop={shop(sid)} sel={l.sel} />
                    <span className={s.small} style={{ minWidth: 0 }}>
                      {it.name}
                      <span className={cn(s.tiny, s.muted)} style={{ display: 'block' }}>
                        {st}
                        {st ? ' · ' : ''}× {l.qty}
                      </span>
                    </span>
                    <span className={cn('num', s.small)}>
                      {money(lineTotal(it.id, l.sel) ?? net(it, l.sel) * l.qty)}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
          <PromoBox lines={lines} district={addr?.district ?? area} quote={q} />
          <div className={s.sum}>
            <div>
              <span className={s.muted}>{t('subtotal')}</span>
              <span>{money(q?.subtotal ?? 0)}</span>
            </div>
            {quoted && q.discount > 0 && (
              <div>
                <span className={s.muted}>{tc('shopDiscounts')}</span>
                <span style={{ color: 'var(--ok)' }}>−{f.money(q.discount)}</span>
              </div>
            )}
            {autos.map((a) => (
              <div key={a.id}>
                <span className={s.muted}>{a.name}</span>
                <span style={{ color: 'var(--ok)' }}>−{f.money(a.amount)}</span>
              </div>
            ))}
            {pd > 0 && (
              <div>
                <span className={s.muted}>{tc('promo', { code: promo?.code ?? '' })}</span>
                <span style={{ color: 'var(--ok)' }}>−{f.money(pd)}</span>
              </div>
            )}
            <div>
              <span className={s.muted}>
                {c.method === 'PICKUP' ? t('pickupFee') : t('deliveryFee')}
              </span>
              <span>{!quoted ? '—' : fees ? f.money(fees) : tc('free')}</span>
            </div>
            <div className={s.tot}>
              <span>{tc('total')}</span>
              <span>{money(total)}</span>
            </div>
            <div>
              <span className={cn(s.tiny, s.muted)}>≈ {quoted ? f.khr(total) : '—'}</span>
            </div>
          </div>
          {quoteQ.error && !quoted && (
            // No total, so no "Place order": say why, and let the customer try again.
            <div className={cn(s.small)} role="alert" style={{ display: 'grid', gap: 6 }}>
              <span style={{ color: 'var(--sale)' }}>
                {isApiError(quoteQ.error, 'INSUFFICIENT_STOCK')
                  ? t('quoteStock')
                  : isApiError(quoteQ.error, 'PROMO_INVALID')
                    ? tt('promoNoLonger')
                    : isApiError(quoteQ.error, 'SHOP_UNAVAILABLE')
                      ? tt('shopOffline')
                      : t('quoteFailed')}
              </span>
              <button
                type="button"
                className={cn(s.btn, s.btnGhost, s.btnSm)}
                style={{ justifySelf: 'start' }}
                onClick={() => void quoteQ.refetch()}
              >
                {t('quoteRetry')}
              </button>
            </div>
          )}
          <button
            className={cn(s.btn, s.btnPrimary, s.btnLg, s.btnBlock)}
            disabled={busy || !quoted}
            onClick={() => void place()}
          >
            {busy ? (
              <>
                <Spin />
                {t('placing')}
              </>
            ) : c.pay === 'KHQR' ? (
              t('payKhqrBtn')
            ) : c.pay === 'CARD' ? (
              t('payAmount', { amount: f.money(total) })
            ) : (
              t('placeOrder')
            )}
          </button>
          <p className={cn(s.tiny, s.muted)}>{t('terms')}</p>
        </aside>
      </div>
      <KhqrModal
        intent={khqr?.intent ?? null}
        onClose={closeKhqr}
        onPaid={() => khqr && finish(khqr.orders)}
      />
    </>
  );
}
