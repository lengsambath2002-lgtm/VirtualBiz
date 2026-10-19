'use client';

import { useTranslations } from 'next-intl';

import { ErrorView } from '@/components/feedback';
import { useSearchParams } from 'next/navigation';
import { createPortal } from 'react-dom';
import { useEffect, useMemo, useRef, useState } from 'react';

import { useRouter } from '@/lib/i18n/navigation';
import { cn } from '@/lib/utils/cn';

import { Ic } from '@/features/shop-shared/components/Ic';
import { ProductCard, ShopCard } from '@/features/shop-shared/components/cards';
import { Crumbs, Star } from '@/features/shop-shared/components/ui';
import { useFmt, useShopData } from '@/features/shop-shared/hooks';
import s from '@/features/shop-shared/shop.module.css';
import { useShopStore } from '@/features/shop-shared/store';

import { useSearch } from '../hooks/useSearch';
import {
  parseSearch,
  searchHref,
  type SearchSort,
  type SearchState,
  type SearchType,
} from '../util/searchParams';

/** Skeleton shown briefly after a new search (prototype: 350 ms). */
const SKELETON_MS = 350;

function FilterPanel({ f, go }: { f: SearchState; go: (patch: Partial<SearchState>) => void }) {
  const t = useTranslations('shop.search');
  const fm = useFmt();
  const { items, categories, shop } = useShopData();
  const base = items.filter((i) => f.type === 'all' || f.type === i.type || f.type === 'shop');
  const cats = categories.filter((c) => f.type === 'all' || f.type === 'shop' || c.type === f.type);
  const PRICES: [string, string, string][] = [
    [t('under10'), '', '10'],
    [t('10to50'), '10', '50'],
    [t('over50'), '50', ''],
  ];
  return (
    <div className={s.filters}>
      <div className={s.fgroup}>
        <h3>{t('category')}</h3>
        {cats.map((c) => (
          <label key={c.id} className={s.fopt}>
            <input
              type="checkbox"
              checked={f.cats.includes(c.id)}
              onChange={(e) =>
                go({
                  cats: e.target.checked ? [...f.cats, c.id] : f.cats.filter((x) => x !== c.id),
                })
              }
            />
            {fm.category(c.id)}
            <span className={cn(s.ct, 'num')}>
              {base.filter((i) => shop(i.shop)?.catId === c.id).length}
            </span>
          </label>
        ))}
      </div>
      {f.type !== 'shop' && (
        <div className={s.fgroup}>
          <h3>{t('price')}</h3>
          <div className={s.range}>
            <PriceInput
              value={f.min}
              placeholder={t('min')}
              label={t('minLabel')}
              onCommit={(min) => go({ min })}
            />
            <span className={s.muted}>–</span>
            <PriceInput
              value={f.max}
              placeholder={t('max')}
              label={t('maxLabel')}
              onCommit={(max) => go({ max })}
            />
          </div>
          <div className={cn(s.chips, s.chipsWrap)}>
            {PRICES.map(([l, a, b]) => (
              <button
                key={l}
                className={cn(s.chip, s.chipSm, f.min === a && f.max === b && s.on)}
                onClick={() => go({ min: a, max: b })}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className={s.fgroup}>
        <h3>{t('rating')}</h3>
        {(
          [
            [4.5, t('r45')],
            [4, t('r4')],
            [0, t('any')],
          ] as const
        ).map(([v, l]) => (
          <label key={v} className={s.fopt}>
            <input
              type="radio"
              name="rt"
              checked={f.rating === v}
              onChange={() => go({ rating: v })}
            />
            {v ? <Star n={v} /> : null}
            {l}
          </label>
        ))}
      </div>
      <div className={s.fgroup}>
        <h3>{t('showOnly')}</h3>
        {f.type !== 'shop' && (
          <label className={s.fopt}>
            <input
              type="checkbox"
              checked={f.sale}
              onChange={(e) => go({ sale: e.target.checked })}
            />
            {t('onSale')}
          </label>
        )}
        <label className={s.fopt}>
          <input
            type="checkbox"
            checked={f.open}
            onChange={(e) => go({ open: e.target.checked })}
          />
          {t('openNow')}
        </label>
        {(f.type === 'product' || f.type === 'all') && (
          <label className={s.fopt}>
            <input
              type="checkbox"
              checked={f.freeDel}
              onChange={(e) => go({ freeDel: e.target.checked })}
            />
            {t('lowestFee')}
          </label>
        )}
      </div>
    </div>
  );
}

/** Min/max price box: applies on change (blur / Enter), as the prototype's `change` event. */
function PriceInput({
  value,
  placeholder,
  label,
  onCommit,
}: {
  value: string;
  placeholder: string;
  label: string;
  onCommit: (v: string) => void;
}) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  const commit = () => {
    const clean = v.replace(/[^\d.]/g, '');
    if (clean !== value) onCommit(clean);
    else setV(clean);
  };
  return (
    <input
      inputMode="decimal"
      placeholder={placeholder}
      aria-label={label}
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && commit()}
    />
  );
}

function FiltersDrawer({
  f,
  go,
  count,
  onClose,
}: {
  f: SearchState;
  go: (patch: Partial<SearchState>) => void;
  count: number;
  onClose: () => void;
}) {
  const t = useTranslations('shop.search');
  const tc = useTranslations('common');
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const o = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = o;
    };
  }, [onClose]);
  return createPortal(
    <div className={s.scrimRight} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside
        className={cn(s.drawer, s.mroot)}
        role="dialog"
        aria-modal="true"
        aria-label={t('filters')}
      >
        <div className={s.drawerH}>
          <h2>{t('filters')}</h2>
          <button className={s.close} onClick={onClose} aria-label={tc('close')}>
            <Ic name="x" size={18} />
          </button>
        </div>
        <div>
          <FilterPanel f={f} go={go} />
        </div>
        <div className={s.drawerF}>
          <button
            className={cn(s.btn, s.btnGhost)}
            onClick={() => {
              go({ ...clearPatch });
              onClose();
            }}
          >
            {t('clearAll')}
          </button>
          <button className={cn(s.btn, s.btnPrimary)} onClick={onClose}>
            {t('showResults', { count })}
          </button>
        </div>
      </aside>
    </div>,
    document.body,
  );
}

