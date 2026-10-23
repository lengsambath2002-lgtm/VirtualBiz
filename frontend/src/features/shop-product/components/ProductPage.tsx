'use client';

import { useTranslations } from 'next-intl';
import { Fragment, useEffect, useRef, useState } from 'react';

import { Link, useRouter } from '@/lib/i18n/navigation';
import { Portal } from '@/components/ui/Portal';
import { cn } from '@/lib/utils/cn';

import { Ic } from '@/features/shop-shared/components/Ic';
import { OpenLabel, ProductCard, useToggleSave } from '@/features/shop-shared/components/cards';
import { ReviewsBlock, useReviewRows } from '@/features/shop-shared/components/Reviews';
import { Crumbs, ItemPh, NotFound, Ph, Star, StarRow } from '@/features/shop-shared/components/ui';
import { useFmt, useNeedAuth, useShopData } from '@/features/shop-shared/hooks';
import {
  defSel,
  freeOver,
  kfmt,
  net,
  unitPriceOf,
  variantFor,
  zoneFee,
} from '@/features/shop-shared/rules';
import s from '@/features/shop-shared/shop.module.css';
import { useIsSaved } from '@/features/shop-shared/saved';
import { toast, useShopStore, useShopUi } from '@/features/shop-shared/store';
import type { Item, ShopView } from '@/features/shop-shared/types';
import { useAddLine } from '@/features/shop-shared/useAddLine';
import { usePromoLabel } from '@/features/shop-shared/usePromoLabel';
import { searchHref } from '@/features/shop-search/util/searchParams';

import p from './product.module.css';

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

/**
 * The item's photos (product detail and service pages): a large stage with thumbnails beside it,
 * arrows and a full-screen view; on phones a swipeable strip with dots. No photos: the tinted
 * placeholder (in the chosen colour, for products).
 */
