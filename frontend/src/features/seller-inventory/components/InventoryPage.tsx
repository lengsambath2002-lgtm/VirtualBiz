'use client';

import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';

import {
  cx,
  Ic,
  s,
  stockOf,
  stockState,
  Thumb,
  useDb,
  useFmt,
  useSellerStore,
  useUi,
  vname,
  type SellerProduct,
} from '@/features/seller-shared';
import type { Variant } from '@/lib/domain';
import { Link, useRouter } from '@/lib/i18n/navigation';

import { ScanResult } from './InventoryDialogs';
import { RecentChanges } from './RecentChanges';

type InvFilter = 'all' | 'low' | 'out';
const FILTERS: InvFilter[] = ['all', 'low', 'out'];

export function InventoryPage() {
  const t = useTranslations('seller.inventory');
  const tc = useTranslations('seller.common');
  const db = useDb();
  const f = useFmt();
  const router = useRouter();
  const params = useSearchParams();
  const fp = params.get('f') as InvFilter | null;
  const filter: InvFilter = fp && FILTERS.includes(fp) ? fp : 'all';
  const [q, setQ] = useState(params.get('q') ?? '');
  const [scan, setScan] = useState('');
  const [shown, setShown] = useState('');
  const scanRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scanRef.current?.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    setQ(params.get('q') ?? '');
  }, [params]);

  const pairs = db.products.flatMap((p) =>
    p.variants.map((v) => [p, v] as [SellerProduct, Variant]),
  );
  const inF = (k: InvFilter, p: SellerProduct, v: Variant) =>
    k === 'all' || (k === 'low' ? stockState(p, v) !== 'ok' : v.stock === 0);
  const query = q.trim().toLowerCase();
  const rows = pairs.filter(
    ([p, v]) =>
      inF(filter, p, v) &&
      (!query || `${p.title} ${vname(v)} ${v.sku} ${v.barcode}`.toLowerCase().includes(query)),
  );
  const value = pairs.reduce((x, [, v]) => x + v.stock * (v.cost || 0), 0);
  const units = db.products.reduce((x, p) => x + stockOf(p), 0);
  const quick = useSellerStore((st) => st.quickAdjust);

  return (
    <>
      <div className={s.phH}>
        <div>
          <h1>{t('title')}</h1>
          <p className={s.muted}>{t('sub', { units, value: f.money0(value) })}</p>
        </div>
        <button
          type="button"
          className={cx(s.btn, s.btnPrimary)}
          onClick={() => useUi.getState().open({ kind: 'receive' })}
        >
          <Ic name="plus" size={18} />
          {t('receive')}
        </button>
      </div>
      <div className={s.scanbox}>
        <Ic name="scan" size={24} />
        <input
          ref={scanRef}
          value={scan}
          placeholder={t('scanPh')}
          autoComplete="off"
          aria-label={t('scanLabel')}
          onChange={(e) => setScan(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            setShown(scan);
            e.currentTarget.select();
          }}
        />
        <span className={cx(s.hint, s.hideS)}>{t('scanHint')}</span>
      </div>
      <div>{shown && <ScanResult code={shown} />}</div>
      <div className={s.tabs}>
        {FILTERS.map((k) => (
          <button
            key={k}
            type="button"
            className={cx(filter === k && s.on)}
            onClick={() => router.push(`/seller/inventory${k === 'all' ? '' : `?f=${k}`}`)}
          >
            {t(`filters.${k}`)}
            <span className={cx(s.ct, s.num)}>{pairs.filter(([p, v]) => inF(k, p, v)).length}</span>
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <div className={s.search}>
          <Ic name="search" size={18} />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('filterPh')}
            aria-label={t('filterLabel')}
          />
        </div>
      </div>
      <section className={s.panel}>
        {rows.length ? (
          <div className={s.tblWrap}>
            <table>
              <thead>
                <tr>
                  <th>{t('col.product')}</th>
                  <th>{t('col.sku')}</th>
                  <th>{t('col.alert')}</th>
                  <th className={s.r}>{t('col.value')}</th>
                  <th className={s.r}>{t('col.stock')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(([p, v]) => {
                  const label = `${p.title} ${vname(v)}`;
                  return (
                    <tr key={v.id}>
                      <td>
                        <div className={s.cw}>
                          <Thumb p={p} size={36} />
                          <div>
                            <Link
                              href={`/seller/products/${p.id}`}
                              style={{ textDecoration: 'none', fontWeight: 500 }}
                            >
                              {p.title}
                            </Link>
                            <div className={cx(s.tiny, s.muted)}>{vname(v) || tc('default')}</div>
                          </div>
                        </div>
                      </td>
                      <td className={cx(s.num, s.small)}>
                        {v.sku || '–'}
                        <div className={cx(s.tiny, s.muted)}>{v.barcode}</div>
                      </td>
                      <td className={s.num}>≤ {p.lowStockAt}</td>
                      <td className={cx(s.r, s.num)}>{f.money0(v.stock * (v.cost || 0))}</td>
                      <td className={s.r}>
                        <span style={{ display: 'inline-flex', gap: 10, alignItems: 'center' }}>
                          <span className={cx(s.stockpill, s[stockState(p, v)])}>
                            <i />
                          </span>
                          <span className={s.qadj}>
                            <button
                              type="button"
                              aria-label={t('removeOne', { item: label })}
                              onClick={() => quick(v.id, -1)}
                            >
                              <Ic name="minus" size={14} />
                            </button>
                            <span>{v.stock}</span>
                            <button
                              type="button"
                              aria-label={t('addOne', { item: label })}
                              onClick={() => quick(v.id, 1)}
                            >
                              <Ic name="plus" size={14} />
                            </button>
                          </span>
                          <button
                            type="button"
                            className={cx(s.link, s.quiet, s.small)}
                            onClick={() =>
                              useUi.getState().open({ kind: 'adjust', variantId: v.id })
                            }
                          >
                            {t('adjustBtn')}
                          </button>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className={s.empty}>
            <strong>{t('nothing')}</strong>
            <span>{filter === 'out' ? t('noSoldOut') : ''}</span>
          </div>
        )}
      </section>
      <RecentChanges />
    </>
  );
}
