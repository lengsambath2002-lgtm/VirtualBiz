'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

import { round2 } from '@/lib/money';
import { Link, useRouter } from '@/lib/i18n/navigation';
import { cn } from '@/lib/utils/cn';

import { fetchAddresses } from '@/features/shop-account/queries';
import { Ic } from '@/features/shop-shared/components/Ic';
import { itemHref } from '@/features/shop-shared/components/cards';
import { addAddress } from '@/features/shop-shared/components/sheets';
import { ItemPh } from '@/features/shop-shared/components/ui';
import { useFmt, useNeedAuth, useShopData } from '@/features/shop-shared/hooks';
import { checkoutLines, useQuote } from '@/features/shop-checkout/queries';
import { byShop, cartTotals, dist, net, selTxt, unitPriceOf } from '@/features/shop-shared/rules';
import s from '@/features/shop-shared/shop.module.css';
import { toast, useShopStore } from '@/features/shop-shared/store';
import type { CartLine } from '@/features/shop-shared/types';
import { useAddLine } from '@/features/shop-shared/useAddLine';

import { PromoBox } from './PromoBox';

export function CartPage() {
  const t = useTranslations('shop.cart');
  const tt = useTranslations('shop.toast');
  const f = useFmt();
  const router = useRouter();
  const qc = useQueryClient();
  const needAuth = useNeedAuth();
  const addLine = useAddLine();
  const { item, shop, districts } = useShopData();
  const cart = useShopStore((st) => st.cart);
  const later = useShopStore((st) => st.later);
  const area = useShopStore((st) => st.area);
  const here = useShopStore((st) => st.here);
  const promo = useShopStore((st) => st.promo);
  const setCart = (c: CartLine[]) => useShopStore.getState().setCart(c);
  // Totals, delivery fees and the promo are the server's (POST /api/checkout/quote).
  const lines = checkoutLines(cart, item);
  const q = useQuote(
    lines.length
      ? { lines, method: 'DELIVERY', district: area, ...(promo ? { promoCode: promo.code } : {}) }
      : null,
  ).data;

  if (!cart.length)
    return (
      <>
        <h1 className={s.pageT}>{t('title')}</h1>
        <div className={cn(s.empty, s.glassMat)}>
          <Ic name="cart" size={32} />
          <strong>{t('emptyTitle')}</strong>
          <span>{t('emptyBody')}</span>
          <Link className={cn(s.btn, s.btnPrimary)} href="/search">
            {t('startShopping')}
          </Link>
        </div>
        {later.length > 0 && renderLater()}
      </>
    );

  const groups = byShop(cart, item);
  const sel = cart.filter((l) => l.on);
  const tot = cartTotals(sel, item);
  const quoted = !!q && lines.length > 0;
  // The shops' automatic promotions are in promoDiscount too: shown on their own lines.
  const autos = quoted ? q.shops.flatMap((x) => (x.autoPromo?.amount ? [x.autoPromo] : [])) : [];
  const pd = quoted ? round2(q.promoDiscount - autos.reduce((x, a) => x + a.amount, 0)) : 0;
  const total = quoted ? q.total : 0;
  const money = (v: number) => (quoted ? f.money(v) : '—');
  const allOn = cart.every((l) => l.on);
  const shopsSel = byShop(sel, item).length;

  const remove = (k: number) => {
    const l = cart[k]!;
    const it = item(l.pid);
    setCart(cart.filter((_, i) => i !== k));
    toast(tt('removed', { name: it?.name ?? '' }), {
      label: tt('undo'),
      fn: () => {
        const c = useShopStore.getState().cart.slice();
        c.splice(k, 0, l);
        setCart(c);
      },
    });
  };
  const changeQty = (k: number, d: number) => {
    const l = cart[k]!;
    const qty = l.qty + d;
    if (qty < 1) {
      setCart(cart.filter((_, i) => i !== k));
      toast(tt('removed', { name: item(l.pid)?.name ?? '' }), {
        label: tt('undo'),
        fn: () => setCart([...useShopStore.getState().cart, { ...l, qty: 1 }]),
      });
      return;
    }
    setCart(cart.map((x, i) => (i === k ? { ...x, qty } : x)));
  };
  const saveLater = (k: number) => {
    const l = cart[k]!;
    useShopStore.getState().set({ cart: cart.filter((_, i) => i !== k), later: [...later, l] });
    toast(tt('movedLater'));
  };
  const checkout = () =>
    needAuth('checkOut', () => {
      void fetchAddresses(qc)
        .catch(() => [])
        .then((list) =>
          list.length ? router.push('/checkout') : addAddress(() => router.push('/checkout')),
        );
    });

  function renderLater() {
    return (
      <section className={s.sec}>
        <div className={s.secH}>
          <h2>{t('savedForLater')}</h2>
        </div>
        <div style={{ display: 'grid', gap: 8 }}>
          {later.map((l, k) => {
            const it = item(l.pid);
            if (!it) return null;
            return (
              <div
                key={k}
                className={cn(s.panel, s.glassMat)}
                style={{ gridTemplateColumns: '56px 1fr auto', alignItems: 'center', padding: 12 }}
              >
                <ItemPh it={it} shop={shop(it.shop)} sel={l.sel} />
                <div>
                  <div>{it.name}</div>
                  <span className={cn(s.small, s.muted)}>
                    {selTxt(l.sel)} · {f.money(net(it, l.sel))}
                  </span>
                </div>
                <button
                  className={cn(s.btn, s.btnGhost, s.btnSm)}
                  onClick={() => {
                    const rest = later.filter((_, i) => i !== k);
                    useShopStore.getState().set({ later: rest });
                    if (!addLine(l.pid, l.sel, l.qty))
                      useShopStore.getState().set({ later: [...rest, l] });
                  }}
                >
                  {t('moveToCart')}
                </button>
              </div>
            );
          })}
        </div>
      </section>
    );
  }

  return (
    <>
      <h1 className={s.pageT}>
        {t('title')}{' '}
        <span className={cn(s.muted, 'num')} style={{ fontWeight: 400, fontSize: 18 }}>
          ({cartTotals(cart, item).count})
        </span>
      </h1>
      <div className={s.twoCol}>
        <div className={s.stack}>
          <label className={s.fopt} style={{ padding: '0 4px' }}>
            <input
              type="checkbox"
              checked={allOn}
              onChange={(e) => setCart(cart.map((l) => ({ ...l, on: e.target.checked })))}
            />
            {t('selectAll')}
          </label>
          {groups.map(([sid, ls]) => {
            const sh = shop(sid);
            if (!sh) return null;
            const qs = quoted ? q.shops.find((x) => x.shopSlug === sid) : undefined;
            const gt = qs ? qs.subtotal - qs.discount : 0;
            const fo = qs?.freeDeliveryOver ?? Infinity;
            const need = qs?.toFreeDelivery ?? 0;
            const gOn = ls.every((l) => l.on);
            return (
              <section key={sid} className={cn(s.cgroup, s.glassMat)}>
                <div className={s.cgH}>
                  <input
                    type="checkbox"
                    checked={gOn}
                    aria-label={t('selectShop', { shop: sh.name })}
                    onChange={(e) =>
                      setCart(
                        cart.map((l) =>
                          item(l.pid)?.shop === sid ? { ...l, on: e.target.checked } : l,
                        ),
                      )
                    }
                  />
                  <Ic name="store" size={18} />
                  <Link href={`/shop/${sid}`}>{sh.name}</Link>
                  <span className={cn(s.tiny, s.muted)}>
                    {sh.eta ? t('eta', { a: sh.eta[0], b: sh.eta[1] }) + ' · ' : ''}
                    {t('km', { km: dist(sh, area, districts, here) })}
                  </span>
                </div>
                {ls.map((l) => {
                  const it = item(l.pid);
                  if (!it) return null;
                  const k = cart.indexOf(l);
                  const st = selTxt(l.sel);
                  return (
                    <div key={k} className={s.cline}>
                      <input
                        type="checkbox"
                        checked={l.on}
                        aria-label={t('selectItem', { name: it.name })}
                        onChange={(e) =>
                          setCart(
                            cart.map((x, i) => (i === k ? { ...x, on: e.target.checked } : x)),
                          )
                        }
                      />
                      <Link href={itemHref(it)}>
                        <ItemPh it={it} shop={sh} sel={l.sel} />
                      </Link>
                      <div style={{ minWidth: 0, display: 'grid', gap: 4 }}>
                        <Link
                          href={itemHref(it)}
                          style={{ textDecoration: 'none', fontWeight: 500 }}
                        >
                          {it.name}
                        </Link>
                        {st && <span className={cn(s.small, s.muted)}>{st}</span>}
                        <div className={cn(s.price, it.off > 0 && s.sale)}>
                          <strong style={{ fontSize: 14 }}>{f.money(net(it, l.sel))}</strong>
                          {it.off > 0 && <s>{f.money(unitPriceOf(it, l.sel))}</s>}
                        </div>
                        {it.stock - l.qty <= 2 && (
                          <span className={s.tiny} style={{ color: 'var(--accent-ink)' }}>
                            {t('onlyLeft', { n: it.stock })}
                          </span>
                        )}
                      </div>
                      <div className={s.clR}>
                        <div className={cn(s.stepper, s.stepperSm)}>
                          <button aria-label={t('decrease')} onClick={() => changeQty(k, -1)}>
                            <Ic name="minus" size={14} />
                          </button>
                          <span className="num">{l.qty}</span>
                          <button
                            aria-label={t('increase')}
                            disabled={l.qty >= it.stock}
                            onClick={() => changeQty(k, 1)}
                          >
                            <Ic name="plus" size={14} />
                          </button>
                        </div>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button
                            className={cn(s.link, s.quiet, s.small)}
                            onClick={() => saveLater(k)}
                          >
                            {t('saveForLater')}
                          </button>
                          <span className={s.muted}>·</span>
                          <button
                            className={cn(s.link, s.quiet, s.small)}
                            onClick={() => remove(k)}
                          >
                            {t('remove')}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {gt > 0 &&
                  Number.isFinite(fo) &&
                  (need > 0 ? (
                    <div className={cn(s.nudge, s.warn)}>
                      <Ic name="truck" size={16} />
                      <span>
                        {t.rich('nudge', {
                          amount: f.money(need),
                          shop: sh.name,
                          b: (c) => <b className="num">{c}</b>,
                        })}
                      </span>
                      <span className={s.bar}>
                        <i style={{ width: `${Math.min(100, (gt / fo) * 100)}%` }} />
                      </span>
                    </div>
                  ) : (
                    <div className={s.nudge}>
                      <Ic name="check" size={16} />
                      <span>{t('freeFrom', { shop: sh.name })}</span>
                    </div>
                  ))}
              </section>
            );
          })}
        </div>
        <aside className={cn(s.panel, s.glassMat, s.sticky)}>
          <h2>{t('summary')}</h2>
          <PromoBox lines={lines} district={area} quote={quoted ? q : undefined} />
          <div className={s.sum}>
            <div>
              <span className={s.muted}>{t('subtotal', { count: tot.count })}</span>
              <span>{money(q?.subtotal ?? 0)}</span>
            </div>
            {quoted && q.discount > 0 && (
              <div>
                <span className={s.muted}>{t('shopDiscounts')}</span>
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
                <span className={s.muted}>{t('promo', { code: promo?.code ?? '' })}</span>
                <span style={{ color: 'var(--ok)' }}>−{f.money(pd)}</span>
              </div>
            )}
            <div>
              <span className={s.muted}>{t('deliveryEstimate')}</span>
              <span>{!quoted ? '—' : q.deliveryFee ? f.money(q.deliveryFee) : t('free')}</span>
            </div>
            <div className={s.tot}>
              <span>{t('total')}</span>
              <span>{money(total)}</span>
            </div>
            <div>
              <span className={cn(s.tiny, s.muted)}>≈ {quoted ? f.khr(total) : '—'}</span>
            </div>
          </div>
          <button
            className={cn(s.btn, s.btnPrimary, s.btnLg, s.btnBlock)}
            disabled={!tot.count}
            onClick={checkout}
          >
            {tot.count ? t('checkoutN', { n: tot.count }) : t('checkout')}
          </button>
          {shopsSel > 1 && <p className={cn(s.tiny, s.muted)}>{t('separate', { n: shopsSel })}</p>}
        </aside>
      </div>
      {later.length > 0 && renderLater()}
    </>
  );
}