export function Gallery({ it, sh, sel }: { it: Item; sh: ShopView; sel?: Record<string, string> }) {
  const t = useTranslations('shop.product');
  const photos = it.photos ?? [];
  const n = Math.max(1, photos.length);
  const [on, setOn] = useState(0);
  const [big, setBig] = useState(false);
  const strip = useRef<HTMLDivElement>(null);

  const go = (i: number) => {
    const k = Math.max(0, Math.min(n - 1, i));
    setOn(k);
    strip.current?.scrollTo({ left: k * strip.current.clientWidth, behavior: 'smooth' });
  };
  // Swiping (phones) moves the dots and the counter along.
  const onScroll = () => {
    const el = strip.current;
    if (el) setOn(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
  };
  useEffect(() => {
    if (!big) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setBig(false);
      if (e.key === 'ArrowRight') setOn((k) => Math.min(n - 1, k + 1));
      if (e.key === 'ArrowLeft') setOn((k) => Math.max(0, k - 1));
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [big, n]);

  const image = (k: number) =>
    photos[k] ? (
      <Ph hue={sh.hue} icon={sh.icon} photo={photos[k]} />
    ) : (
      <ItemPh it={it} shop={sh} sel={sel} />
    );

  return (
    <div className={cn(p.gallery, n === 1 && p.single)}>
      {n > 1 && (
        <div className={p.thumbs}>
          {photos.map((_, k) => (
            <button
              key={k}
              type="button"
              className={p.thumb}
              aria-label={t('photoOf', { n: k + 1, total: n })}
              aria-current={k === on}
              onClick={() => go(k)}
              onMouseEnter={() => go(k)}
            >
              {image(k)}
            </button>
          ))}
        </div>
      )}
      <div className={p.stage}>
        <div className={p.strip} ref={strip} onScroll={onScroll}>
          {Array.from({ length: n }, (_, k) => (
            <button
              key={k}
              type="button"
              className={p.slide}
              aria-label={t('enlarge', { n: k + 1 })}
              onClick={() => setBig(true)}
            >
              {image(k)}
            </button>
          ))}
        </div>
        {it.off > 0 && <span className={p.badge}>-{it.off}%</span>}
        {n > 1 && (
          <>
            <button
              type="button"
              className={cn(p.arrow, p.prev)}
              aria-label={t('prevPhoto')}
              disabled={on === 0}
              onClick={() => go(on - 1)}
            >
              <Ic name="left" size={18} />
            </button>
            <button
              type="button"
              className={cn(p.arrow, p.next)}
              aria-label={t('nextPhoto')}
              disabled={on === n - 1}
              onClick={() => go(on + 1)}
            >
              <Ic name="right" size={18} />
            </button>
            <span className={cn(p.counter, 'num')}>
              {on + 1} / {n}
            </span>
            <div className={p.dots} aria-hidden>
              {photos.map((_, k) => (
                <i key={k} data-on={k === on} />
              ))}
            </div>
          </>
        )}
      </div>
      {big && (
        <Portal>
          <div
            className={p.lightbox}
            role="dialog"
            aria-modal="true"
            aria-label={it.name}
            onMouseDown={(e) => e.target === e.currentTarget && setBig(false)}
          >
            <div>{image(on)}</div>
            <button
              type="button"
              className={p.lbClose}
              aria-label={t('close')}
              onClick={() => setBig(false)}
            >
              <Ic name="x" size={20} />
            </button>
          </div>
        </Portal>
      )}
    </div>
  );
}

function ProductView({ it, sh }: { it: Item; sh: ShopView }) {
  const t = useTranslations('shop.product');
  const tt = useTranslations('shop.toast');
  const f = useFmt();
  const router = useRouter();
  const promoLabel = usePromoLabel();
  const { items, promos, shop } = useShopData();
  const area = useShopStore((st) => st.area);
  const cart = useShopStore((st) => st.cart);
  const saved = useIsSaved(it.id);
  const needAuth = useNeedAuth();
  const toggleSave = useToggleSave();
  const addLine = useAddLine();
  const rows = useReviewRows(it.shop)(it.id);
  const [sel, setSel] = useState(() => defSel(it));
  const [qty, setQty] = useState(1);

  // Stock of the chosen options (a product's total says nothing about the colour picked).
  const chosen = variantFor(it, sel);
  const stock = chosen ? chosen.stock : it.stock;
  const out = stock === 0;
  const inCart = cart
    .filter((l) => l.pid === it.id && JSON.stringify(l.sel) === JSON.stringify(sel))
    .reduce((a, l) => a + l.qty, 0);
  const left = Math.max(0, stock - inCart);
  const fee = zoneFee(sh, area);
  const free = freeOver(sh);
  const price = net(it, sel);
  const more = items.filter((i) => i.shop === sh.id && i.id !== it.id).slice(0, 5);
  const similar = items
    .filter((i) => i.type === 'product' && i.shop !== sh.id && shop(i.shop)?.catId === sh.catId)
    .sort((a, b) => b.sold - a.sold)
    .slice(0, 5);
  // The shop's live promotions that apply to this item.
  const now = Date.now();
  const deals = promos.filter(
    (pr) =>
      pr.businessId === sh.uuid &&
      Date.parse(String(pr.startsAt)) <= now &&
      now < Date.parse(String(pr.endsAt)) &&
      (pr.scope === 'ALL' ||
        (pr.scope === 'PRODUCTS' && !!it.uuid && pr.targetIds.includes(it.uuid))),
  );
  /** A value that, with the other options as chosen, is out of stock. */
  const gone = (group: string, value: string) =>
    variantFor(it, { ...sel, [group]: value })?.stock === 0;

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
  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: it.name, url });
      else {
        await navigator.clipboard.writeText(url);
        toast(t('linkCopied'));
      }
    } catch {
      /* the share sheet was closed */
    }
  };

  return (
    <div className={p.page}>
      <ItemCrumbs it={it} sh={sh} />
      <div className={p.top}>
        <Gallery it={it} sh={sh} sel={sel} />
        <div className={p.buy}>
          <div className={p.titleRow}>
            <h1>{it.name}</h1>
            <div className={p.meta}>
              <StarRow n={Math.round(it.rating)} />
              <a href="#reviews" className="num">
                {t('ratingReviews', { rating: it.rating.toFixed(1), count: rows.length })}
              </a>
              <span className={p.metaSep} />
              <span className="num">{t('sold', { n: kfmt(it.sold) })}</span>
              <span className={p.iconBtns}>
                <button
                  type="button"
                  className={p.iconBtn}
                  aria-label={t('share')}
                  onClick={() => void share()}
                >
                  <Ic name="share" size={18} />
                </button>
                <button
                  type="button"
                  className={p.iconBtn}
                  aria-label={saved ? t('unsave') : t('save')}
                  aria-pressed={saved}
                  onClick={() => toggleSave(it.id)}
                >
                  <Ic name="heart" size={18} />
                </button>
              </span>
            </div>
          </div>

          <div className={p.priceCard}>
            <div className={cn(p.priceRow, it.off > 0 && p.sale)}>
              <strong className="num">{f.money(price)}</strong>
              {it.off > 0 && (
                <>
                  <s className="num">{f.money(unitPriceOf(it, sel))}</s>
                  <span className={p.off}>-{it.off}%</span>
                </>
              )}
            </div>
            <span className={cn(p.khr, 'num')}>≈ {f.khr(price)}</span>
            {deals.length > 0 && (
              <div className={p.promos}>
                {deals.map((d) => (
                  <span key={d.id} className={p.promo}>
                    <Ic name="tag" size={14} />
                    {promoLabel(d)}
                    {d.code ? ` · ${t('withCode', { code: d.code })}` : ''}
                  </span>
                ))}
              </div>
            )}
          </div>

          {(it.opts ?? []).map((g) => (
            <div key={g.n} className={p.group}>
              <span className={p.groupLabel}>
                {g.n}: <span>{sel[g.n]}</span>
              </span>
              <div className={p.choices} role="radiogroup" aria-label={g.n}>
                {g.v.map(([label, delta, sw]) => {
                  const none = gone(g.n, label);
                  return (
                    <button
                      key={label}
                      type="button"
                      className={cn(p.choice, none && p.gone)}
                      role="radio"
                      aria-checked={sel[g.n] === label}
                      aria-label={none ? `${label} · ${t('soldOut')}` : undefined}
                      onClick={() => {
                        setSel((x) => ({ ...x, [g.n]: label }));
                        setQty(1);
                      }}
                    >
                      {sw && <span className={p.sw} style={{ background: sw }} />}
                      {label}
                      {delta ? <small>+{f.money(delta)}</small> : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          <div className={p.group}>
            <span className={p.groupLabel}>{t('quantity')}</span>
            <div className={p.qtyRow}>
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
                  disabled={qty >= left || out}
                  onClick={() => setQty((q) => q + 1)}
                >
                  <Ic name="plus" size={16} />
                </button>
              </div>
              <span className={cn(p.stock, out ? '' : stock <= 5 ? p.low : p.ok)}>
                {out
                  ? t('soldOut')
                  : stock <= 5
                    ? t('onlyLeftN', { n: stock })
                    : t('inStockN', { n: stock })}
              </span>
              {inCart > 0 && <span className={p.stock}>{t('inCart', { n: inCart })}</span>}
            </div>
          </div>

          <div className={p.actions}>
            <button className={cn(s.btn, s.btnGhost, s.btnLg)} disabled={out} onClick={add}>
              <Ic name="cart" size={18} />
              {t('addToCart')}
            </button>
            <button className={cn(s.btn, s.btnPrimary, s.btnLg)} disabled={out} onClick={buy}>
              {t('buyNow')}
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

          <div className={p.card}>
            <div className={p.perk}>
              <Ic name="pin" size={18} />
              <span>
                {t.rich('deliverTo', { area: f.district(area), b: (c) => <b>{c}</b> })} ·{' '}
                <ChangeArea />
              </span>
            </div>
            {sh.eta && (
              <div className={p.perk}>
                <Ic name="truck" size={18} />
                <span>
                  <b>{t('etaMin', { a: sh.eta[0], b: sh.eta[1] })}</b> ·{' '}
                  {t('deliveryFee', { fee: f.money(fee) })}
                  {Number.isFinite(free) && (
                    <small>{t('freeOver', { shop: sh.name, amount: f.money(free) })}</small>
                  )}
                </span>
              </div>
            )}
            <div className={p.perk}>
              <Ic name="store" size={18} />
              <span>{t.rich('pickup', { addr: sh.addr, b: (c) => <b>{c}</b> })}</span>
            </div>
            <div className={p.perk}>
              <Ic name="undo" size={18} />
              <span>{t('returns')}</span>
            </div>
            <div className={p.perk}>
              <Ic name="shield" size={18} />
              <span>{t('payProtect')}</span>
            </div>
          </div>

          <Link className={p.shopCard} href={`/shop/${sh.id}`}>
            <Ph hue={sh.hue} icon={sh.icon} photo={sh.logo} />
            <div>
              <strong>{sh.name}</strong>
              <span>
                <Star n={sh.rating} /> {sh.rating.toFixed(1)} · <OpenLabel shop={sh} /> ·{' '}
                {t('replies', { time: sh.resp })}
              </span>
            </div>
            <span className={cn(s.btn, s.btnGhost, s.btnSm)}>{t('visitShop')}</span>
          </Link>
        </div>
      </div>

      <nav className={p.secNav} aria-label={t('sections')}>
        <a href="#details">{t('details')}</a>
        <a href="#reviews">{t('reviewsN', { n: rows.length })}</a>
        {more.length > 0 && <a href="#more">{t('moreFromShort')}</a>}
        {similar.length > 0 && <a href="#similar">{t('similar')}</a>}
      </nav>

      <section id="details" className={p.details}>
        {it.desc.trim() ? (
          <div>
            <h2>{t('about')}</h2>
            <p>{it.desc}</p>
          </div>
        ) : (
          !it.spec && <p className={s.muted}>{t('noDetails')}</p>
        )}
        {it.spec && (
          <div>
            <h2>{t('specs')}</h2>
            <dl className={p.specs}>
              {Object.entries(it.spec).map(([k, v]) => (
                <Fragment key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </Fragment>
              ))}
            </dl>
          </div>
        )}
      </section>

      <ReviewsBlock itemId={it.id} shopName={sh.name} />

      {more.length > 0 && (
        <section id="more" className={cn(s.sec, p.anchor)}>
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
      {similar.length > 0 && (
        <section id="similar" className={cn(s.sec, p.anchor)}>
          <div className={s.secH}>
            <h2>{t('similar')}</h2>
          </div>
          <div className={s.grid}>
            {similar.map((x) => (
              <ProductCard key={x.id} it={x} />
            ))}
          </div>
        </section>
      )}

      {/* Phones: price and the two buttons stay at hand. */}
      <div className={p.buyBar} data-pdp-bar>
        <div>
          <strong className="num">{f.money(price)}</strong>
          <span>
            {out ? t('soldOut') : stock <= 5 ? t('onlyLeftN', { n: stock }) : f.khr(price)}
          </span>
        </div>
        <button className={cn(s.btn, s.btnGhost)} disabled={out} onClick={add}>
          {t('addToCart')}
        </button>
        <button className={cn(s.btn, s.btnPrimary)} disabled={out} onClick={buy}>
          {t('buyNow')}
        </button>
      </div>
    </div>
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