const clearPatch: Partial<SearchState> = {
  q: '',
  cats: [],
  min: '',
  max: '',
  rating: 0,
  sale: false,
  open: false,
  freeDel: false,
};

export function SearchPage() {
  const t = useTranslations('shop.search');
  const tc = useTranslations('shop.home');
  const fm = useFmt();
  const params = useSearchParams();
  const router = useRouter();
  const data = useShopData();
  const area = useShopStore((st) => st.area);
  const here = useShopStore((st) => st.here);
  const f = useMemo(() => parseSearch(params), [params]);
  const [skel, setSkel] = useState(!!f.q);
  const [drawer, setDrawer] = useState(false);

  // Arriving from the landing with a district: deliver there.
  const district = params.get('district');
  useEffect(() => {
    if (!district) return;
    const name = Object.entries(data.districtIds).find(([, id]) => id === district)?.[0];
    if (name) useShopStore.getState().setArea(name);
  }, [district, data.districtIds]);

  // Brief skeleton after a search is run (a new query, or arriving with one).
  const prevQ = useRef<string | null>(null);
  useEffect(() => {
    const first = prevQ.current === null;
    prevQ.current = f.q;
    if (first && !f.q) return;
    setSkel(true);
    const id = setTimeout(() => setSkel(false), SKELETON_MS);
    return () => clearTimeout(id);
  }, [f.q]);

  const go = (patch: Partial<SearchState>) =>
    router.replace(searchHref({ ...f, ...patch }), { scroll: false });
  const setType = (type: SearchType) =>
    router.push(searchHref({ ...f, type, cats: [], sort: 'best' }));

  const { items, shops, loading, error, retry } = useSearch(f, area, here);
  const chips: [string, string, () => void][] = [];
  if (f.q) chips.push(['q', `“${f.q}”`, () => go({ q: '' })]);
  f.cats.forEach((c) =>
    chips.push(['cat:' + c, fm.category(c), () => go({ cats: f.cats.filter((x) => x !== c) })]),
  );
  if (f.min !== '' || f.max !== '')
    chips.push([
      'price',
      `${f.min ? '$' + f.min : '$0'}–${f.max ? '$' + f.max : t('anyPrice')}`,
      () => go({ min: '', max: '' }),
    ]);
  if (f.rating) chips.push(['rating', t('ratingChip', { n: f.rating }), () => go({ rating: 0 })]);
  if (f.sale) chips.push(['sale', t('onSale'), () => go({ sale: false })]);
  if (f.open) chips.push(['open', t('openNow'), () => go({ open: false })]);
  if (f.freeDel) chips.push(['freeDel', t('lowestFee'), () => go({ freeDel: false })]);

  const showShops = f.type === 'shop';
  const n = showShops ? shops.length : items.length;
  const single = f.cats.length === 1 ? fm.category(f.cats[0]!) : null;
  const title = f.q ? t('resultsFor', { q: f.q }) : (single ?? t('explore'));

  return (
    <>
      <Crumbs
        items={[
          { label: tc('crumbHome'), href: '/home' },
          { label: f.q ? t('crumbSearch') : (single ?? t('explore')) },
        ]}
      />
      <div className={s.srch}>
        <aside className={cn(s.filtersSide, s.sticky)}>
          <FilterPanel f={f} go={go} />
        </aside>
        <section className={s.sec}>
          <div className={s.resH}>
            <div>
              <h1 className={s.pageT}>{title}</h1>
              <span className={cn(s.muted, s.small, 'num')} aria-live="polite">
                {error
                  ? null
                  : showShops
                    ? t('shopCount', { count: n })
                    : t('resultCount', { count: n })}
                {!showShops && shops.length > 0 && f.q ? (
                  <>
                    {' · '}
                    <button className={cn(s.link, s.quiet)} onClick={() => setType('shop')}>
                      {t('matchingShops', { count: shops.length })}
                    </button>
                  </>
                ) : null}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <div className={s.seg} role="tablist">
                {(['all', 'product', 'service', 'shop'] as const).map((k) => (
                  <button
                    key={k}
                    role="tab"
                    aria-selected={f.type === k}
                    className={cn(f.type === k && s.on)}
                    onClick={() => setType(k)}
                  >
                    {t(`types.${k}`)}
                  </button>
                ))}
              </div>
              <button
                className={cn(s.btn, s.btnGhost, s.btnSm, s.onlyM)}
                onClick={() => setDrawer(true)}
              >
                <Ic name="filter" size={16} />
                {chips.length ? t('filtersN', { n: chips.length }) : t('filters')}
              </button>
              {!showShops && (
                <select
                  className={s.select}
                  aria-label={t('sortBy')}
                  value={f.sort}
                  onChange={(e) => go({ sort: e.target.value as SearchSort })}
                >
                  {(['best', 'near', 'rating', 'low', 'high'] as const).map((v) => (
                    <option key={v} value={v}>
                      {t(`sort.${v}`)}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
          {chips.length > 0 && (
            <div className={cn(s.chips, s.chipsWrap)}>
              {chips.map(([k, l, rm]) => (
                <button
                  key={k}
                  className={cn(s.chip, s.x)}
                  onClick={rm}
                  aria-label={t('removeFilter', { name: l })}
                >
                  {l} <Ic name="x" size={14} />
                </button>
              ))}
              <button className={cn(s.link, s.quiet, s.small)} onClick={() => go(clearPatch)}>
                {t('clearAll')}
              </button>
            </div>
          )}
          {error ? (
            // A failed search is not "no results": say so and offer a retry.
            <div className={cn(s.glassMat)} style={{ borderRadius: 'var(--r-md)' }}>
              <ErrorView error={error} retry={retry} size="panel" home={null} />
            </div>
          ) : skel || loading ? (
            <div className={cn(s.grid, s.g4)}>
              {Array.from({ length: 8 }, (_, i) => (
                <div key={i} className={s.skel} />
              ))}
            </div>
          ) : n ? (
            showShops ? (
              <div className={cn(s.shops, s.shopsAuto)}>
                {shops.map((sh) => (
                  <ShopCard key={sh.id} sh={sh} />
                ))}
              </div>
            ) : (
              <div className={cn(s.grid, s.g4)}>
                {items.map((it) => (
                  <ProductCard key={it.id} it={it} />
                ))}
              </div>
            )
          ) : (
            <div className={cn(s.empty, s.glassMat)}>
              <Ic name="search" size={30} />
              <strong>{f.q ? t('noResultsFor', { q: f.q }) : t('noResults')}</strong>
              <span>{t('noResultsHint')}</span>
              {chips.length > 0 && (
                <button className={cn(s.btn, s.btnGhost, s.btnSm)} onClick={() => go(clearPatch)}>
                  {t('clearAllFilters')}
                </button>
              )}
            </div>
          )}
        </section>
      </div>
      {drawer && (
        <FiltersDrawer f={f} go={go} count={items.length} onClose={() => setDrawer(false)} />
      )}
    </>
  );
}
