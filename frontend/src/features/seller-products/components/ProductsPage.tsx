'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import {
  cx,
  DAY,
  Ic,
  ms,
  pStock,
  s,
  Thumb,
  today0,
  useDb,
  useFmt,
  useGo,
  type SellerProduct,
  useCollectionName,
} from '@/features/seller-shared';
import { Link } from '@/lib/i18n/navigation';

type ProdFilter = 'all' | 'active' | 'draft' | 'low';
const FILTERS: Record<ProdFilter, (p: SellerProduct) => boolean> = {
  all: () => true,
  active: (p) => p.status === 'ACTIVE',
  draft: (p) => p.status === 'DRAFT',
  low: (p) => pStock(p).cls !== 'ok',
};

export function priceRange(p: SellerProduct, money: (n: number) => string) {
  const ps = p.variants.map((v) => v.price);
  const a = Math.min(...ps);
  const b = Math.max(...ps);
  return a === b ? money(a) : `${money(a)} – ${money(b)}`;
}

export function ProductsPage() {
  const t = useTranslations('seller.products');
  const tcol = useCollectionName();
  const db = useDb();
  const f = useFmt();
  const go = useGo();
  const [filter, setFilter] = useState<ProdFilter>('all');
  const [cat, setCat] = useState('all');
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();
  const list = db.products
    .filter(FILTERS[filter])
    .filter((p) => cat === 'all' || p.collection === cat)
    .filter(
      (p) =>
        !query ||
        (p.title + p.variants.map((v) => v.sku + v.barcode).join(' '))
          .toLowerCase()
          .includes(query),
    );
  const t30 = today0() - 30 * DAY;
  const recent = db.orders
    .filter((o) => ms(o.createdAt) > t30 && o.status !== 'CANCELLED')
    .flatMap((o) => o.lines);
  const sold = (p: SellerProduct) =>
    recent
      .filter((l) => p.variants.some((v) => v.id === l.variantId))
      .reduce((x, l) => x + l.qty, 0);

  return (
    <>
      <div className={s.phH}>
        <div>
          <h1>{t('title')}</h1>
          <p className={s.muted}>
            {t('sub', {
              active: db.products.filter((p) => p.status === 'ACTIVE').length,
              variants: db.products.reduce((x, p) => x + p.variants.length, 0),
            })}
          </p>
        </div>
        <Link className={cx(s.btn, s.btnPrimary)} href="/seller/products/new">
          <Ic name="plus" size={18} />
          {t('add')}
        </Link>
      </div>
      <div className={s.tabs}>
        {(Object.keys(FILTERS) as ProdFilter[]).map((k) => (
          <button
            key={k}
            type="button"
            className={cx(filter === k && s.on)}
            onClick={() => setFilter(k)}
          >
            {t(`filters.${k}`)}
            <span className={cx(s.ct, s.num)}>{db.products.filter(FILTERS[k]).length}</span>
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <div className={s.search}>
          <Ic name="search" size={18} />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('searchPh')}
            aria-label={t('searchLabel')}
          />
        </div>
        <select
          className={s.select}
          value={cat}
          onChange={(e) => setCat(e.target.value)}
          aria-label={t('category')}
        >
          <option value="all">{t('allCategories')}</option>
          {db.collections.map((c) => (
            <option key={c} value={c}>
              {tcol(c)}
            </option>
          ))}
        </select>
      </div>
      <section className={s.panel}>
        {list.length ? (
          <div className={s.tblWrap}>
            <table>
              <thead>
                <tr>
                  <th>{t('col.product')}</th>
                  <th>{t('col.status')}</th>
                  <th>{t('col.stock')}</th>
                  <th>{t('col.category')}</th>
                  <th className={s.r}>{t('col.price')}</th>
                  <th className={s.r}>{t('col.sold')}</th>
                </tr>
              </thead>
              <tbody>
                {list.map((p) => {
                  const st = pStock(p);
                  const open = () => void go(`/seller/products/${p.id}`);
                  return (
                    <tr
                      key={p.id}
                      className={s.clk}
                      tabIndex={0}
                      onClick={open}
                      onKeyDown={(e) => e.key === 'Enter' && open()}
                    >
                      <td>
                        <div className={s.cw}>
                          <Thumb p={p} size={40} />
                          <div>
                            <div className={s.who}>{p.title}</div>
                            <span className={cx(s.tiny, s.muted)}>
                              {p.variants.length > 1
                                ? t('variantsN', { n: p.variants.length })
                                : t('sku', { sku: p.variants[0]?.sku ?? '' })}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={cx(s.pill, p.status === 'ACTIVE' ? s.ok : s.neutral)}>
                          {t(p.status === 'ACTIVE' ? 'active' : 'draft')}
                        </span>
                      </td>
                      <td>
                        <span className={cx(s.stockpill, s[st.cls])}>
                          <i />
                          <span className={s.num}>{t('inStock', { n: st.s })}</span>
                        </span>
                        {st.out ? (
                          <div className={s.tiny} style={{ color: 'var(--danger)' }}>
                            {t('soldOutN', { n: st.out })}
                          </div>
                        ) : st.low ? (
                          <div className={s.tiny} style={{ color: 'var(--accent-ink)' }}>
                            {t('lowN', { n: st.low })}
                          </div>
                        ) : null}
                      </td>
                      <td>{p.collection ? tcol(p.collection) : ''}</td>
                      <td className={cx(s.r, s.num)}>{priceRange(p, f.money)}</td>
                      <td className={cx(s.r, s.num)}>{sold(p)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className={s.empty}>
            <Ic name="box" size={30} />
            <strong>{t('noMatch')}</strong>
            <Link className={cx(s.btn, s.btnPrimary, s.btnSm)} href="/seller/products/new">
              {t('add')}
            </Link>
          </div>
        )}
      </section>
    </>
  );
}
