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
  useSellerStore,
  useUi,
  type SellerProduct,
  useCollectionName,
} from '@/features/seller-shared';
import { ExportButton, ImportDialog, type ImportReport } from '@/components/data';
import { EmptyView } from '@/components/feedback';
import { useMyRole } from '@/features/account-switcher';
import { api } from '@/lib/api';

import r from './products.module.css';

type ProdFilter = 'all' | 'active' | 'draft' | 'low';
type SortKey = 'title' | 'stock' | 'price' | 'sold';
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
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const role = useMyRole(db.shop.id);
  const canManage = role === 'OWNER' || role === 'MANAGER';
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

  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 } | null>(null);
  const sortedList = sort
    ? [...list].sort((x, y) => {
        const val = (p: SellerProduct) =>
          sort.key === 'title'
            ? p.title.toLowerCase()
            : sort.key === 'stock'
              ? pStock(p).s
              : sort.key === 'price'
                ? Math.min(...p.variants.map((v) => v.price))
                : sold(p);
        const a = val(x);
        const b = val(y);
        return (a < b ? -1 : a > b ? 1 : 0) * sort.dir;
      })
    : list;
  const ariaSort = (k: SortKey) =>
    sort?.key === k ? (sort.dir === 1 ? 'ascending' : 'descending') : undefined;
  const sortHead = (k: SortKey, label: string) => (
    <button
      type="button"
      className={r.th}
      onClick={() =>
        setSort((cur) =>
          cur?.key !== k
            ? { key: k, dir: k === 'title' ? 1 : -1 }
            : cur.dir === (k === 'title' ? 1 : -1)
              ? { key: k, dir: k === 'title' ? -1 : 1 }
              : null,
        )
      }
    >
      {label}
      <span className={r.arrow} aria-hidden="true">
        {sort?.key === k ? (sort.dir === 1 ? '▲' : '▼') : '↕'}
      </span>
    </button>
  );
  const addProduct = () => useUi.getState().open({ kind: 'productAdd' });
  const selected = [...sel].filter((id) => db.products.some((p) => p.id === id));
  const ui = useUi.getState();
  const bulkStatus = async (status: 'ACTIVE' | 'DRAFT') => {
    const n = await useSellerStore.getState().setProductsStatus(selected, status);
    ui.showToast(t('bulkDone', { n, total: selected.length }));
    setSel(new Set());
  };
  const bulkDelete = async () => {
    const ok = await ui.confirm({
      title: t('bulkDeleteTitle', { n: selected.length }),
      body: t('bulkDeleteBody'),
      ok: t('bulkDelete'),
      danger: true,
    });
    if (!ok) return;
    const n = await useSellerStore.getState().deleteProducts(selected);
    ui.showToast(t('bulkDone', { n, total: selected.length }));
    setSel(new Set());
  };

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
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {canManage && (
            <>
              <ExportButton
                path="/exports/products"
                businessId={db.shop.id}
                className={cx(s.btn, s.btnGhost)}
              />
              <button
                type="button"
                className={cx(s.btn, s.btnGhost)}
                onClick={() => setImporting(true)}
              >
                {t('import')}
              </button>
            </>
          )}
          <button
            type="button"
            className={cx(s.btn, s.btnGhost)}
            onClick={() => useUi.getState().open({ kind: 'collections' })}
          >
            <Ic name="tag" size={18} />
            {t('collections')}
          </button>
          <button type="button" className={cx(s.btn, s.btnPrimary)} onClick={addProduct}>
            <Ic name="plus" size={18} />
            {t('add')}
          </button>
        </div>
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
        {canManage && selected.length > 0 && (
          <div className={s.bulk}>
            <b>{t('selectedN', { n: selected.length })}</b>
            <button
              type="button"
              className={cx(s.btn, s.btnGhost, s.btnSm)}
              onClick={() => void bulkStatus('ACTIVE')}
            >
              {t('bulkPublish')}
            </button>
            <button
              type="button"
              className={cx(s.btn, s.btnGhost, s.btnSm)}
              onClick={() => void bulkStatus('DRAFT')}
            >
              {t('bulkDraft')}
            </button>
            <button
              type="button"
              className={cx(s.btn, s.btnGhost, s.btnSm)}
              onClick={() => void bulkDelete()}
            >
              {t('bulkDelete')}
            </button>
            <button
              type="button"
              className={cx(s.link, s.quiet, s.small)}
              style={{ color: 'inherit' }}
              onClick={() => setSel(new Set())}
            >
              {t('clearSel')}
            </button>
          </div>
        )}
        {list.length ? (
          <div className={s.tblWrap}>
            <table className={r.table}>
              <colgroup>
                {canManage && <col style={{ width: 44 }} />}
                <col style={{ width: '34%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '17%' }} />
                <col style={{ width: '13%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '7%' }} />
                <col style={{ width: '9%' }} />
              </colgroup>
              <thead>
                <tr>
                  {canManage && (
                    <th style={{ width: 40 }}>
                      <input
                        type="checkbox"
                        aria-label={t('selectAll')}
                        checked={!!sortedList.length && selected.length === sortedList.length}
                        onChange={(e) =>
                          setSel(
                            e.target.checked ? new Set(sortedList.map((p) => p.id)) : new Set(),
                          )
                        }
                      />
                    </th>
                  )}
                  <th aria-sort={ariaSort('title')}>{sortHead('title', t('col.product'))}</th>
                  <th>{t('col.status')}</th>
                  <th aria-sort={ariaSort('stock')}>{sortHead('stock', t('col.stock'))}</th>
                  <th>{t('col.category')}</th>
                  <th className={s.r} aria-sort={ariaSort('price')}>
                    {sortHead('price', t('col.price'))}
                  </th>
                  <th className={s.r} aria-sort={ariaSort('sold')}>
                    {sortHead('sold', t('col.sold'))}
                  </th>
                  <th>
                    <span className="sr-only">{t('col.actions')}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedList.map((p) => {
                  const st = pStock(p);
                  const open = () => void go(`/seller/products/${p.id}`);
                  const v0 = p.variants[0];
                  const onSale = p.variants.some((v) => v.compareAt && v.compareAt > v.price);
                  // The bar: stock against twice the low-stock alert (full = comfortably stocked).
                  const fill = Math.min(1, st.s / Math.max(1, p.lowStockAt * 2));
                  return (
                    <tr
                      key={p.id}
                      className={cx(s.clk, r.row)}
                      tabIndex={0}
                      onClick={open}
                      onKeyDown={(e) => e.key === 'Enter' && e.target === e.currentTarget && open()}
                    >
                      {canManage && (
                        <td onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            aria-label={t('selectOne', { name: p.title })}
                            checked={sel.has(p.id)}
                            onChange={(e) => {
                              const next = new Set(sel);
                              if (e.target.checked) next.add(p.id);
                              else next.delete(p.id);
                              setSel(next);
                            }}
                          />
                        </td>
                      )}
                      <td className={r.cProd}>
                        <div className={r.prod}>
                          <Thumb p={p} size={44} />
                          <div className={r.prodText}>
                            <strong title={p.title}>{p.title}</strong>
                            <span className={r.sub}>
                              {p.variants.length > 1
                                ? t('variantsN', { n: p.variants.length })
                                : [v0?.sku, v0?.barcode].filter(Boolean).join(' · ') || t('noSku')}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className={r.cStatus}>
                        <span className={cx(s.pill, p.status === 'ACTIVE' ? s.ok : s.neutral)}>
                          {t(p.status === 'ACTIVE' ? 'active' : 'draft')}
                        </span>
                      </td>
                      <td className={r.cStock}>
                        <div className={r.stock}>
                          <span className={r.stockTop}>
                            <b>{st.s}</b>
                            <span className={s.muted}>{t('inStockShort')}</span>
                          </span>
                          <span className={r.meter} aria-hidden="true">
                            <i
                              className={r[st.cls]}
                              style={{ width: `${Math.max(st.s ? 6 : 0, fill * 100)}%` }}
                            />
                          </span>
                          {st.out ? (
                            <span className={r.bad}>{t('soldOutN', { n: st.out })}</span>
                          ) : st.low ? (
                            <span className={r.warn}>{t('lowN', { n: st.low })}</span>
                          ) : null}
                        </div>
                      </td>
                      <td className={r.cCat}>
                        {p.collection ? <span className={r.cat}>{tcol(p.collection)}</span> : '—'}
                      </td>
                      <td className={cx(s.r, r.cPrice)}>
                        <span className={r.price}>{priceRange(p, f.money)}</span>
                        {onSale && p.variants.length === 1 && v0?.compareAt ? (
                          <span className={r.was}>{f.money(v0.compareAt)}</span>
                        ) : onSale ? (
                          <span className={r.sub}>{t('onSale')}</span>
                        ) : null}
                      </td>
                      <td className={cx(s.r, r.cSold, r.sold)}>
                        <b>{sold(p)}</b>
                      </td>
                      <td className={r.cActs} onClick={(e) => e.stopPropagation()}>
                        <div className={r.acts}>
                          <button
                            type="button"
                            className={r.act}
                            title={t('actEdit')}
                            aria-label={t('actEdit')}
                            onClick={open}
                          >
                            <Ic name="edit" size={16} />
                          </button>
                          {p.variants.length === 1 && v0 && (
                            <button
                              type="button"
                              className={r.act}
                              title={t('actStock')}
                              aria-label={t('actStock')}
                              onClick={() =>
                                useUi.getState().open({ kind: 'adjust', variantId: v0.id })
                              }
                            >
                              <Ic name="stock" size={16} />
                            </button>
                          )}
                          <button
                            type="button"
                            className={r.act}
                            title={t('actDuplicate')}
                            aria-label={t('actDuplicate')}
                            onClick={() =>
                              void useSellerStore
                                .getState()
                                .duplicateProduct(p.id)
                                .then(() =>
                                  useUi.getState().showToast(t('duplicated', { title: p.title })),
                                )
                                .catch(() => useUi.getState().showToast(t('duplicateFailed')))
                            }
                          >
                            <Ic name="copy" size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyView
            title={db.products.length ? t('noMatch') : t('emptyTitle')}
            body={db.products.length ? undefined : t('emptyBody')}
            action={
              <button
                type="button"
                className={cx(s.btn, s.btnPrimary, s.btnSm)}
                onClick={addProduct}
              >
                <Ic name="plus" size={16} />
                {t('add')}
              </button>
            }
          />
        )}
      </section>
      {importing && (
        <ImportDialog
          title={t('importTitle')}
          columns={[
            { name: 'Product', hint: t('importHint.product') },
            { name: 'Variant', hint: t('importHint.variant') },
            { name: 'SKU', hint: t('importHint.sku') },
            { name: 'Barcode' },
            { name: 'Collection' },
            { name: 'Price (USD)', hint: t('importHint.price') },
            { name: 'Compare at (USD)' },
            { name: 'Cost (USD)' },
            { name: 'Stock', hint: t('importHint.stock') },
            { name: 'Status', hint: t('importHint.status') },
          ]}
          example={[
            'USB-C Cable 1 m',
            '',
            'CBL-USBC-1M',
            '',
            'Accessories',
            '6.00',
            '',
            '2.10',
            '25',
            'Active',
          ]}
          templateName="products-template.csv"
          run={(rows, o) =>
            api.post<ImportReport>(
              `/imports/products?dryRun=${o.dryRun}&skipInvalid=${o.skipInvalid}`,
              { rows },
              { businessId: db.shop.id },
            )
          }
          onClose={() => setImporting(false)}
          onDone={() => void useSellerStore.getState().resync()}
        />
      )}
    </>
  );
}
