'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';

import { useHardwareScanner } from '@/features/barcode-scanner';
import {
  cx,
  Ic,
  posTotals,
  s,
  shiftCash,
  stockOf,
  Thumb,
  useDb,
  useFmt,
  useSellerStore,
  useUi,
  useCollectionName,
} from '@/features/seller-shared';

import { focusPosSearch, usePosActions } from '../hooks/usePosActions';

/** Browser connectivity (for the "Online" pill). */
export function useOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const upd = () => setOnline(navigator.onLine);
    upd();
    window.addEventListener('online', upd);
    window.addEventListener('offline', upd);
    return () => {
      window.removeEventListener('online', upd);
      window.removeEventListener('offline', upd);
    };
  }, []);
  return online;
}

export function PosPage() {
  const t = useTranslations('seller.pos');
  const tcol = useCollectionName();
  const db = useDb();
  const f = useFmt();
  const act = usePosActions();
  const overlay = useUi((u) => u.overlay);
  const online = useOnline();
  const { pos, products } = db;
  const sh = pos.shift;
  const [cat, setCat] = useState<string>('all');
  const [input, setInput] = useState('');
  const [q, setQ] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const cartRef = useRef<HTMLElement>(null);

  useEffect(() => {
    focusPosSearch();
    if (!useSellerStore.getState().db?.pos.shift) {
      const id = setTimeout(() => useUi.getState().open({ kind: 'posOpen' }), 50);
      return () => clearTimeout(id);
    }
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);

  useHardwareScanner({
    enabled: !overlay,
    onScan: (code) => {
      if (!act.scan(code)) useUi.getState().showToast(t('noBarcode', { code }));
    },
  });

  const query = q.trim().toLowerCase();
  const list = products.filter(
    (p) =>
      p.status === 'ACTIVE' &&
      (cat === 'all' || p.collection === cat) &&
      (!query ||
        (p.title + p.variants.map((v) => v.sku + v.barcode).join(' '))
          .toLowerCase()
          .includes(query)),
  );
  const { sub, disc, total, n } = posTotals(pos);

  const onEnter = () => {
    clearTimeout(timer.current);
    const v = input.trim();
    if (!v) return;
    if (act.scan(v)) {
      setInput('');
      setQ('');
      return;
    }
    const hits = products.filter(
      (p) => p.status === 'ACTIVE' && p.title.toLowerCase().includes(v.toLowerCase()),
    );
    if (hits.length === 1 && hits[0]) {
      setInput('');
      setQ('');
      act.pick(hits[0]);
    } else if (!hits.length) useUi.getState().showToast(t('noProductFor', { q: v }));
  };

  const ui = useUi.getState();
  return (
    <>
      <div className={s.posBar}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <h1 className={s.posT}>{t('register')}</h1>
          {sh ? (
            <>
              <span className={cx(s.pill, s.ok)}>
                {t('shiftOpen', { time: f.hm(sh.openedAt) })}
              </span>
              <span className={cx(s.tiny, s.muted, s.num)}>
                {t('cashInDrawer', { amount: f.money(shiftCash(pos)) })}
              </span>
            </>
          ) : (
            <span className={cx(s.pill, s.warn)}>{t('shiftClosed')}</span>
          )}
          {online ? (
            <span className={cx(s.pill, s.neutral)} title={t('offlineTip')}>
              <Ic name="check" size={12} /> {t('online')}
            </span>
          ) : (
            <span className={cx(s.pill, s.warn)} title={t('offlineTip')}>
              {t('offline', { n: pos.pending.length })}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {sh ? (
            <>
              <button
                type="button"
                className={cx(s.btn, s.btnGhost, s.btnSm)}
                onClick={() => void act.cashInOut()}
              >
                {t('cashInOut')}
              </button>
              <button
                type="button"
                className={cx(s.btn, s.btnGhost, s.btnSm)}
                onClick={() => ui.open({ kind: 'posReceipts' })}
              >
                {t('receiptsBtn')}
              </button>
              <button
                type="button"
                className={cx(s.btn, s.btnGhost, s.btnSm)}
                onClick={() => ui.open({ kind: 'posClose' })}
              >
                {t('closeShift')}
              </button>
            </>
          ) : (
            <button
              type="button"
              className={cx(s.btn, s.btnPrimary, s.btnSm)}
              onClick={() => ui.open({ kind: 'posOpen' })}
            >
              {t('openShift')}
            </button>
          )}
        </div>
      </div>
      <div className={s.pos}>
        <section className={s.posL}>
          <div className={s.scanbox} style={{ padding: '8px 10px' }}>
            <Ic name="scan" size={22} />
            <input
              id="posq"
              className={s.posQ}
              value={input}
              placeholder={t('searchPh')}
              autoComplete="off"
              aria-label={t('searchLabel')}
              onChange={(e) => {
                const v = e.target.value;
                setInput(v);
                clearTimeout(timer.current);
                timer.current = setTimeout(() => setQ(v), 250);
              }}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return;
                e.preventDefault();
                onEnter();
              }}
            />
            <span className={cx(s.tiny, s.muted, s.hideS)}>{t('scannerReady')}</span>
          </div>
          <div
            className={cx(s.chips, s.noScrollbar)}
            style={{ flexWrap: 'nowrap', overflowX: 'auto' }}
          >
            {['all', ...db.collections].map((c) => (
              <button
                key={c}
                type="button"
                className={cx(s.chip, cat === c && s.on)}
                onClick={() => setCat(c)}
              >
                {c === 'all' ? t('all') : tcol(c)}
              </button>
            ))}
          </div>
          <div className={s.posGrid}>
            {list.length ? (
              list.map((p) => {
                const st = stockOf(p);
                const minPrice = Math.min(...p.variants.map((v) => v.price));
                return (
                  <button
                    key={p.id}
                    type="button"
                    className={cx(s.ptile, !st && s.out)}
                    aria-disabled={!st || undefined}
                    onClick={() => act.tile(p)}
                  >
                    <Thumb p={p} size={52} />
                    <span className={s.ptN}>{p.title}</span>
                    <span className={cx(s.ptP, s.num)}>
                      {p.variants.length > 1
                        ? t('from', { price: f.money(minPrice) })
                        : f.money(minPrice)}
                    </span>
                    <span className={cx(s.ptS, st ? st <= p.lowStockAt && s.low : s.none)}>
                      {st ? t('inStock', { n: st }) : t('soldOut')}
                      {p.variants.length > 1 ? ` · ${t('options', { n: p.variants.length })}` : ''}
                    </span>
                  </button>
                );
              })
            ) : (
              <div className={s.empty} style={{ gridColumn: '1/-1' }}>
                <strong>{t('noMatch')}</strong>
              </div>
            )}
          </div>
        </section>
        <aside className={s.posR} ref={cartRef} id="poscart">
          <div className={s.posRh}>
            <strong>{t('currentSale')}</strong>
            <span style={{ display: 'flex', gap: 6 }}>
              {pos.held.length > 0 && (
                <button
                  type="button"
                  className={cx(s.btn, s.btnGhost, s.btnSm)}
                  onClick={() => ui.open({ kind: 'posHeld' })}
                >
                  {t('heldN', { n: pos.held.length })}
                </button>
              )}
              <button
                type="button"
                className={cx(s.btn, s.btnGhost, s.btnSm)}
                onClick={() => void act.customer()}
              >
                <Ic name="users" size={16} />
                {pos.cust || t('customer')}
              </button>
            </span>
          </div>
          <div className={s.posLines}>
            {pos.cart.length ? (
              pos.cart.map((l, i) => (
                <div key={l.variantId} className={s.pl}>
                  <span style={{ minWidth: 0 }}>
                    <span className={s.plN}>{l.title}</span>
                    <span className={cx(s.tiny, s.muted)}>
                      {l.variantName}
                      {l.variantName ? ' · ' : ''}
                      {f.money(l.unitPrice)}
                    </span>
                  </span>
                  <span className={s.qadj}>
                    <button
                      type="button"
                      aria-label={t('decrease', { title: l.title })}
                      onClick={() => useSellerStore.getState().decLine(i)}
                    >
                      <Ic name="minus" size={14} />
                    </button>
                    <span>{l.qty}</span>
                    <button
                      type="button"
                      aria-label={t('increase', { title: l.title })}
                      onClick={() => act.inc(i)}
                    >
                      <Ic name="plus" size={14} />
                    </button>
                  </span>
                  <b className={s.num} style={{ minWidth: 72, textAlign: 'right' }}>
                    {f.money(l.unitPrice * l.qty)}
                  </b>
                </div>
              ))
            ) : (
              <div className={cx(s.empty, s.emptyBare)}>
                <Ic name="scan" size={30} />
                <strong>{t('emptyTitle')}</strong>
                <span>{t('emptyHint')}</span>
              </div>
            )}
          </div>
          <div className={s.posSum}>
            <div className={s.sum}>
              <div>
                <span className={s.muted}>{t('items', { n })}</span>
                <span>{f.money(sub)}</span>
              </div>
              <div>
                <button
                  type="button"
                  className={cx(s.link, s.quiet, s.small)}
                  disabled={!pos.cart.length}
                  onClick={() => void act.discount()}
                >
                  {pos.disc
                    ? t('discountIs', {
                        v: pos.disc.type === '%' ? `${pos.disc.v}%` : f.money(pos.disc.v),
                      })
                    : t('addDiscount')}
                </button>
                <span className={s.up}>{disc ? `−${f.money(disc)}` : ''}</span>
              </div>
              <div className={s.tot}>
                <span>{t('total')}</span>
                <span>{f.money(total)}</span>
              </div>
              <div>
                <span className={cx(s.tiny, s.muted)}>{t('inRiel')}</span>
                <span className={cx(s.tiny, s.muted, s.num)}>{f.khr(total)}</span>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 8 }}>
              <button
                type="button"
                className={cx(s.btn, s.btnGhost)}
                disabled={!pos.cart.length}
                onClick={act.hold}
              >
                {t('hold')}
              </button>
              <button
                type="button"
                className={cx(s.btn, s.btnPrimary, s.btnLg)}
                disabled={!pos.cart.length}
                onClick={() => ui.open({ kind: 'posCharge' })}
              >
                {t('chargeAmount', { amount: f.money(total) })}
              </button>
            </div>
            {pos.cart.length > 0 && (
              <button
                type="button"
                className={cx(s.link, s.quiet, s.small)}
                style={{ justifySelf: 'center' }}
                onClick={act.clear}
              >
                {t('clearSale')}
              </button>
            )}
          </div>
        </aside>
      </div>
      {pos.cart.length > 0 && (
        <div className={s.posMbar}>
          <span>
            <b className={s.num}>{f.money(total)}</b>{' '}
            <span className={cx(s.tiny, s.muted)}>{t('items', { n })}</span>
          </span>
          <button
            type="button"
            className={cx(s.btn, s.btnGhost, s.btnSm)}
            onClick={() => cartRef.current?.scrollIntoView({ behavior: 'smooth' })}
          >
            {t('cart')}
          </button>
          <button
            type="button"
            className={cx(s.btn, s.btnPrimary, s.btnSm)}
            onClick={() => ui.open({ kind: 'posCharge' })}
          >
            {t('chargeShort')}
          </button>
        </div>
      )}
    </>
  );
}
