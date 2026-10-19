'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { Link, useRouter } from '@/lib/i18n/navigation';
import { cn } from '@/lib/utils/cn';

import { Ic } from '@/features/shop-shared/components/Ic';
import { OpenLabel, ProductCard, useToggleSave } from '@/features/shop-shared/components/cards';
import { ReviewsBlock, useReviewRows } from '@/features/shop-shared/components/Reviews';
import { Crumbs, ItemPh, NotFound, Ph, Star, StarRow } from '@/features/shop-shared/components/ui';
import { useFmt, useNeedAuth, useShopData } from '@/features/shop-shared/hooks';
import { defSel, freeOver, kfmt, net, unitPriceOf, zoneFee } from '@/features/shop-shared/rules';
import s from '@/features/shop-shared/shop.module.css';
import { useIsSaved } from '@/features/shop-shared/saved';
import { toast, useShopStore, useShopUi } from '@/features/shop-shared/store';
import type { Item, ShopView } from '@/features/shop-shared/types';
import { useAddLine } from '@/features/shop-shared/useAddLine';
import { searchHref } from '@/features/shop-search/util/searchParams';

export function ItemCrumbs({ it, sh }: { it: Item; sh: ShopView }) {
  const th = useTranslations('shop.home');
  const f = useFmt();
  return (
    <Crumbs
      items={[
        { label: th('crumbHome'), href: '/home' },
        {
          label: f.category(sh.catId),
          href: searchHref({ type: sh.kind, category: [sh.catId] }),
        },
        { label: sh.name, href: `/shop/${sh.id}` },
        { label: it.name },
      ]}
    />
  );
}

export function Gallery({ it, sh, sel }: { it: Item; sh: ShopView; sel?: Record<string, string> }) {
  const t = useTranslations('shop.product');
  const [on, setOn] = useState(0);
  return (
    <div className={s.gallery}>
      <ItemPh it={it} shop={sh} sel={sel} />
      <div className={s.thumbs}>
        {[0, 1, 2, 3].map((k) => (
          <button
            key={k}
            className={cn(k === on && s.on)}
            aria-label={t('photo', { n: k + 1 })}
            onClick={() => setOn(k)}
          >
            <Ph hue={((sh.hue + k - 1) % 6) + 1} icon={sh.icon} />
          </button>
        ))}
      </div>
    </div>
  );
}

