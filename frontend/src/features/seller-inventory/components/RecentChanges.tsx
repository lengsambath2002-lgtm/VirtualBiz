'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { EmptyRow } from '@/components/feedback';
import {
  cx,
  findVariant,
  Ic,
  s,
  SYSTEM_USER,
  Thumb,
  useDb,
  useFmt,
  useUi,
  vname,
  type IcName,
} from '@/features/seller-shared';
import type { StockReason } from '@/lib/domain';

import r from './recent.module.css';

/** What a stock reason is, for its colour and icon: sold, came in, lost, came back, adjusted. */
const KIND: Record<StockReason, ['sale' | 'in' | 'loss' | 'back' | 'adjust', IcName]> = {
  ORDER_SALE: ['sale', 'orders'],
  POS_SALE: ['sale', 'pos'],
  RECEIVED: ['in', 'truck'],
  OPENING_STOCK: ['in', 'box'],
  DAMAGED_LOST: ['loss', 'alert'],
  MARKED_SOLD_OUT: ['loss', 'x'],
  CUSTOMER_RETURN: ['back', 'undo'],
  ORDER_CANCELLED: ['back', 'undo'],
  POS_REFUND: ['back', 'receipt'],
  COUNT_CORRECTION: ['adjust', 'check'],
  QUICK_ADJUST: ['adjust', 'edit'],
};

const PAGE = 8;
const MAX = 40;

const initials = (n: string) =>
  n
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');

/**
 * Inventory's "Recent stock changes": what changed (photo, variant, SKU), why (a coloured tag; an
 * order number opens the order), who, when (relative, exact on hover) and by how much.
 */
export function RecentChanges() {
  const t = useTranslations('seller.inventory');
  const tr = useTranslations('seller.stockReasons');
  const db = useDb();
  const f = useFmt();
  const [all, setAll] = useState(false);
  const sorted = [...db.log].sort((a, b) => b.at.localeCompare(a.at));
  const rows = sorted.slice(0, all ? MAX : PAGE);

  const openOrder = (number: string) => {
    const o = db.orders.find((x) => x.number === number);
    if (o) useUi.getState().open({ kind: 'order', id: o.id });
  };

  return (
    <section className={s.panel}>
      <div className={s.panelH}>
        <div>
          <h2>{t('recent')}</h2>
          <p className={cx(s.small, s.muted)}>{t('recentSub')}</p>
        </div>
      </div>
      <div className={s.tblWrap}>
        <table className={r.table}>
          <colgroup>
            <col style={{ width: '34%' }} />
            <col style={{ width: '28%' }} />
            <col style={{ width: '18%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '8%' }} />
          </colgroup>
          <thead>
            <tr>
              <th>{t('col.item')}</th>
              <th>{t('col.reason')}</th>
              <th>{t('col.by')}</th>
              <th>{t('col.when')}</th>
              <th className={s.r}>{t('col.change')}</th>
            </tr>
          </thead>
          <tbody>
            {!rows.length && (
              <EmptyRow cols={5} title={t('noMovesTitle')} body={t('noMovesBody')} />
            )}
            {rows.map((l) => {
              const [p, v] = findVariant(db.products, l.variantId);
              if (!p || !v) return null;
              const [kind, icon] = KIND[l.reason] ?? ['adjust', 'edit'];
              const system = l.byUserId === SYSTEM_USER;
              const who = system ? t('system') : (l.byName ?? db.shop.ownerName);
              const isOrder = !!l.note && /^VB-\d+$/.test(l.note);
              const variant = [vname(v), v.sku].filter(Boolean).join(' · ');
              return (
                <tr key={l.id} className={r.row}>
                  <td className={r.cItem}>
                    <div className={r.item}>
                      <Thumb p={p} size={34} />
                      <div className={r.itemText}>
                        <strong title={p.title}>{p.title}</strong>
                        {variant && <span className={r.sub}>{variant}</span>}
                      </div>
                    </div>
                  </td>
                  <td className={r.cReason}>
                    <div className={r.reason}>
                      <span className={cx(r.tag, r[kind])}>
                        <Ic name={icon} size={13} />
                        {tr(l.reason)}
                      </span>
                      {l.note &&
                        (isOrder ? (
                          <button
                            type="button"
                            className={r.ref}
                            title={t('openOrder')}
                            onClick={() => openOrder(l.note!)}
                          >
                            {l.note}
                          </button>
                        ) : /^R-\d+$/.test(l.note) ? (
                          <span className={r.ref}>{l.note}</span>
                        ) : (
                          <span className={r.note}>
                            {l.note === 'newVariant' ? t('newVariant') : l.note}
                          </span>
                        ))}
                    </div>
                  </td>
                  <td className={r.cWho}>
                    <div className={r.who}>
                      <span className={cx(r.av, system && r.sys)} aria-hidden="true">
                        {system ? <Ic name="gear" size={12} /> : initials(who)}
                      </span>
                      <span>{who}</span>
                    </div>
                  </td>
                  <td className={cx(r.when, r.cWhen)} title={f.fmtDT(l.at)}>
                    {f.ago(l.at)}
                    <span className={r.sub}>{f.hm(l.at)}</span>
                  </td>
                  <td className={cx(s.r, r.cDelta)}>
                    <span className={cx(r.delta, l.delta > 0 ? r.up : r.down)}>
                      {l.delta > 0 ? '+' : '−'}
                      {Math.abs(l.delta)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {sorted.length > PAGE && (
        <div className={r.more}>
          <button
            type="button"
            className={cx(s.btn, s.btnGhost, s.btnSm)}
            onClick={() => setAll(!all)}
          >
            {all ? t('showLess') : t('showMore', { n: Math.min(sorted.length, MAX) - PAGE })}
          </button>
        </div>
      )}
    </section>
  );
}