function ProductView({ it, sh }: { it: Item; sh: ShopView }) {
  const t = useTranslations('shop.product');
  const tt = useTranslations('shop.toast');
  const f = useFmt();
  const router = useRouter();
  const { items } = useShopData();
  const area = useShopStore((st) => st.area);
  const cart = useShopStore((st) => st.cart);
  const saved = useIsSaved(it.id);
  const needAuth = useNeedAuth();
  const toggleSave = useToggleSave();
  const addLine = useAddLine();
  const rows = useReviewRows(it.shop)(it.id);
  const [sel, setSel] = useState(() => defSel(it));
  const [qty, setQty] = useState(1);

  const out = it.stock === 0;
  const fee = zoneFee(sh, area);
  const inCart = cart.filter((l) => l.pid === it.id).reduce((a, l) => a + l.qty, 0);
  const more = items.filter((i) => i.shop === sh.id && i.id !== it.id).slice(0, 5);
  const free = freeOver(sh);

  const add = () => {
    if (!addLine(it.id, sel, qty)) return;
    setQty(1);
    useShopUi.getState().setMenu('c');
    toast(tt('added'), { label: tt('viewCart'), href: '/cart' });
  };
  const buy = () => {
    if (!addLine(it.id, sel, qty)) return;
    const key = JSON.stringify(sel);
    useShopStore.setState((st) => ({
      cart: st.cart.map((l) => ({ ...l, on: l.pid === it.id && JSON.stringify(l.sel) === key })),
    }));
    setQty(1);
    needAuth('checkOut', () => router.push('/checkout'));
  };

  return (
    <>
      <ItemCrumbs it={it} sh={sh} />
      <div className={s.pdp}>
        <Gallery it={it} sh={sh} sel={sel} />
        <div className={s.info}>
          <h1>{it.name}</h1>
          <div className={s.metaRow}>
            <StarRow n={Math.round(it.rating)} />
            <a href="#reviews" className="num">
              {t('ratingReviews', { rating: it.rating.toFixed(1), count: rows.length })}
            </a>
            <span className={s.sep} />
            <span className="num">{t('sold', { n: kfmt(it.sold) })}</span>
          </div>
          <div className={s.pbox}>
            <div className={cn(s.price, it.off > 0 && s.sale)}>
              <strong>{f.money(net(it, sel))}</strong>
              {it.off > 0 && (
                <>
                  <s>{f.money(unitPriceOf(it, sel))}</s>
                  <span className={cn(s.pill, s.bad)}>-{it.off}%</span>
                </>
              )}
            </div>
            <span className={cn(s.small, s.muted, 'num')}>≈ {f.khr(net(it, sel))}</span>
          </div>
          {(it.opts ?? []).map((g) => (
            <div key={g.n} className={s.optG}>
              <span className={s.lbl}>
                {g.n}: <span>{sel[g.n]}</span>
              </span>
              <div className={s.opts} role="radiogroup" aria-label={g.n}>
                {g.v.map(([label, delta, sw]) => (
                  <button
                    key={label}
                    className={cn(s.ov, sel[g.n] === label && s.on)}
                    role="radio"
                    aria-checked={sel[g.n] === label}
                    onClick={() => setSel((x) => ({ ...x, [g.n]: label }))}
                  >
                    {sw && <span className={s.sw} style={{ background: sw }} />}
                    {label}
                    {delta ? (
                      <span className={cn(s.muted, s.small)}> +{f.money(delta)}</span>
                    ) : null}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div className={s.optG}>
            <span className={s.lbl}>
              {t('quantity')}{' '}
              <span>
                {out
                  ? t('soldOut')
                  : it.stock <= 5
                    ? t('onlyLeft', { n: it.stock })
                    : t('available', { n: it.stock })}
              </span>
            </span>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <div className={s.stepper}>
                <button
                  aria-label={t('decrease')}
                  disabled={qty <= 1 || out}
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                >
                  <Ic name="minus" size={16} />
                </button>
                <span className="num" aria-live="polite">
                  {out ? 0 : qty}
                </span>
                <button
                  aria-label={t('increase')}
                  disabled={qty >= it.stock - inCart || out}
                  onClick={() => setQty((q) => q + 1)}
                >
                  <Ic name="plus" size={16} />
                </button>
              </div>
              {inCart > 0 && (
                <span className={cn(s.small, s.muted)}>{t('inCart', { n: inCart })}</span>
              )}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 10 }}>
            <button className={cn(s.btn, s.btnGhost, s.btnLg)} disabled={out} onClick={add}>
              <Ic name="cart" size={18} />
              {t('addToCart')}
            </button>
            <button className={cn(s.btn, s.btnPrimary, s.btnLg)} disabled={out} onClick={buy}>
              {t('buyNow')}
            </button>
            <button
              className={cn(s.btn, s.btnGhost, s.btnLg)}
              aria-label={saved ? t('unsave') : t('save')}
              aria-pressed={saved}
              style={{ width: 52, padding: 0, color: saved ? 'var(--sale)' : 'inherit' }}
              onClick={() => toggleSave(it.id)}
            >
              <Ic name="heart" size={20} />
            </button>
          </div>
          {out && (
            <div className={cn(s.alert, s.aWarn)}>
              <span>
                {t('madeToOrder')}{' '}
                <button
                  className={s.link}
                  style={{ color: 'inherit' }}
                  onClick={() => needAuth('getAlerts', () => toast(tt('notifyBack')))}
                >
                  {t('notifyMe')}
                </button>
              </span>
            </div>
          )}
          <div className={s.tabs} style={{ marginTop: 8 }}>
            <a className={s.on} href="#" onClick={(e) => e.preventDefault()}>
              {t('details')}
            </a>
          </div>
          <p className={s.desc}>{it.desc}</p>
          {it.spec && (
            <dl className={s.spec}>
              {Object.entries(it.spec).map(([k, v]) => (
                <div key={k} style={{ display: 'contents' }}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
        <aside className={s.buySide}>
          <div className={cn(s.panel, s.glassMat)}>
            <div className={s.perk}>
              <Ic name="pin" size={18} />
              <span>
                {t.rich('deliverTo', { area: f.district(area), b: (c) => <b>{c}</b> })} ·{' '}
                <ChangeArea />
              </span>
            </div>
            {sh.eta && (
              <div className={s.perk}>
                <Ic name="truck" size={18} />
                <span>
                  <b>{t('etaMin', { a: sh.eta[0], b: sh.eta[1] })}</b> ·{' '}
                  {t('deliveryFee', { fee: f.money(fee) })}
                  <br />
                  <span className={cn(s.small, s.muted)}>
                    {t('freeOver', { shop: sh.name, amount: f.money(free) })}
                  </span>
                </span>
              </div>
            )}
            <div className={s.perk}>
              <Ic name="store" size={18} />
              <span>{t.rich('pickup', { addr: sh.addr, b: (c) => <b>{c}</b> })}</span>
            </div>
            <div className={s.perk}>
              <Ic name="undo" size={18} />
              <span>{t('returns')}</span>
            </div>
            <div className={s.perk}>
              <Ic name="shield" size={18} />
              <span>{t('payProtect')}</span>
            </div>
          </div>
          <Link className={cn(s.panel, s.glassMat, s.panelLink)} href={`/shop/${sh.id}`}>
            <div className={s.shopMini}>
              <Ph hue={sh.hue} icon={sh.icon} photo={sh.logo} />
              <div>
                <strong style={{ fontWeight: 500 }}>{sh.name}</strong>
                <div className={s.pcM}>
                  <Star n={sh.rating} /> {sh.rating.toFixed(1)} · <OpenLabel shop={sh} /> ·{' '}
                  {t('replies', { time: sh.resp })}
                </div>
              </div>
            </div>
            <span className={cn(s.btn, s.btnGhost, s.btnSm)}>{t('visitShop')}</span>
          </Link>
        </aside>
      </div>
      <ReviewsBlock itemId={it.id} shopName={sh.name} />
      {more.length > 0 && (
        <section className={s.sec}>
          <div className={s.secH}>
            <h2>{t('moreFrom', { shop: sh.name })}</h2>
            <Link className={s.link} href={`/shop/${sh.id}`}>
              {t('viewShop')}
            </Link>
          </div>
          <div className={s.grid}>
            {more.map((x) => (
              <ProductCard key={x.id} it={x} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}

/** "Change" link that opens the delivery-district sheet in the header. */
function ChangeArea() {
  const t = useTranslations('shop.product');
  return (
    <button
      className={cn(s.link, s.quiet, s.small)}
      onClick={() => useShopUi.getState().setLoc(true)}
    >
      {t('change')}
    </button>
  );
}

export function ProductPage({ id }: { id: string }) {
  const tm = useTranslations('shop.common');
  const { item, shop } = useShopData();
  const it = item(id);
  const sh = it && shop(it.shop);
  if (!it || it.type !== 'product' || !sh) return <NotFound title={tm('missing.product')} />;
  return <ProductView key={id} it={it} sh={sh} />;
}
